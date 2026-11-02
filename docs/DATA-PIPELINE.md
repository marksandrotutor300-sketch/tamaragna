# Data pipeline

How Ragnarok Online data becomes the game's bestiary, and why the numbers look the way
they do.

Everything here is build-time only. The app reads the generated JSON; it never parses
rAthena at runtime.

---

## 1. Sources

All data comes from **rAthena**, pinned to a single commit:

```
RATHENA_SHA = d4b8e7b8f16061cc2496d377ac8f777ce72a4f39
```

| File | Format | Used for |
| --- | --- | --- |
| `db/re/mob_db.yml` | YAML, `MOB_DB` v5 | Stats, element, race, size, level, MVP flags, attack delay |
| `db/re/mob_skill_db.txt` | CSV, 19 columns | Which skills each mob actually casts |
| `db/pre-re/mob_skill_db.txt` | Same CSV format | Fallback kit source for classic mobs |
| `db/re/skill_db.yml` | YAML, `SKILL_DB` v4 | Skill names, descriptions, elements |
| `db/re/attr_fix.yml` | YAML, `ATTRIBUTE_DB` v1 | 4 element levels × 10 × 10 damage percentages |
| `db/re/size_fix.yml` | YAML, `SIZE_FIX_DB` v1 | Reference only; not used in combat |
| `npc/re/mobs/**/*.txt` | Spawn scripts | Species → map list, used for bestiary and arena backdrops |

The pinned commit is declared in `scripts/rathena.pin.ts`.

### Fetch

`scripts/fetch-rathena.ts`:

- Lists the repo tree once and selects `npc/re/mobs/**/*.txt`.
- Downloads the six data files plus 102 spawn scripts into
  `.cache/rathena/<sha>/`, which is gitignored.
- Skips files already cached for that SHA; `npm run data:refresh` forces a re-download.
- Asserts the YAML schema versions (`MOB_DB` 5, `SKILL_DB` 4, `ATTRIBUTE_DB` 1).

---

## 2. Parsing quirks

The rAthena files are machine-friendly but have sharp edges:

- **Sparse YAML.** Absent fields mean "documented default", not zero. The builder applies
  defaults for level (1), HP (1), stats (1), size (Small), race (Formless), element
  (Neutral), element level (1), attack delay (0 → normalized to 1400 ms), and so on.
- **Duplicate YAML key.** `mob_db.yml` contains a repeated `RaceGroups` key; the parser runs
  with `uniqueKeys: false` and takes the last value.
- **Unquoted numbers.** `Ai: 01` is parsed as an integer; the builder casts with `num()`.
- **Rates are 1/10000**, not percentages.
- **Element / race / size are strings**, not numeric IDs. They are mapped through the
  canonical arrays in `src/lib/game/elements.ts`:
  - Elements: `Neutral, Water, Earth, Fire, Wind, Poison, Holy, Dark, Ghost, Undead` (0–9)
  - Races: `Formless, Undead, Brute, Plant, Insect, Fish, Demon, Demihuman, Angel, Dragon, Boss`
  - Sizes: `Small, Medium, Large` (unknown sizes default to Medium)
- **`Element: Weapon`** in `skill_db.yml` is a sentinel meaning "inherit the attacker's
  element". The generator stores `element: null`; the engine substitutes the attacker's
  element at damage time.
- **Negative mob IDs** in `mob_skill_db.txt` are global skill rules, not monsters, and are
  skipped.
- The `re` and `pre-re` skill tables are merged; duplicate species/skill pairs keep the
  strongest row.

---

## 3. Normalization

Raw RO stats span five orders of magnitude (Poring has 55 HP, an MVP has hundreds of
thousands). Using them directly produced one-shot fights, so every species is projected onto
a shared combat budget.

### Combat power

```
maxRawHp     = max(Hp) across all monsters
t            = clamp( ln(1 + Hp) / ln(1 + maxRawHp), 0, 1 )
speciesFactor= 0.8 + 0.5 × t
tierFactor   = 1 + 0.1 × (tier − 1)

hp           = round(1500 × speciesFactor × tierFactor)
atk          = round( 85 × speciesFactor × tierFactor)
matk         = atk
def          = round((30 + 130 × t) × tierFactor)
mdefT        = clamp( ln(1 + MagicDefense) / ln(1001), 0, 1 )
mdef         = round((30 + 130 × mdefT) × tierFactor)
aspdMs       = clamp(round(AttackDelay × 0.55), 450, 2200)
coreStat(v)  = clamp(round(20 + 100 × ln(1 + v) / ln(201)), 20, 120)
```

`coreStat` applies to STR/AGI/VIT/INT/DEX/LUK and feeds IV scaling and the UI. HP and ATK
move together, so a same-level monster can never one-shot a peer.

### Tier

Tier is computed from level percentiles of the non-boss population:

```
MVP                              → 5
Boss class                       → 4
level >= p95                     → 5
level >= p75                     → 4
level >= p50                     → 3
level >= p25                     → 2
otherwise                        → 1
```

Current cutoffs: p25 = 59, p50 = 99, p75 = 128, p95 = 182. Fixed cutoffs were rejected
because renewal levels are heavily skewed (median 100) and would put 69% of the bestiary in
one tier.

---

## 4. Skill kits

Every species gets **exactly six** skills: four offensive and two support. The build keeps
the monster's native skills first, then pads from the element kit, the neutral pool and
finally the global curated pool. The app equips four of the six per pet.

### Curated table

`scripts/whitelist/skill-effects.ts` hand-authors 64 skills. Each entry maps a real RO skill
ID to this game's combat model:

