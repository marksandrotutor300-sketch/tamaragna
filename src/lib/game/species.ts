import speciesJson from "@data/generated/species.json";
import type { GeneratedSpecies } from "./types";

export const ALL_SPECIES = speciesJson as unknown as GeneratedSpecies[];
export const SPECIES_BY_ID = new Map<number, GeneratedSpecies>(
  ALL_SPECIES.map((species) => [species.id, species]),
);

export function getSpecies(id: number): GeneratedSpecies | undefined {
  return SPECIES_BY_ID.get(id);
}

export function requireSpecies(id: number): GeneratedSpecies {
  const species = SPECIES_BY_ID.get(id);
  if (!species) throw new Error(`Unknown species ${id}`);
  return species;
}

export const ALL_MAPS = new Set(ALL_SPECIES.flatMap((species) => species.spawnMaps));

export type SpeciesSummary = Pick<
  GeneratedSpecies,
  "id" | "name" | "tier" | "element" | "raceName" | "sizeName" | "level" | "mvp" | "boss" | "playable"
> & { hasSpawn: boolean };

export function speciesSummary(species: GeneratedSpecies): SpeciesSummary {
  return {
    id: species.id,
    name: species.name,
    tier: species.tier,
    element: species.element,
    raceName: species.raceName,
    sizeName: species.sizeName,
    level: species.level,
    mvp: species.mvp,
    boss: species.boss,
    playable: species.playable,
    hasSpawn: species.spawnMaps.length > 0,
  };
}

export const ALL_SUMMARIES: SpeciesSummary[] = ALL_SPECIES.filter(
  (species) => species.playable,
).map(speciesSummary);
