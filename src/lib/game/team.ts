import type { CombatantInit } from "@/lib/sim/types";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { pets } from "@/lib/db/schema";
import { combatantFromPet } from "./combatant";
import { requireSpecies } from "./species";
import { computeTeamSynergies, synergyBonusesFor, type SynergyBonuses } from "./synergy";
import type { NatureId } from "./nature";
import { getPetMasteryMap } from "./mastery";
import type { Pet } from "@/lib/db/schema";

export type TeamPet = Pick<
  Pet,
  | "id"
  | "speciesId"
  | "nickname"
  | "rarity"
  | "level"
  | "ivs"
  | "care"
  | "nature"
  | "star"
  | "loadout"
  | "statOverrides"
> & { evolutionStage?: number; mastery?: Record<number, number> };

export async function loadTeamPets(
  ownerId: string,
): Promise<Array<Pet & { mastery: Record<number, number> }>> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(pets)
    .where(
      and(
        eq(pets.ownerId, ownerId),
        isNotNull(pets.slot),
        eq(pets.marketListed, false),
        isNull(pets.expeditionId),
      ),
    )
    .orderBy(asc(pets.slot));
  const mastery = await getPetMasteryMap(rows.map((pet) => pet.id));
  return rows.map((pet) => ({
    ...pet,
    mastery: mastery[pet.id] ?? {},
  }));
}

export function petToCombatant(pet: TeamPet, hp?: number): CombatantInit {
  const species = requireSpecies(pet.speciesId);
  const combatant = combatantFromPet(
    {
      id: pet.id,
      speciesId: pet.speciesId,
      nickname: pet.nickname,
      rarity: pet.rarity as 1 | 2 | 3 | 4 | 5,
      level: pet.level,
      ivs: pet.ivs,
      care: pet.care,
      nature: pet.nature as NatureId,
      star: pet.star,
      loadout: pet.loadout,
      evolutionStage: pet.evolutionStage,
      mastery: pet.mastery,
      statOverrides: pet.statOverrides,
    },
    species,
  );
  if (hp !== undefined) combatant.hp = Math.max(0, Math.min(combatant.stats.hpMax, hp));
  return combatant;
}

function applySynergy(combatant: CombatantInit, bonuses: SynergyBonuses): void {
  if (bonuses.atk !== 1) {
    combatant.stats.atk = Math.max(1, Math.floor(combatant.stats.atk * bonuses.atk));
    combatant.stats.matk = Math.max(1, Math.floor(combatant.stats.matk * bonuses.matk));
  }
  if (bonuses.def !== 1) {
    combatant.stats.def = Math.floor(combatant.stats.def * bonuses.def);
    combatant.stats.mdef = Math.floor(combatant.stats.mdef * bonuses.mdef);
  }
  if (bonuses.hp !== 1) {
    combatant.stats.hpMax = Math.max(1, Math.floor(combatant.stats.hpMax * bonuses.hp));
  }
}

export function teamToCombatants(pets: TeamPet[], hp?: Record<string, number>): CombatantInit[] {
  const species = pets.map((pet) => requireSpecies(pet.speciesId));
  const members = pets.map((pet, index) => ({
    speciesId: pet.speciesId,
    element: species[index].element,
    raceName: species[index].raceName,
  }));
  const synergies = computeTeamSynergies(members);

  return pets.map((pet, index) => {
    const combatant = petToCombatant(pet, hp?.[pet.id]);
    applySynergy(combatant, synergyBonusesFor(members[index], synergies));
    if (hp?.[pet.id] !== undefined) {
      combatant.hp = Math.max(0, Math.min(combatant.stats.hpMax, hp[pet.id]));
    }
    return combatant;
  });
}

export function maxTeamSize(): number {
  return 3;
}
