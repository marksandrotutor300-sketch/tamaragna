# Game design & specs

This document describes what the game actually does, with the tuned numbers from the
shipped code. Every formula is implemented in `src/lib/game/` or `src/lib/sim/`.

---

## 1. Core loop

1. **Hatch** an egg → a species, rarity and six IVs are rolled.
2. **Care** for the pet → hunger, mood, energy and friendship, which modify combat.
3. **Train / battle** → EXP and levels.
4. **Climb** the endless tower or **duel** other players' ghost teams for coins and rating.
5. **Collect** rarer species and better individual rolls; spend coins on care and eggs.

---

## 2. Species and tiers

Every playable species has a permanent **tier (1–5)** used for hatch weighting.

```
MVP flag                         → tier 5
Boss class                       → tier 4
level >= p95 of non-boss mobs    → tier 5
level >= p75                     → tier 4
level >= p50                     → tier 3
level >= p25                     → tier 2
otherwise                        → tier 1
```

Cutoffs are recomputed whenever the bestiary is rebuilt (currently p25 = 59, p50 = 99,
p75 = 128, p95 = 182). The tier is shown on the card but does **not** directly change
stats — individual rarity and IVs do.

A species is **playable** when it is not a test dummy / champion variant / scripted
structure, and it either has at least one spawn map or is an MVP. 867 of 2,675 monsters
qualify.

---

## 3. Individual rarity

Each hatched pet rolls one of five rarities:

| Rarity | Stat multiplier | IV floor | Skill-level bonus | Accent |
| --- | ---: | ---: | ---: | --- |
| Common | ×1.00 | 0 | +0 | grey |
| Uncommon | ×1.03 | 5 | +1 | green |
| Rare | ×1.06 | 10 | +2 | blue |
| Epic | ×1.10 | 16 | +3 | purple |
| Legendary | ×1.15 | 22 | +4 | gold |

Hatch rarity weights are applied per **species tier**:

| Species tier | Common | Uncommon | Rare | Epic | Legendary |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 55% | 28% | 12% | 4.5% | 0.5% |
| 2 | 40% | 30% | 19% | 9% | 2% |
| 3 | 10% | 22% | 33% | 25% | 10% |
| 4 | 5% | 14% | 26% | 33% | 22% |
| 5 | 0% | 0% | 10% | 30% | 60% |

Every species can technically hatch Legendary — a lucky Poring is the chase moment.

### Individual values (IVs)

Six stats — STR, AGI, VIT, INT, DEX, LUK — each rolled `0..31` using the rarity floor.
The total (0–186) is the pet's "individuality score". IVs never change.

---

## 4. Effective stats

Base species stats come from the data pipeline (see
[DATA-PIPELINE.md](DATA-PIPELINE.md)). At runtime:

```
levelMult = 1 + 0.02 × (level − 1)                     // level 1..50
rarityMult = RARITY[rarity].statMult
starMult  = 1 + 0.04 × (star − 1)                      // star 1..5
nature.*  = 1.1 for the nature's up stat, 0.9 for its down stat

hpMax   = floor(hpBase   × rarityMult × levelMult × (1 + iv.vit / 200) × care.hp × starMult)
atk     = floor(atkBase  × rarityMult × levelMult × (1 + iv.str / 150) × care.atk × nature.atk × starMult)
matk    = floor(matkBase × rarityMult × levelMult × (1 + iv.int / 150) × care.atk × nature.matk × starMult)
def     = floor(defBase  × rarityMult × levelMult × (1 + iv.vit / 200) × nature.def × starMult)
mdef    = floor(mdefBase × rarityMult × levelMult × (1 + iv.int / 200) × nature.mdef × starMult)
aspdMs  = clamp(baseAspdMs / (1 + (base.agi + iv.agi×2) / 500) × nature.aspdMs, 350, 2400)
crit%   = clamp(0.02 + (base.luk + iv.luk×2)/1200 + care.crit, 0, 35%)
critMul = 1.35 + (base.dex + iv.dex×2)/1000
resist  = clamp((vit × 0.4 + luk × 0.25) / 500, 0, 0.35)
```

