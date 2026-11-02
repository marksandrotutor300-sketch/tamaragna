import type { CombatantInit } from "@/lib/sim/types";

export type StatModifiers = {
  atk?: number;
  matk?: number;
  def?: number;
  mdef?: number;
  hp?: number;
  aspdMs?: number;
  critChance?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Apply multiplicative/additive modifiers to a combatant's baked stats. */
export function applyStatModifiers(
  combatant: CombatantInit,
  modifiers: StatModifiers,
): CombatantInit {
  const stats = { ...combatant.stats };

  if (modifiers.atk) stats.atk = Math.max(1, Math.floor(stats.atk * modifiers.atk));
  if (modifiers.matk) stats.matk = Math.max(1, Math.floor(stats.matk * modifiers.matk));
  if (modifiers.def) stats.def = Math.max(0, Math.floor(stats.def * modifiers.def));
  if (modifiers.mdef) stats.mdef = Math.max(0, Math.floor(stats.mdef * modifiers.mdef));

  let hp = combatant.hp;
  if (modifiers.hp) {
    const oldMax = stats.hpMax;
    stats.hpMax = Math.max(1, Math.floor(oldMax * modifiers.hp));
    if (hp !== undefined) {
      hp = Math.min(stats.hpMax, Math.round((hp * stats.hpMax) / Math.max(1, oldMax)));
    }
  }

  if (modifiers.aspdMs) {
    stats.aspdMs = clamp(Math.round(stats.aspdMs * modifiers.aspdMs), 300, 3000);
  }
  if (modifiers.critChance) {
    stats.critChance = clamp(stats.critChance + modifiers.critChance, 0, 0.5);
  }

  return { ...combatant, stats, hp };
}
