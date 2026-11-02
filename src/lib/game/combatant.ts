import type { Rng } from "@/lib/rng";
import type { CombatantInit } from "@/lib/sim/types";
import { defaultCare } from "./care";
import { getSkill } from "./combat-data";
import { NATURES, type NatureId } from "./nature";
import { masteryPowerMultiplier } from "./mastery";
import { RARITY } from "./rarity";
import { skillLevelFor, resolveSkill, normalizeLoadout } from "./skills";
import { computeStats, applyStatOverrides, type StatOverrides } from "./stats";
import type { CareState, GeneratedSpecies, Ivs, Rarity } from "./types";

export type Livestock = {
  id: string;
  speciesId: number;
  nickname: string;
  rarity: Rarity;
  level: number;
  ivs: Ivs;
  care: CareState;
  nature: NatureId;
  star: number;
  loadout: number[] | null;
  evolutionStage?: number;
  mastery?: Record<number, number>;
  statOverrides?: StatOverrides | null;
};

export function rollIvs(rarity: Rarity, rng: Rng): Ivs {
  const floor = RARITY[rarity].ivFloor;
  return {
    str: rng.int(floor, 31),
    agi: rng.int(floor, 31),
    vit: rng.int(floor, 31),
    int: rng.int(floor, 31),
    dex: rng.int(floor, 31),
    luk: rng.int(floor, 31),
  };
}

export function zeroIvs(): Ivs {
  return { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
}

export function buildCombatant(params: {
  petId: string;
  species: GeneratedSpecies;
  rarity: Rarity;
  level: number;
  ivs: Ivs;
  care: Pick<CareState, "hunger" | "mood" | "friendship">;
  name: string;
  hp?: number;
  nature?: NatureId;
  star?: number;
  loadout?: number[] | null;
  evolutionStage?: number;
  mastery?: Record<number, number>;
  overrides?: StatOverrides | null;
}): CombatantInit {
  const { species, rarity, level, ivs, care } = params;

  const stats = computeStats({
    species,
    rarity,
    level,
    ivs,
    care,
    nature: params.nature,
    star: params.star,
  });

  const stage = Math.max(1, params.evolutionStage ?? 1);
  if (stage > 1) {
    const multiplier = 1 + 0.08 * (stage - 1);
    stats.hpMax = Math.floor(stats.hpMax * multiplier);
    stats.atk = Math.floor(stats.atk * multiplier);
    stats.matk = Math.floor(stats.matk * multiplier);
    stats.def = Math.floor(stats.def * multiplier);
    stats.mdef = Math.floor(stats.mdef * multiplier);
  }

  const finalStats = applyStatOverrides(stats, params.overrides);

  if (species.skills.length < 4) {
    throw new Error(`${species.name} (#${species.id}) has fewer than 4 skills`);
  }

  const loadout = normalizeLoadout(species.skills, params.loadout);
  const slots = new Map(species.skills.map((slot) => [slot.id, slot]));
  const skills = loadout.map((id) => {
    const slot = slots.get(id);
    if (!slot) {
      throw new Error(`${species.name} has no skill ${id}`);
    }
    const definition = getSkill(slot.id);
    if (!definition) {
      throw new Error(`${species.name} references unknown skill ${slot.id}`);
    }
    const resolved = resolveSkill(
      definition,
      skillLevelFor(slot.baseLevel, rarity),
      species.element,
    );
    const masteryLevel = Math.max(1, Math.min(5, params.mastery?.[slot.id] ?? 1));
    return {
      ...resolved,
      power: Math.round(resolved.power * masteryPowerMultiplier(masteryLevel)),
      status: resolved.status
        ? {
            ...resolved.status,
            chance: Math.min(
              0.9,
              resolved.status.chance + 0.01 * (masteryLevel - 1),
            ),
          }
        : null,
      masteryLevel,
    };
  });

  return {
    petId: params.petId,
    speciesId: species.id,
    name: params.name,
    element: species.element,
    elementLevel: species.elementLevel,
    level,
    rarity,
    stats: finalStats,
    skills,
    hp: params.hp,
    spawnMap: species.spawnMaps[0],
    nature: params.nature,
    star: params.star,
    evolutionStage: stage,
    mastery: params.mastery,
  };
}

export function combatantFromPet(pet: Livestock, species: GeneratedSpecies): CombatantInit {
  return buildCombatant({
    petId: pet.id,
    species,
    rarity: pet.rarity,
    level: pet.level,
    ivs: pet.ivs,
    care: pet.care,
    name: pet.nickname || species.name,
    nature: pet.nature,
    star: pet.star,
    loadout: pet.loadout,
    evolutionStage: pet.evolutionStage ?? 1,
    mastery: pet.mastery,
    overrides: pet.statOverrides,
  });
}

export function scaleSpecies(
  species: GeneratedSpecies,
  statMultiplier: number,
  hpMultiplier: number,
  levelOverride?: number,
): GeneratedSpecies {
  return {
    ...species,
    level: levelOverride ?? species.level,
    base: {
      ...species.base,
      hp: Math.round(species.base.hp * hpMultiplier),
      atk: Math.round(species.base.atk * statMultiplier),
      matk: Math.round(species.base.matk * statMultiplier),
      def: Math.round(species.base.def * statMultiplier),
      mdef: Math.round(species.base.mdef * statMultiplier),
    },
  };
}

/** Deterministic wild pet used by the endless tower. */
export function buildWildCombatant(params: {
  petId: string;
  species: GeneratedSpecies;
  level: number;
  rarity: Rarity;
  rng: Rng;
  statMultiplier: number;
  hpMultiplier: number;
  /** force a nature, e.g. hardy for the tower's opening waves */
  nature?: NatureId;
  /** force IVs, e.g. zero for the tower's opening waves */
  ivs?: Ivs;
}): CombatantInit {
  const scaled = scaleSpecies(
    params.species,
    params.statMultiplier,
    params.hpMultiplier,
    params.level,
  );
  const ivs = params.ivs ?? rollIvs(params.rarity, params.rng);

  return buildCombatant({
    petId: params.petId,
    species: scaled,
    rarity: params.rarity,
    level: params.level,
    ivs,
    care: defaultCare(),
    name: params.species.name,
    nature: params.nature ?? params.rng.pick(NATURES).id,
    star: 1,
  });
}
