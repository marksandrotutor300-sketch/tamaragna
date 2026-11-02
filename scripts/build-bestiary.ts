import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { RATHENA_SHA } from "./rathena.pin";
import {
  ELEMENT_KITS,
  ELEMENT_NAMES,
  NEUTRAL_PAD_KIT,
  RACE_NAMES,
  SKILL_EFFECTS,
  SKILL_ELEMENT_OVERRIDE,
  SIZE_NAMES,
  type ElementId,
  type SkillEffect,
} from "./whitelist/skill-effects";

const CACHE_ROOT = path.join(process.cwd(), ".cache", "rathena", RATHENA_SHA);
const OUT_DIR = path.join(process.cwd(), "data", "generated");

// ---------------------------------------------------------------- raw schemas

type MobYaml = {
  Header: { Type: string; Version: number };
  Body: Array<Record<string, unknown>>;
};

type SkillYaml = {
  Header: { Type: string; Version: number };
  Body: Array<{
    Id: number;
    Name: string;
    Description?: string;
    MaxLevel?: number;
    Type?: string;
    TargetType?: string;
    Element?: string | Array<{ Level: number; Element: string }>;
  }>;
};

type AttrFixYaml = {
  Header: { Type: string; Version: number };
  Body: Array<Record<string, unknown>>;
};

type MobSkillRow = {
  mobId: number;
  state: string;
  skillId: number;
  skillLevel: number;
  rate: number;
};

export type GeneratedSkill = {
  id: number;
  name: string;
  displayName: string;
  element: ElementId | null;
  kind: "physical" | "magical" | "heal";
  target: "enemy" | "self" | "allEnemies";
  hits: number;
  power: number;
  cooldownMs: number;
  castMs: number;
  tier: 1 | 2 | 3;
  status: SkillEffect["status"] | null;
  iconId: number;
  healBasis: "matk" | "maxHp" | null;
};

export type GeneratedSpecies = {
  id: number;
  aegisName: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5;
  level: number;
  element: ElementId;
  elementLevel: number;
  race: number;
  raceName: string;
  size: number;
  sizeName: string;
  mvp: boolean;
  boss: boolean;
  playable: boolean;
  base: {
    hp: number;
    atk: number;
    matk: number;
    def: number;
    mdef: number;
    aspdMs: number;
    str: number;
    agi: number;
    vit: number;
    int: number;
    dex: number;
    luk: number;
  };
  skills: Array<{ id: number; baseLevel: number }>;
  spawnMaps: string[];
};

// ----------------------------------------------------------------- normalization

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Raw RO stats span five orders of magnitude (Poring has 55 HP, an MVP has
 * hundreds of thousands), so they cannot be used directly. Every species is
 * projected onto a shared combat budget instead: HP and ATK move together so a
 * monster can never one-shot a peer of the same level.
 */
function combatPower(hp: number, maxRawHp: number): number {
  return clamp(Math.log(1 + Math.max(0, hp)) / Math.log(1 + Math.max(1000, maxRawHp)), 0, 1);
}

function normalizeCombat(
  mob: Record<string, unknown>,
  tier: number,
  maxRawHp: number,
): { hp: number; atk: number; def: number; mdef: number } {
  const t = combatPower(num(mob.Hp, 1), maxRawHp);
  const speciesFactor = 0.8 + 0.5 * t;
  const tierFactor = 1 + 0.1 * (tier - 1);
  const hp = Math.round(1500 * speciesFactor * tierFactor);
  const atk = Math.round(85 * speciesFactor * tierFactor);
  const def = Math.round((30 + 130 * t) * tierFactor);
  const mdefT = clamp(
    Math.log(1 + Math.max(0, num(mob.MagicDefense, 0))) / Math.log(1001),
    0,
    1,
  );
  const mdef = Math.round((30 + 130 * mdefT) * tierFactor);
  return { hp, atk, def, mdef };
}

function normCoreStat(value: number): number {
  if (value <= 0) return 20;
  return clamp(Math.round(20 + (100 * Math.log(1 + value)) / Math.log(201)), 20, 120);
}

