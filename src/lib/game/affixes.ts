import { Rng } from "@/lib/rng";
import type { CombatantInit } from "@/lib/sim/types";
import { applyStatModifiers, type StatModifiers } from "./modifiers";

export type Affix = {
  id: string;
  name: string;
  description: string;
  modifiers: StatModifiers;
};

export const AFFIXES: Affix[] = [
  {
    id: "fierce",
    name: "Fierce",
    description: "+15% ATK/MATK",
    modifiers: { atk: 1.15, matk: 1.15 },
  },
  {
    id: "tough",
    name: "Tough",
    description: "+20% DEF/MDEF",
    modifiers: { def: 1.2, mdef: 1.2 },
  },
  {
    id: "vital",
    name: "Vital",
    description: "+20% max HP",
    modifiers: { hp: 1.2 },
  },
  {
    id: "brutal",
    name: "Brutal",
    description: "+25% ATK/MATK, -10% DEF/MDEF",
    modifiers: { atk: 1.25, matk: 1.25, def: 0.9, mdef: 0.9 },
  },
];

export function affixesForWave(seed: string, wave: number, count: number): Affix[] {
  const rng = new Rng(`affix:${seed}:${wave}`);
  const pool = [...AFFIXES];
  const chosen: Affix[] = [];

  while (chosen.length < count && pool.length > 0) {
    const index = rng.int(0, pool.length - 1);
    chosen.push(pool.splice(index, 1)[0]);
  }

  return chosen;
}

export function applyAffixes(
  combatant: CombatantInit,
  affixes: Affix[],
): CombatantInit {
  let next = combatant;
  for (const affix of affixes) {
    next = applyStatModifiers(next, affix.modifiers);
  }
  return {
    ...next,
    affix: affixes.map((affix) => affix.name).join(" · ") || undefined,
  };
}
