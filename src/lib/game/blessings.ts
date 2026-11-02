import { Rng } from "@/lib/rng";
import type { CombatantInit } from "@/lib/sim/types";
import { applyStatModifiers, type StatModifiers } from "./modifiers";

export type Blessing = {
  id: string;
  name: string;
  description: string;
  modifiers: StatModifiers;
};

export const BLESSINGS: Blessing[] = [
  {
    id: "fury",
    name: "Fury",
    description: "+10% ATK and MATK for this run.",
    modifiers: { atk: 1.1, matk: 1.1 },
  },
  {
    id: "bulwark",
    name: "Bulwark",
    description: "+15% DEF and MDEF for this run.",
    modifiers: { def: 1.15, mdef: 1.15 },
  },
  {
    id: "vitality",
    name: "Vitality",
    description: "+15% max HP for this run.",
    modifiers: { hp: 1.15 },
  },
  {
    id: "alacrity",
    name: "Alacrity",
    description: "+10% attack speed for this run.",
    modifiers: { aspdMs: 0.9 },
  },
  {
    id: "focus",
    name: "Focus",
    description: "+5% critical chance for this run.",
    modifiers: { critChance: 0.05 },
  },
];

export function blessingById(id: string): Blessing | undefined {
  return BLESSINGS.find((blessing) => blessing.id === id);
}

/** Three deterministic, unique choices for a given run and wave. */
export function draftOptions(seed: string, wave: number): Blessing[] {
  const rng = new Rng(`draft:${seed}:${wave}`);
  const pool = [...BLESSINGS];
  const chosen: Blessing[] = [];

  while (chosen.length < 3 && pool.length > 0) {
    const index = rng.int(0, pool.length - 1);
    chosen.push(pool.splice(index, 1)[0]);
  }

  return chosen;
}

export function applyBlessing(
  combatants: CombatantInit[],
  blessing: Blessing,
): CombatantInit[] {
  return combatants.map((combatant) => applyStatModifiers(combatant, blessing.modifiers));
}