function normAspd(attackDelay: number): number {
  if (attackDelay <= 0) return 1400;
  return clamp(Math.round(attackDelay * 0.55), 450, 2200);
}

// ---------------------------------------------------------------------- parsing

function parseMobSkillFile(text: string): MobSkillRow[] {
  const rows: MobSkillRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const cols = line.split(",");
    if (cols.length < 12) continue;
    const mobId = Number(cols[0]);
    // negative ids are global skill rules, not real monsters
    if (!Number.isFinite(mobId) || mobId < 0) continue;
    const skillId = Number(cols[3]);
    if (!Number.isFinite(skillId) || !SKILL_EFFECTS[skillId]) continue;
    rows.push({
      mobId,
      state: cols[2],
      skillId,
      skillLevel: Number(cols[4]) || 1,
      rate: Number(cols[5]) || 0,
    });
  }
  return rows;
}

const USABLE_STATES = new Set(["attack", "idle", "any"]);
const USABLE_TARGETS = new Set([
  "target",
  "self",
  "around",
  "around1",
  "around2",
  "around3",
  "around4",
  "around5",
  "around6",
  "around7",
  "around8",
]);

type SpawnIndex = Map<number, Map<string, number>>;

function parseSpawnScripts(files: Array<{ path: string; text: string }>): SpawnIndex {
  const index: SpawnIndex = new Map();
  const monsterLine = /^([A-Za-z0-9_@]+),-?\d+,-?\d+(?:,[^\t]*)?\t(?:boss_)?monster\t([^\t]*)\t(\d+),(-?\d+)/;

  for (const { text } of files) {
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("//")) continue;
      const match = monsterLine.exec(line);
      if (!match) continue;
      const map = match[1];
      const mobId = Number(match[3]);
      const amount = Number(match[4]) || 1;
      if (!Number.isFinite(mobId) || mobId <= 0) continue;
      let maps = index.get(mobId);
      if (!maps) {
        maps = new Map();
        index.set(mobId, maps);
      }
      maps.set(map, (maps.get(map) ?? 0) + Math.max(1, amount));
    }
  }
  return index;
}

// --------------------------------------------------------------------- builders

type TierThresholds = { p25: number; p50: number; p75: number; p95: number };

/**
 * Renewal monster levels are heavily skewed (median 100), so fixed cutoffs
 * would put most of the bestiary in one tier. Cutoffs are the quartiles of the
 * non-boss population and are baked into the output manifest.
 */
function computeTierThresholds(mobs: Array<Record<string, unknown>>): TierThresholds {
  const levels = mobs
    .filter((mob) => {
      const modes = (mob.Modes ?? {}) as Record<string, boolean>;
      return !modes.Mvp && (mob.Class ?? "Normal") !== "Boss";
    })
    .map((mob) => Math.max(1, num(mob.Level, 1)))
    .sort((a, b) => a - b);

  const at = (p: number) => levels[Math.min(levels.length - 1, Math.floor(levels.length * p))] ?? 1;
  return { p25: at(0.25), p50: at(0.5), p75: at(0.75), p95: at(0.95) };
}

function speciesTier(mob: Record<string, unknown>, t: TierThresholds): 1 | 2 | 3 | 4 | 5 {
  const modes = (mob.Modes ?? {}) as Record<string, boolean>;
  const cls = typeof mob.Class === "string" ? mob.Class : "Normal";
  const level = Math.max(1, num(mob.Level, 1));
  if (modes.Mvp) return 5;
  if (cls === "Boss") return 4;
  if (level >= t.p95) return 5;
  if (level >= t.p75) return 4;
  if (level >= t.p50) return 3;
  if (level >= t.p25) return 2;
  return 1;
}

const JUNK_NAME = /dummy|ringlead|elusive|swift|solid|furious/i;
const JUNK_AEGIS = /^(S_|C\d_|EMPERIUM|GUARDIAN_|TREASURE_BOX|BARRIER|_DUMMY)/i;

/**
 * Keep the collectible pool to real field monsters. Test dummies, champion
 * variants and scripted structures make terrible pets.
 */
