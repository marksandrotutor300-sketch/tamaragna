import type { Pet } from "@/lib/db/schema";
import { normalizeCare } from "./care";
import { getSkill } from "./combat-data";
import { masteryPowerMultiplier } from "./mastery";
import type { NatureId } from "./nature";
import { RARITY } from "./rarity";
import { skillLevelFor, resolveSkill, normalizeLoadout, type ResolvedSkill } from "./skills";
import { requireSpecies } from "./species";
import { computeStats, powerScore } from "./stats";
import type { ElementId, Rarity } from "./types";

export type PetSpeciesView = {
  id: number;
  name: string;
  tier: Rarity;
  element: ElementId;
  elementLevel: number;
  raceName: string;
  sizeName: string;
  mvp: boolean;
  boss: boolean;
  spawnMaps: string[];
};

export type PetView = {
  id: string;
  speciesId: number;
  nickname: string;
  rarity: Rarity;
  level: number;
  exp: number;
  slot: number | null;
  ivs: Pet["ivs"];
  care: ReturnType<typeof normalizeCare>;
  nature: NatureId;
  star: number;
  evolutionStage: number;
  mastery: Record<number, number>;
  marketListed: boolean;
  expeditionId: string | null;
  legacyTrait: string | null;
  stats: ReturnType<typeof computeStats>;
  power: number;
  loadout: number[];
  skills: Array<ResolvedSkill & { baseLevel: number }>;
  availableSkills: Array<ResolvedSkill & { baseLevel: number; equipped: boolean }>;
  species: PetSpeciesView;
};

export function petView(
  pet: Pet,
  mastery: Record<number, number> = {},
): PetView {
  const species = requireSpecies(pet.speciesId);
  const rarity = pet.rarity as Rarity;
  const care = normalizeCare(pet.care);
  const stats = computeStats({
    species,
    rarity,
    level: pet.level,
    ivs: pet.ivs,
    care,
    nature: pet.nature as NatureId,
    star: pet.star,
  });

  const resolvedSkills = species.skills.flatMap((slot) => {
    const definition = getSkill(slot.id);
    if (!definition) return [];
    const level = skillLevelFor(slot.baseLevel, rarity);
    const resolved = resolveSkill(definition, level, species.element);
    const masteryLevel = Math.max(1, Math.min(5, mastery[slot.id] ?? 1));
    return [
      {
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
        baseLevel: slot.baseLevel,
      },
    ];
  });

  const loadout = normalizeLoadout(species.skills, pet.loadout);
  const skillById = new Map(resolvedSkills.map((skill) => [skill.id, skill]));
  const skills = loadout.flatMap((id) => {
    const skill = skillById.get(id);
    return skill ? [skill] : [];
  });
  const availableSkills = resolvedSkills.map((skill) => ({
    ...skill,
    equipped: loadout.includes(skill.id),
  }));

  return {
    id: pet.id,
    speciesId: pet.speciesId,
    nickname: pet.nickname,
    rarity,
    level: pet.level,
    exp: pet.exp,
    slot: pet.slot,
    ivs: pet.ivs,
    care,
    nature: pet.nature as NatureId,
    star: pet.star,
    evolutionStage: pet.evolutionStage,
    mastery,
    marketListed: pet.marketListed,
    expeditionId: pet.expeditionId,
    legacyTrait: pet.legacyTrait,
    stats,
    power: powerScore(stats),
    loadout,
    skills,
    availableSkills,
    species: {
      id: species.id,
      name: species.name,
      tier: species.tier,
      element: species.element,
      elementLevel: species.elementLevel,
      raceName: species.raceName,
      sizeName: species.sizeName,
      mvp: species.mvp,
      boss: species.boss,
      spawnMaps: species.spawnMaps,
    },
  };
}

export function rarityInfo(rarity: Rarity) {
  return RARITY[rarity];
}