```ts
{
  power: 140,            // % of ATK or MATK per hit
  kind: "physical" | "magical" | "heal",
  hits: 1,
  target: "enemy" | "self" | "allEnemies",
  cooldownMs: 6000,
  castMs: 0,
  tier: 1 | 2 | 3,
  status?: { kind, chance, durationMs, magnitude },
  healBasis?: "matk" | "maxHp"
}
```

Skills not in this table are ignored. This is deliberate: RO mob skill tables are full of
teleports, summons and self-destructs that make no sense in a duel.

### Construction

1. Collect the species' rows from `re` + `pre-re` where `State ∈ {attack, idle, any}` and
   `Target ∈ {target, self, around1..8}` and the skill is in the curated table.
2. Keep the highest-rate/highest-level row per skill.
3. Take up to four native offensive and two native support skills.
4. If offence is below four, pad with the element kit, then the neutral pool, then every
   curated offensive skill.
5. If support is below two, pad with the element kit, then every curated support skill.
6. Fill any remaining slots from the global curated pool. The build fails if six unique
   skills cannot be reached.
7. Group offence first so the default loadout (first three attacks + first support) is
   predictable in the UI.

`baseLevel` comes from `mob_skill_db` (clamped 1–10) for native skills; padded skills start
at level 1. At runtime the pet's rarity adds 0–4 levels.

### Element archetypes

Each of the ten elements has a four-skill padding kit. The mob-native element attacks are
used where they exist (`NPC_WATERATTACK` 184, `NPC_GROUNDATTACK` 185, `NPC_FIREATTACK` 186,
`NPC_WINDATTACK` 187, `NPC_POISONATTACK` 188, `NPC_HOLYATTACK` 189,
`NPC_DARKNESSATTACK` 190, `NPC_TELEKINESISATTACK` 191, `NPC_UNDEADATTACK` 347).

---

## 5. Playability filter

A monster becomes a pet only if it is a real field monster:

```
playable = !junk && (has spawn maps || is MVP)

junk names : /dummy|ringlead|elusive|swift|solid|furious/i
junk aegis : /^(S_|C\d_|EMPERIUM|GUARDIAN_|TREASURE_BOX|BARRIER|_DUMMY)/i
```

This removes test dummies, champion variants (`C1_`, `C5_`, "Swift …"), summons and scripted
structures. Instance-only MVPs are kept because they are legitimate bosses.

Result: **867 playable** of 2,675 parsed. The excluded rows remain available through the
bestiary API by ID but cannot be hatched or encountered.

---

## 6. Spawn maps

`npc/re/mobs/**/*.txt` is parsed with:

```
^([A-Za-z0-9_@]+),-?\d+,-?\d+(?:,[^\t]*)?\t(?:boss_)?monster\t([^\t]*)\t(\d+),(-?\d+)
```

Amounts are summed per map and the top three maps are kept. They power:

- the bestiary "spawn maps" section,
- the arena backdrop (`/api/map/:map`),
- the map proxy's allow-list.

730 of the 867 playable species have at least one spawn map; the rest are MVPs without
open-world spawn scripts.

---

## 7. Outputs

`data/generated/` is **gitignored** and rebuilt from the pinned source.

### `species.json` (array)

```ts
{
  id, aegisName, name, tier, level,
  element, elementLevel, race, raceName, size, sizeName,
  mvp, boss, playable,
  base: { hp, atk, matk, def, mdef, aspdMs, str, agi, vit, int, dex, luk },
  skills: [{ id, baseLevel }, ...6],
  spawnMaps: string[]
}
```

### `skills.json` (id → skill)

```ts
{
  id, name, displayName, element: ElementId | null,
  kind, target, hits, power, cooldownMs, castMs,
  tier, status: StatusEffect | null, iconId, healBasis
}
```

### `attr-fix.json`

```
{ "1".."4": { "<attacker element>": { "<defender element>": percent } } }
```

### `manifest.json`

Counts, tier thresholds, tier histogram, races, elements, source SHA, generation timestamp.

---

## 8. Validation

`scripts/validate-bestiary.ts` fails the build on:

- fewer than 2,000 parsed species or fewer than 800 playable species
- any playable species with no spawn map that is not an MVP
- any dummy in the playable pool
- a species without exactly six skills, fewer than four offensive skills, or more than two
  support skills; or a skill ID missing from `skills.json`
- duplicate species IDs or duplicate skills within a kit
- stats outside their expected bands (HP 300–5,000; ATK/MATK 60–1,200; DEF/MDEF 0–300;
  ASPD 450–2,200 ms; core stats 20–120)
- an incomplete attribute chart (4 levels × 10 × 10)
- chart sanity values: Water vs Fire = 150, Ghost vs Neutral = 90

Warnings (not failures) report species with no spawn maps and kits with more than one
support skill.

---

## 9. Commands

```bash
npm run data:build      # rebuild from the cached pinned snapshot
npm run data:validate   # assert all invariants
npm run data:refresh    # force re-download of the pinned snapshot
npm run balance         # headless battle pacing sweep over generated data
```

### Bumping rAthena

1. Edit `RATHENA_SHA` in `scripts/rathena.pin.ts`.
2. `npm run data:refresh && npm run data:build && npm run data:validate`
3. `npm test` and `npm run balance`
4. Commit the new pinned SHA (generated data stays untracked).

---

## 10. Licensing

rAthena data is **GPL-3.0**. The repository does not commit the generated files; it commits
the pipeline and the pinned SHA, which is the reproducible source. If you redistribute the
generated data, retain the rAthena attribution and comply with the GPL. See
[NOTICE.md](../NOTICE.md).