function isPlayable(mob: Record<string, unknown>, spawnMaps: string[], mvp: boolean): boolean {
  const name = typeof mob.Name === "string" ? mob.Name : "";
  const aegis = typeof mob.AegisName === "string" ? mob.AegisName : "";
  if (JUNK_NAME.test(name) || JUNK_AEGIS.test(aegis)) return false;
  return spawnMaps.length > 0 || mvp;
}

const MAX_KIT_SKILLS = 6;
const MAX_OFFENSIVE_SKILLS = 4;
const MAX_SUPPORT_SKILLS = 2;

function isSupportSkill(skillId: number): boolean {
  const effect = SKILL_EFFECTS[skillId];
  return effect.target === "self" || effect.kind === "heal";
}

function buildSkillKit(
  speciesId: number,
  element: ElementId,
  rows: MobSkillRow[],
): Array<{ id: number; baseLevel: number }> {
  const best = new Map<number, MobSkillRow>();
  for (const row of rows) {
    if (row.mobId !== speciesId) continue;
    if (!USABLE_STATES.has(row.state)) continue;
    const existing = best.get(row.skillId);
    if (!existing || row.rate > existing.rate || row.skillLevel > existing.skillLevel) {
      best.set(row.skillId, row);
    }
  }

  const all = [...best.values()];
  const offensive = all.filter((row) => !isSupportSkill(row.skillId)).sort((a, b) => b.rate - a.rate);
  const support = all.filter((row) => isSupportSkill(row.skillId)).sort((a, b) => b.rate - a.rate);

  const chosen: Array<{ id: number; baseLevel: number }> = [];
  const seen = new Set<number>();
  const add = (skillId: number, baseLevel = 1) => {
    if (chosen.length >= MAX_KIT_SKILLS || seen.has(skillId)) return;
    seen.add(skillId);
    chosen.push({ id: skillId, baseLevel: clamp(baseLevel, 1, 10) });
  };
  const count = (supportOnly: boolean) =>
    chosen.reduce((sum, slot) => sum + (isSupportSkill(slot.id) === supportOnly ? 1 : 0), 0);

  // Native skills first, keeping four offensive and two support slots.
  for (const row of offensive) {
    if (count(false) >= MAX_OFFENSIVE_SKILLS) break;
    add(row.skillId, row.skillLevel);
  }
  for (const row of support) {
    if (count(true) >= MAX_SUPPORT_SKILLS) break;
    add(row.skillId, row.skillLevel);
  }

  const padOffense = (ids: number[]) => {
    for (const id of ids) {
      if (count(false) >= MAX_OFFENSIVE_SKILLS) break;
      if (!isSupportSkill(id)) add(id);
    }
  };
  const padSupport = (ids: number[]) => {
    for (const id of ids) {
      if (count(true) >= MAX_SUPPORT_SKILLS) break;
      if (isSupportSkill(id)) add(id);
    }
  };

  // Element flavour, then the neutral pool, then every curated skill.
  padOffense(ELEMENT_KITS[element]);
  padOffense(NEUTRAL_PAD_KIT);
  padSupport(ELEMENT_KITS[element]);
  padSupport(NEUTRAL_PAD_KIT);

  const globalIds = Object.keys(SKILL_EFFECTS)
    .map(Number)
    .sort((a, b) => a - b);
  padOffense(globalIds);
  padSupport(globalIds);

  for (const id of globalIds) {
    if (chosen.length >= MAX_KIT_SKILLS) break;
    add(id);
  }

  if (chosen.length !== MAX_KIT_SKILLS) {
    throw new Error(`Could not build a ${MAX_KIT_SKILLS}-skill kit for species ${speciesId}`);
  }

  // Group offense first so the default loadout (first three attacks + one
  // support) is predictable in the UI.
  return [
    ...chosen.filter((slot) => !isSupportSkill(slot.id)),
    ...chosen.filter((slot) => isSupportSkill(slot.id)),
  ];
}