Natures and stars are covered in [Genetics](#13-genetics). Team synergies are applied after
these formulas in `teamToCombatants`, so they are already present in battle payloads and PvP
snapshots.

Lower `aspdMs` is faster. The roster "power" number is a rough sort key:

```
power = hp×0.5 + atk×2 + matk×1.5 + def×3 + mdef×2 + (2400 − aspdMs)×0.4
```

---

## 5. Skills

Every species has **exactly six skills**: up to four offensive and two support. They are
built from the monster's real `mob_skill_db` rows filtered through a curated 64-skill
combat table, padded by element archetype skills and then the global curated pool.

Each pet equips **four of the six**. The default is the first three offensive skills plus
the first support; the loadout is stored per pet and used for every battle. Only those four
appear in the arena, so the battle payload and engine stay at four slots.

### Skill levels

```
skillLevel = clamp(baseLevel + rarityBonus, 1, 10)      // baseLevel comes from the mob data (1..10)
```

### Skill power

```
power = round(basePower × (1 + 0.08 × (level − 1)) × tierScale[skill.tier])

tierScale = tier 1: 1.5 · tier 2: 1.75 · tier 3: 2.0
cooldown  = max(1500ms, baseCooldown − 120ms × (level − 1))
```

`basePower` is a percentage of ATK (physical) or MATK (magical). A basic attack is 100%.
Status chance scales by 3% per skill level, capped at 90%.

Skills can be:

- **single target** (the opposing active pet),
- **all enemies** (every living pet on the other side, including the bench),
- **self** (heal or buff).

Heals use MATK × power, or max HP × power for `NPC_ALLHEAL`. Heal skills are support
skills and are selected by the AI below 45% HP.

---

## 6. Elements

Ten elements: Neutral, Water, Earth, Fire, Wind, Poison, Holy, Dark, Ghost, Undead.

The raw multiplier comes from rAthena's `attr_fix.yml` at the attacker's element level
(1–4). Because a 150%/50% swing decides a 1v1 before stats matter, battle damage uses a
compressed value:

```
battleMult = clamp(1 + (raw − 1) × 0.55, 0.4, 1.45)
```

So Water vs Fire is 1.275× and Fire vs Water is 0.725× — readable rock-paper-scissors
without an automatic win. `elementMultiplier()` still exposes the raw chart for tests and
tooltips.

---

## 7. Battle rules

### Clock

- Fixed **50 ms tick**; hard cap **180 s**.
- On timeout the side with the higher remaining team-HP fraction wins; a tie is a draw.

### ATB

```
atb += 50 / effectiveAspdMs
effectiveAspdMs = clamp(baseAspdMs × (1 + slow − haste), 300, 3000)   // slow/haste capped at 0.5 each
```

At `atb >= 1` the pet makes a basic attack (100% ATK, its own element) and resets to 0.

### Skills

- Per-skill cooldown and an **800 ms global lock** after any skill fires.
- A skill with a cast time starts a cast; the cooldown is consumed at cast start.
- A **stun interrupts a cast**.
- Player presses are queued. A queued skill fires on the first tick it is legal, which makes
  input timing tolerant of frame jitter and deterministic in replay.

### Swapping

- 6 s cooldown between swaps; the incoming pet starts at 0 ATB.
- A faint forces a swap with no cooldown (the 6 s cooldown still applies to the next manual swap).
- The side loses when all three pets are down.

### Damage

```
attack   = atk (physical) or matk (magical), × (1 + atkUp)
defense  = def or mdef, × (1 + defUp − defDown)
raw      = attack × power / 100
mitigate = 1 − defense / (defense + 500)
damage   = max(1, floor(raw × elementMult × mitigate × critMult × (1 − shield) × luck × variance))
```

- `shield` is capped at 60% reduction.
- `crit` chance comes from stats; `critMult` is the stat-derived multiplier.
- `variance` is 0.9–1.1 per hit; each multi-hit and each crit rolls independently.
- `luck` is a per-side, per-battle multiplier in **0.92–1.08**, derived from the seed. It
  exists because otherwise any consistent stat edge wins every deterministic fight.

### Statuses

Applied on hit with a per-skill chance, at most **6 per pet**, same-kind refreshes duration
and keeps the stronger magnitude:

| Status | Effect |
| --- | --- |
| poison | `magnitude × maxHp` damage every 1 s while active |
| stun | cannot fill ATB or cast; interrupts a cast |
| slow | +magnitude to attack interval |
| haste | −magnitude to attack interval |
| atkUp | +magnitude ATK/MATK |
| defUp | +magnitude DEF/MDEF |
| defDown | −magnitude DEF/MDEF |
| shield | −magnitude incoming damage (max 0.6) |

Statuses tick only on the **active** pet, so a swap pauses a debuff rather than letting the
bench die to poison. AoE still damages and can debuff the bench.

### AI (auto mode and all defenders)

Deterministic priority, evaluated every 350 ms:

1. Swap out below 25% HP if a bench pet is above 55%.
2. Heal below 45% HP if a heal is off cooldown.
3. Use the offensive skill with the highest expected damage
   (`power × hits × element multiplier`, AoE weighted by living targets).
4. Otherwise use an unused self-buff.
5. Otherwise basic attacks continue automatically.

---

## 8. Endless Tower

| Setting | Value |
| --- | --- |
| Enemies per wave | 1 (waves 1–4), 2 (5–9), 3 (10+) |
| Enemy level | `clamp(teamLevel + floor(wave/2) − 1, 1, 80)` |
| Enemy rarity | `min(5, 1 + floor(wave/15))` |
| Stat multiplier | `(boss ? 1.15 : 1) × (1 + 0.035 × (wave − 1))` |
| HP multiplier | `(boss ? 1.15 : 1) × (1 + 0.05 × (wave − 1))` |
| Boss wave | every 10th wave, drawn from playable MVPs |
| Elite waves | every 5th wave carries one affix; every 10th carries two |
| Draft | after a cleared wave with no pending battle, choose 1 of 3 blessings |
| Between waves | heal 25% of max HP |
| Wave seed | `checksum(runSeed + ":wave:" + wave)` |
| Run seed | server-generated UUID, never sent to the client |
| Rewards | coins `20 + 4×wave`, EXP `15 + 3×wave`; eggs at waves 10/25/50/100/200 |

The team is snapshotted at run start. Levels gained during a run apply to the live pets but
not to the run's snapshot, so a run tests the team you entered with. HP carries over; a
wipe or abandon ends the run. The leaderboard sorts by highest cleared wave, then total
elapsed time.

The auto/manual flag is applied to the pending wave even if the wave was already generated,
so the toggle is authoritative without rerolling enemies.

Waves 1–4 force **Hardy** and zero IVs on enemies, so a fresh level-1 pet can reliably clear
the opening. Later waves roll both, adding variety once the player has a team.

Elite affixes are stat-only and shown beside the enemy name: Fierce (+15% ATK/MATK), Tough
(+20% DEF/MDEF), Vital (+20% HP), Brutal (+25% ATK/MATK, −10% DEF/MDEF). Draft blessings are
run-scoped: Fury (+10% ATK/MATK), Bulwark (+15% DEF/MDEF), Vitality (+15% HP), Alacrity (+10%
attack speed), Focus (+5% crit). They are applied to the run's team before the next wave and
stored per wave.

---

## 9. Async PvP

- Entering the arena snapshots your current team. The snapshot refuses to go stale: it is
  refreshed after pet edits, training, hatching, and every battle result.
- Matchmaking picks among the five closest ratings within ±150, excluding yourself. If no
  one is in range, it widens to the closest snapshots regardless of distance rather than
  leaving the player with no opponent.
- You play offence; the defender's team is always AI-controlled.
- Rating: start 1000, **K = 24**, score 1 / 0.5 / 0. A draw is possible on timeout.
- Rewards: win 60 coins + 40 EXP, loss 20 coins + 15 EXP.
- **Placements:** the first 5 PvP results of a season use **K = 40**; after that, K = 24.
- **Tiers:** Bronze < 1100, Silver 1100, Gold 1250, Platinum 1400, Diamond 1550.
- **Season rewards:** tier coins/eggs plus 5 coins per best tower wave (capped at 300),
  written at rollover and claimed manually from the arena screen.
- History keeps the last 20 duels.
- Submission is rate-limited to one per 2 seconds per profile.

---

## 10. Tamagotchi care

Values are `0..100`, evaluated lazily from `lastCareAt` on every read — nothing ticks in the
background. Offline decay is capped at **36 hours**.

| Stat | Decay | Notes |
| --- | --- | --- |
| Hunger | −4 / hour | halved while sleeping |
| Energy | −6 / hour; +8 / hour asleep | |
| Mood | −3 / hour | |
| Friendship | never decays | grows through care and training |

| Action | Cost | Effect |
| --- | ---: | --- |
| Feed | 20 coins | +30 hunger, +1 friendship |
| Play | 10 coins | +15 mood, −10 energy, +1 friendship (needs ≥10 energy) |
| Train | 30 coins | −20 energy, +25 EXP, +1 friendship (needs ≥10 energy) |
| Rest / Wake | free | toggles sleep |

Combat modifiers:

```
care.atk  = hunger >= 70 ? 1.00 : hunger >= 40 ? 0.95 : 0.88
care.crit = mood >= 70 ? +0.05 : mood < 30 ? −0.05 : 0
care.hp   = friendship >= 80 ? 1.05 : 1.00
```

These are surfaced verbatim on the ranch sheet so neglect is legible.

---

## 11. Leveling

```
EXP to next level = floor(80 × level^1.5)
Max level = 50
```

Sources: practice battles (30 win / 10 loss), PvP (40 / 15), tower waves
(`15 + 3×wave`), training (+25). Each level adds 2% to all base stats through `levelMult`.

---

## 12. Hatching and eggs

| Egg | Cost | Behavior |
| --- | ---: | --- |
| Wild Egg | 1 egg | Any playable species |
| Focused Egg | 2 eggs | Any playable species of a chosen element |

Species weighting inside an egg (by species tier):

```
tier 1: 50 · tier 2: 25 · tier 3: 14 · tier 4: 8 · tier 5: 3
```

A hatched pet starts at level 1, full-ish care (80/80/80/20), and is placed in the first
free team slot; otherwise it goes to storage. Every hatch also rolls one of eight natures
and starts at 1★. The ranch holds up to 30 pets. Every profile starts with 1 egg and 500
coins.

Three **featured species** rotate deterministically each UTC day and receive 3× weight in
Wild Eggs. Focused Eggs are unaffected.

---

## 13. Genetics

### Natures

Every pet rolls one nature at hatch (uniform 1/8). A nature raises one stat by 10% and
lowers another by 10%; Hardy is neutral. For `aspdMs`, "up" means ×0.9 (faster) and "down"
×1.1.

| Nature | +10% | −10% |
| --- | --- | --- |
| Hardy | — | — |
| Brave | ATK | attack speed |
| Bold | DEF | ATK |
| Timid | attack speed | ATK |
| Modest | MATK | ATK |
| Calm | MDEF | ATK |
| Jolly | attack speed | MATK |
| Adamant | ATK | MATK |

Natures are inherited through breeding. A reroll costs **300 coins** and always lands on a
different nature.

### Awakening (stars)

Pets start at 1★ and can reach 5★ by merging a duplicate of the same species.

| Rule | Value |
| --- | --- |
| Stat bonus | +4% HP/ATK/MATK/DEF/MDEF per star (max +16%) |
| Cost | `150 × current star` coins |
| Fodder | same species, in storage, star ≤ target |
| Result | target star +1; fodder deleted |

### Breeding

Two pets at level 10+ produce a child for **2 eggs + 250 coins**.

| Trait | Rule |
| --- | --- |
| Species | Parent A's species line |
| IVs | Each stat inherits from A or B (50/50), then a 12% chance of ±3, clamped 0–31 |
| Rarity | 55% the better parent, 30% one step lower, 15% one step higher |
| Nature | 45% A, 45% B, 10% uniform random |
| Start | Level 1, 1★, default care |

Breeding never consumes the parents. It is the long-term way to concentrate high IVs and
pass a good nature down a line.

### Team synergies

Composition bonuses are derived from the active team and baked into combatants at battle
creation, so the client and server always agree.

| Synergy | Trigger | Effect |
| --- | --- | --- |
| Elemental Focus | 2+ pets share an element | +5% ATK/MATK for that element (8% at 3) |
| Kindred | 2+ pets share a race | +8% DEF/MDEF for that race |
| Mixed Company | 3 pets, 3 different races | +5% max HP for the team |

A one-pet team has no synergies. At most one element focus and one race bond activate.

### Status resistance

VIT and LUK give a chance to shrug off enemy status effects:

```
statusResist = clamp((VIT × 0.4 + LUK × 0.25) / 500, 0, 0.35)
```

The engine multiplies an enemy skill's status chance by `1 − statusResist`. Self-buffs are
never resisted.

### Skill loadouts

Each pet stores four of its six species skills. The default is the first three attacks plus
one support. Change the loadout on the team screen; the selected order becomes the four
arena buttons. The stored `CombatantInit` contains only those four, so the deterministic
engine and replay are unchanged.

---

## 14. Economy

| Source | Amount |
| --- | --- |
| New profile | 500 coins, 1 egg |
| Practice win / loss | 25 / 8 coins, 30 / 10 EXP |
| PvP win / loss | 60 / 20 coins, 40 / 15 EXP |
| Tower wave | `20 + 4×wave` coins, `15 + 3×wave` EXP |
| Egg rewards | tower waves 10/25/50/100/200 |
| Daily / weekly quests | 50–100 / 300–400 coins, occasional eggs |
| Login streak | `50 + 10×min(streak,10)` coins; egg at 7/14/21/28 |
| Season rewards | tier coins/eggs + up to 300 tower bonus coins |

| Sink | Amount |
| --- | --- |
| Feed / Play / Train | 20 / 10 / 30 coins |
| Hatch | 1–2 eggs |
| Breeding | 2 eggs + 250 coins |
| Awakening | `150 × current star` coins |
| Nature reroll | 300 coins |

---

## 15. Balance targets and observed pacing

From `npm run balance` (AI vs AI, zero IVs, rarity 3):

| Matchup | Median | Notes |
| --- | ---: | --- |
| 1v1, level 1–50 | 7–9 s | close matchups can swing either way |
| 3v3, level 10–30 | 20–22 s | health carry-over makes 3v3 the main mode |
| Mirror 3v3 (200 runs) | 111 / 89 | no meaningful side bias |
| Rarity 3 vs 4, same species | ~6 / 94 | rarity is a real advantage, not a coin flip |

Design intent: a fight should be long enough to read the skills, short enough for a mobile
session, and decided by team composition, elements and rarity rather than luck.

---

## 16. Tuning knobs

| Knob | File |
| --- | --- |
| Rarity table, hatch weights | `src/lib/game/rarity.ts` |
| Stat formulas, level cap, power score | `src/lib/game/stats.ts` |
| Skill power scale, cooldown reduction, loadout size/default | `src/lib/game/skills.ts` |
| Damage, mitigation, element compression | `src/lib/sim/damage.ts`, `src/lib/game/combat-data.ts` |
| Tick, time limit, swap/lock timers, AI cadence | `src/lib/sim/engine.ts` |
| AI priorities | `src/lib/sim/ai.ts` |
| Care decay, cap, action effects | `src/lib/game/care.ts` |
| EXP curve | `src/lib/game/leveling.ts` |
| Tower scaling and rewards | `src/lib/game/tower.ts` |
| PvP Elo | `src/lib/game/pvp.ts` |
| Egg costs, species weights | `src/lib/game/eggs.ts`, `src/lib/game/hatch.ts` |
| Natures and multipliers | `src/lib/game/nature.ts` |
| Star bonus and awakening cost | `src/lib/game/awakening.ts` |
| Breeding rules and cost | `src/lib/game/breeding.ts` |
| Team synergies | `src/lib/game/synergy.ts` |
| Status resistance | `src/lib/game/stats.ts` |
| Daily/weekly quests and login streak | `src/lib/game/quests.ts`, `quest-service.ts` |
| Season tiers, rewards and placement K | `src/lib/game/season.ts` |
| Featured species rotation | `src/lib/game/featured.ts` |
| Tower blessings and elite affixes | `src/lib/game/blessings.ts`, `affixes.ts`, `modifiers.ts` |
| Season rollover | `scripts/season-roll.ts` |
| Curated skills and archetype kits | `scripts/whitelist/skill-effects.ts` |
| Species normalization and tiers | `scripts/build-bestiary.ts` |

---

## 17. Season 1 living content

### Daily and weekly quests

| Quest | Event | Target | Reward |
| --- | --- | ---: | --- |
| Tender care (daily) | Feed/play/train | 3 | 60 coins |
| Winning mood (daily) | Win any battle | 2 | 80 coins |
| Climb three (daily) | Clear tower waves | 3 | 100 coins |
| New friend (daily) | Hatch | 1 | 50 coins |
| Duelist (weekly) | Win any battle | 10 | 300 coins + 1 egg |
| Tower climber (weekly) | Clear tower waves | 15 | 400 coins |
| Ranch growth (weekly) | Hatch | 5 | 300 coins + 1 egg |

Progress resets by **UTC day** and **Monday UTC week**. Claims are idempotent. Quest progress
is recorded from care actions, hatches, battle wins (all modes) and cleared tower waves; a
failure to record progress never fails the primary action.

### Login streak

Claim once per UTC day. Consecutive days increment the streak; a missed day resets it.
Reward: `50 + 10 × min(streak, 10)` coins, plus 1 egg at days 7, 14, 21 and 28.

### Seasons and placements

- The current season is the highest season in use; new profiles join it automatically.
- The first **5 PvP results** of a season are placements and use K = 40; afterwards K = 24.
- Tiers: Bronze < 1100, Silver 1100, Gold 1250, Platinum 1400, Diamond 1550.
- Season rewards = tier coins/eggs + 5 coins per best tower wave (cap 300), written by
  `npm run season:roll`.
- Rollover closes the season, awards every profile, resets rating/placements, opens the next
  season and ends active tower runs. Run it with the server stopped, once per season.

### Featured species

Three deterministic species per UTC day receive 3× weight in Wild Eggs; Focused Eggs are
unaffected. The hatch screen lists them.

### Tower draft and elite affixes

Every fifth wave is elite (one affix); every tenth is an MVP with two. After a cleared wave
with no pending battle, the player picks one of three run-scoped blessings before the next
wave. Both systems are detailed in [section 8](#8-endless-tower).

## 18. Rift Deck

A turn-based card roguelike side mode, separate from the ATB battle engine.

- **Squad and deck.** Exactly three team pets become champions. Each contributes its four
  equipped skills; the starter deck is 12 cards. Editing a pet mid-run does not change the run
  snapshot. A champion's cards exhaust when that champion falls.
- **Combat.** Three champions versus one to three enemies. Start with 3 energy and 5 cards;
  draw 5 at the start of each turn. Cards cost 0–3; block is per champion and clears at turn
  start. Enemy intents are visible.
- **Cards.** All 64 curated skills become skill cards, plus 16 original neutral cards. Damage
  uses champion ATK/MATK, element multipliers, defense mitigation, block, weak/vulnerable and
  card statuses. Card upgrades reduce cost and raise effect values.
- **Run.** Three acts, 10–12 floors each, branching 1–3 node floors. Battle, elite, event,
  rest, shop, treasure and boss nodes. Clearing the third boss wins.
- **Rewards.** Act-filtered card drafts, relics, run gold, rest upgrades/removal, shops and six
  events. Run gold is separate from main coins.
- **Persistence.** `card_runs` stores the full run; `card_battles` stores the current
  server-authoritative state and action version. One active run per profile. Reloading resumes
  the exact state.
- **Main rewards.** Win 450 coins / 8 materials / 1 egg / 120 EXP per squad pet; loss 120 / 3 /
  40 EXP; abandon pays nothing. UTC daily cap 1,350 coins / 24 materials / 1 egg.
- **Content limits.** PvE only at launch; no persistent card collection; existing sprites and
  skill icons only. Full rules and API are in [RIFT-DECK.md](RIFT-DECK.md).
- **Advanced upgrades.** Ascension A1–A5, Signature card fusion, evolved `+` relics, five
  Rift Paths and five permanent Rift Edicts bought with run-earned essence.
