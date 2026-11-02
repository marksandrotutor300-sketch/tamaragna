import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GeneratedSkill, GeneratedSpecies } from "./build-bestiary";
import { ELEMENT_NAMES } from "./whitelist/skill-effects";

const OUT_DIR = path.join(process.cwd(), "data", "generated");

const errors: string[] = [];
const warnings: string[] = [];

const STAT_BANDS = {
  hp: [300, 5000],
  atk: [60, 1200],
  matk: [60, 1200],
  def: [0, 300],
  mdef: [0, 300],
  aspdMs: [450, 2200],
  core: [20, 120],
} as const;

function checkBand(label: string, value: number, [min, max]: readonly [number, number]) {
  if (!Number.isFinite(value) || value < min || value > max) {
    errors.push(`${label} = ${value} outside ${min}..${max}`);
  }
}

async function main(): Promise<void> {
  const readJson = async <T>(file: string): Promise<T> =>
    JSON.parse(await readFile(path.join(OUT_DIR, file), "utf8")) as T;

  const species = await readJson<GeneratedSpecies[]>("species.json");
  const skills = await readJson<Record<number, GeneratedSkill>>("skills.json");
  const attrFix = await readJson<Record<string, Record<string, Record<string, number>>>>(
    "attr-fix.json",
  );
  const manifest = await readJson<{
    rathena: string;
    counts: { species: number; playable: number };
  }>("manifest.json");

  if (species.length < 2000) {
    errors.push(`Only ${species.length} species generated; expected at least 2000`);
  }
  if (species.length !== manifest.counts.species) {
    errors.push("manifest species count does not match species.json");
  }

  const playable = species.filter((entry) => entry.playable);
  if (playable.length < 800) {
    errors.push(`Only ${playable.length} playable species; expected at least 800`);
  }
  if (playable.some((entry) => /dummy/i.test(entry.name))) {
    errors.push("A test dummy leaked into the playable pool");
  }
  for (const entry of playable) {
    if (entry.spawnMaps.length === 0 && !entry.mvp) {
      errors.push(`species ${entry.id} (${entry.name}) is playable but has no spawn map`);
    }
  }

  const ids = new Set<number>();
  let noSpawn = 0;
  let noDamage = 0;

  for (const entry of species) {
    const label = `species ${entry.id} (${entry.name})`;

    if (ids.has(entry.id)) errors.push(`${label}: duplicate id`);
    ids.add(entry.id);

    if (!entry.name || !entry.aegisName) errors.push(`${label}: missing name`);
    if (entry.element < 0 || entry.element > 9) errors.push(`${label}: bad element`);

    checkBand(`${label} hp`, entry.base.hp, STAT_BANDS.hp);
    checkBand(`${label} atk`, entry.base.atk, STAT_BANDS.atk);
    checkBand(`${label} matk`, entry.base.matk, STAT_BANDS.matk);
    checkBand(`${label} def`, entry.base.def, STAT_BANDS.def);
    checkBand(`${label} mdef`, entry.base.mdef, STAT_BANDS.mdef);
    checkBand(`${label} aspdMs`, entry.base.aspdMs, STAT_BANDS.aspdMs);
    for (const stat of ["str", "agi", "vit", "int", "dex", "luk"] as const) {
      checkBand(`${label} ${stat}`, entry.base[stat], STAT_BANDS.core);
    }

    if (entry.skills.length !== 6) {
      errors.push(`${label}: has ${entry.skills.length} skills, expected 6`);
    }

    const skillIds = new Set<number>();
    let damaging = 0;
    let support = 0;

    for (const slot of entry.skills) {
      const skill = skills[slot.id];
      if (!skill) {
        errors.push(`${label}: unknown skill ${slot.id}`);
        continue;
      }
      if (skillIds.has(slot.id)) errors.push(`${label}: duplicate skill ${slot.id}`);
      skillIds.add(slot.id);

      if (slot.baseLevel < 1 || slot.baseLevel > 10) {
        errors.push(`${label}: skill ${slot.id} baseLevel ${slot.baseLevel} out of range`);
      }
      if (skill.kind === "heal" || skill.target === "self") support += 1;
      else damaging += 1;
    }

    if (damaging < 4) {
      noDamage += 1;
      errors.push(`${label}: kit has ${damaging} offensive skills, expected at least 4`);
    }
    if (support > 2) {
      errors.push(`${label}: kit has ${support} support skills, expected at most 2`);
    }
    if (support === 0) {
      warnings.push(`${label}: kit has no support skill`);
    }
    if (entry.spawnMaps.length === 0) noSpawn += 1;
  }

  for (const [id, skill] of Object.entries(skills)) {
    if (!Number.isFinite(Number(id))) errors.push(`skill ${id}: non-numeric id`);
    if (!skill.displayName) errors.push(`skill ${id}: missing display name`);
    if (skill.cooldownMs <= 0) errors.push(`skill ${id}: cooldown must be positive`);
    if (skill.hits < 1 || skill.hits > 8) errors.push(`skill ${id}: bad hit count ${skill.hits}`);
    if (skill.power < 0) errors.push(`skill ${id}: negative power`);
    if (skill.kind !== "heal" && skill.power === 0 && !skill.status) {
      errors.push(`skill ${id}: no power and no status`);
    }
    if (skill.element !== null && (skill.element < 0 || skill.element > 9)) {
      errors.push(`skill ${id}: bad element`);
    }
  }

  const levels = Object.keys(attrFix);
  if (levels.length !== 4) errors.push(`attr-fix has ${levels.length} levels, expected 4`);
  for (const level of levels) {
    for (const attacker of ELEMENT_NAMES) {
      for (const defender of ELEMENT_NAMES) {
        const value = attrFix[level]?.[attacker]?.[defender];
        if (typeof value !== "number") {
          errors.push(`attr-fix missing ${level}/${attacker}/${defender}`);
        }
      }
    }
  }

  if (attrFix["1"]?.Water?.Fire !== 150) errors.push("attr-fix sanity: Water vs Fire should be 150");
  if (attrFix["1"]?.Ghost?.Neutral !== 90) errors.push("attr-fix sanity: Ghost vs Neutral should be 90");

  if (noSpawn > 0) warnings.push(`${noSpawn} species have no spawn maps (event/quest mobs)`);

  console.log(`Validated ${species.length} species and ${Object.keys(skills).length} skills`);
  console.log(`  rAthena ${manifest.rathena.slice(0, 12)}`);
  console.log(`  no spawn maps: ${noSpawn}, kits with fewer than 4 offense: ${noDamage}`);
  for (const warning of warnings.slice(0, 10)) console.log(`  warn: ${warning}`);
  if (warnings.length > 10) console.log(`  ... ${warnings.length - 10} more warnings`);

  if (errors.length > 0) {
    for (const error of errors.slice(0, 30)) console.error(`  ERROR: ${error}`);
    console.error(`\n${errors.length} validation error(s)`);
    process.exit(1);
  }

  console.log("All checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