function buildSkills(skillDb: SkillYaml["Body"]): Record<number, GeneratedSkill> {
  const byId = new Map(skillDb.map((skill) => [skill.Id, skill]));
  const out: Record<number, GeneratedSkill> = {};

  for (const [rawId, effect] of Object.entries(SKILL_EFFECTS)) {
    const id = Number(rawId);
    const source = byId.get(id);
    const override = SKILL_ELEMENT_OVERRIDE[id];

    let element: ElementId | null = override ?? null;
    if (element === null && source) {
      const raw = Array.isArray(source.Element) ? source.Element[0]?.Element : source.Element;
      if (typeof raw === "string" && raw !== "Weapon") {
        const idx = ELEMENT_NAMES.indexOf(raw as (typeof ELEMENT_NAMES)[number]);
        if (idx >= 0) element = idx as ElementId;
      }
    }

    out[id] = {
      id,
      name: source?.Name ?? `SKILL_${id}`,
      displayName: source?.Description ?? source?.Name ?? `Skill ${id}`,
      element,
      kind: effect.kind,
      target: effect.target,
      hits: effect.hits,
      power: effect.power,
      cooldownMs: effect.cooldownMs,
      castMs: effect.castMs,
      tier: effect.tier,
      status: effect.status ?? null,
      iconId: id,
      healBasis: effect.healBasis ?? null,
    };
  }

  return out;
}

function buildAttrFix(attr: AttrFixYaml): Record<string, Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, Record<string, number>>> = {};
  for (const level of attr.Body) {
    const levelNum = num(level.Level, 1);
    if (!levelNum) continue;
    const byAttacker: Record<string, Record<string, number>> = {};
    for (const [attacker, defenders] of Object.entries(level)) {
      if (attacker === "Level") continue;
      if (typeof defenders !== "object" || defenders === null) continue;
      const row: Record<string, number> = {};
      for (const [defender, value] of Object.entries(defenders as Record<string, unknown>)) {
        if (typeof value === "number") row[defender] = value;
      }
      byAttacker[attacker] = row;
    }
    out[String(levelNum)] = byAttacker;
  }
  return out;
}

// ------------------------------------------------------------------------- main

async function main(): Promise<void> {
  const read = (relative: string) => readFile(path.join(CACHE_ROOT, relative), "utf8");

  // rAthena ships a couple of duplicate keys in RaceGroups; last-one-wins is fine here.
  const yamlOptions = { uniqueKeys: false, logLevel: "silent" } as const;
  const mobDb = parseYaml(await read("db/re/mob_db.yml"), yamlOptions) as MobYaml;
  const skillDb = parseYaml(await read("db/re/skill_db.yml"), yamlOptions) as SkillYaml;
  const attrFix = parseYaml(await read("db/re/attr_fix.yml"), yamlOptions) as AttrFixYaml;

  if (mobDb.Header?.Type !== "MOB_DB" || mobDb.Header.Version !== 5) {
    throw new Error(`Unexpected mob_db version: ${JSON.stringify(mobDb.Header)}`);
  }
  if (skillDb.Header?.Type !== "SKILL_DB" || skillDb.Header.Version !== 4) {
    throw new Error(`Unexpected skill_db version: ${JSON.stringify(skillDb.Header)}`);
  }

  const reRows = parseMobSkillFile(await read("db/re/mob_skill_db.txt"));
  const preRows = parseMobSkillFile(await read("db/pre-re/mob_skill_db.txt"));
  const skillRows = [...reRows, ...preRows];

  const spawnManifest = JSON.parse(await read("fetch-manifest.json")) as {
    spawnFiles: string[];
  };
  const spawnFiles = await Promise.all(
    spawnManifest.spawnFiles.map(async (relative) => ({ path: relative, text: await read(relative) })),
  );
  const spawnIndex = parseSpawnScripts(spawnFiles);

  const tierThresholds = computeTierThresholds(mobDb.Body);
  const maxRawHp = Math.max(...mobDb.Body.map((mob) => num(mob.Hp, 1)));
  const raceSet = new Set<string>();
  const elementSet = new Set<string>();
  const species: GeneratedSpecies[] = [];

  for (const mob of mobDb.Body) {
    const id = num(mob.Id, 0);
    if (!Number.isFinite(id) || id <= 0) continue;

    const raceName = typeof mob.Race === "string" ? mob.Race : "Formless";
    const sizeName = typeof mob.Size === "string" ? mob.Size : "Small";
    const elementName = typeof mob.Element === "string" ? mob.Element : "Neutral";
    raceSet.add(raceName);
    elementSet.add(elementName);

    const elementIdx = ELEMENT_NAMES.indexOf(elementName as (typeof ELEMENT_NAMES)[number]);
    const element = (elementIdx >= 0 ? elementIdx : 0) as ElementId;
    const raceIdx = RACE_NAMES.indexOf(raceName as (typeof RACE_NAMES)[number]);
    const sizeIdx = SIZE_NAMES.indexOf(sizeName as (typeof SIZE_NAMES)[number]);

    const modes = (mob.Modes ?? {}) as Record<string, boolean>;
    const boss = (typeof mob.Class === "string" ? mob.Class : "Normal") === "Boss";

    const spawnMaps = [...(spawnIndex.get(id)?.entries() ?? [])]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([map]) => map);

    const tier = speciesTier(mob, tierThresholds);
    const combat = normalizeCombat(mob, tier, maxRawHp);

    species.push({
      id,
      aegisName: typeof mob.AegisName === "string" ? mob.AegisName : `MOB_${id}`,
      name: typeof mob.Name === "string" ? mob.Name : `Mob ${id}`,
      tier,
      level: Math.max(1, num(mob.Level, 1)),
      element,
      elementLevel: clamp(num(mob.ElementLevel, 1), 1, 4),
      race: raceIdx >= 0 ? raceIdx : 0,
      raceName,
      size: sizeIdx >= 0 ? sizeIdx : 1,
      sizeName: sizeIdx >= 0 ? sizeName : "Medium",
      mvp: Boolean(modes.Mvp),
      boss,
      playable: isPlayable(mob, spawnMaps, Boolean(modes.Mvp)),
      base: {
        hp: combat.hp,
        atk: combat.atk,
        matk: combat.atk,
        def: combat.def,
        mdef: combat.mdef,
        aspdMs: normAspd(num(mob.AttackDelay, 0)),
        str: normCoreStat(num(mob.Str, 1)),
        agi: normCoreStat(num(mob.Agi, 1)),
        vit: normCoreStat(num(mob.Vit, 1)),
        int: normCoreStat(num(mob.Int, 1)),
        dex: normCoreStat(num(mob.Dex, 1)),
        luk: normCoreStat(num(mob.Luk, 1)),
      },
      skills: buildSkillKit(id, element, skillRows),
      spawnMaps,
    });
  }

  species.sort((a, b) => a.id - b.id);

  const skills = buildSkills(skillDb.Body);
  const elementChart = buildAttrFix(attrFix);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "species.json"), JSON.stringify(species));
  await writeFile(path.join(OUT_DIR, "skills.json"), JSON.stringify(skills));
  await writeFile(path.join(OUT_DIR, "attr-fix.json"), JSON.stringify(elementChart));

  const manifest = {
    generatedAt: new Date().toISOString(),
    rathena: RATHENA_SHA,
    counts: {
      species: species.length,
      skills: Object.keys(skills).length,
      mvp: species.filter((s) => s.mvp).length,
      boss: species.filter((s) => s.boss).length,
      withSpawnMaps: species.filter((s) => s.spawnMaps.length > 0).length,
      playable: species.filter((s) => s.playable).length,
    },
    tierThresholds,
    tiers: [1, 2, 3, 4, 5].map((tier) => ({
      tier,
      count: species.filter((s) => s.tier === tier).length,
    })),
    races: [...raceSet].sort(),
    elements: [...elementSet].sort(),
  };
  await writeFile(path.join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Generated ${species.length} species, ${Object.keys(skills).length} skills`);
  console.log(
    `  MVP ${manifest.counts.mvp}, boss ${manifest.counts.boss}, with spawn maps ${manifest.counts.withSpawnMaps}`,
  );
  console.log(`  tiers ${manifest.tiers.map((t) => `${t.tier}:${t.count}`).join(" ")}`);
  console.log(`Output: ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
