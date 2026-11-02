import { battleElementMultiplier } from "@/lib/game/combat-data";
import type { ElementId, StatusKind } from "@/lib/game/types";
import type { Rng } from "@/lib/rng";
import type { CombatantInit, HitResult } from "./types";

/** Percentage reduction applied by a shield status. */
export const MAX_SHIELD = 0.6;

export function sumStatus(
  statuses: Array<{ kind: StatusKind; magnitude: number }>,
  kinds: StatusKind[],
): number {
  let total = 0;
  for (const status of statuses) {
    if (kinds.includes(status.kind)) total += status.magnitude;
  }
  return total;
}

export function effectiveAtk(init: CombatantInit, statuses: Array<{ kind: StatusKind; magnitude: number }>): number {
  return Math.max(1, init.stats.atk * (1 + sumStatus(statuses, ["atkUp"])));
}

export function effectiveMatk(init: CombatantInit, statuses: Array<{ kind: StatusKind; magnitude: number }>): number {
  return Math.max(1, init.stats.matk * (1 + sumStatus(statuses, ["atkUp"])));
}

export function effectiveDef(
  init: CombatantInit,
  statuses: Array<{ kind: StatusKind; magnitude: number }>,
): number {
  const mod = sumStatus(statuses, ["defUp"]) - sumStatus(statuses, ["defDown"]);
  return Math.max(0, init.stats.def * (1 + mod));
}

export function effectiveMdef(
  init: CombatantInit,
  statuses: Array<{ kind: StatusKind; magnitude: number }>,
): number {
  const mod = sumStatus(statuses, ["defUp"]) - sumStatus(statuses, ["defDown"]);
  return Math.max(0, init.stats.mdef * (1 + mod));
}

export function effectiveAspdMs(
  init: CombatantInit,
  statuses: Array<{ kind: StatusKind; magnitude: number }>,
): number {
  const haste = Math.min(0.5, sumStatus(statuses, ["haste"]));
  const slow = Math.min(0.5, sumStatus(statuses, ["slow"]));
  return Math.min(3000, Math.max(300, init.stats.aspdMs * (1 + slow - haste)));
}

export function mitigation(defense: number): number {
  return 1 - defense / (defense + 500);
}

function variance(rng: Rng): number {
  return 0.9 + rng.next() * 0.2;
}

export type DamageContext = {
  rng: Rng;
  attacker: CombatantInit;
  attackerStatuses: Array<{ kind: StatusKind; magnitude: number }>;
  defender: CombatantInit;
  defenderStatuses: Array<{ kind: StatusKind; magnitude: number }>;
  element: ElementId;
  power: number;
  hits: number;
  magical: boolean;
  /** per-battle luck multiplier, 0.92..1.08 */
  performance?: number;
};

export function rollDamage(ctx: DamageContext): { hits: HitResult[]; total: number } {
  const elementMult = battleElementMultiplier(
    ctx.element,
    ctx.defender.element,
    ctx.attacker.elementLevel,
  );

  const attack = ctx.magical
    ? effectiveMatk(ctx.attacker, ctx.attackerStatuses)
    : effectiveAtk(ctx.attacker, ctx.attackerStatuses);
  const defense = ctx.magical
    ? effectiveMdef(ctx.defender, ctx.defenderStatuses)
    : effectiveDef(ctx.defender, ctx.defenderStatuses);
  const shield = Math.min(MAX_SHIELD, sumStatus(ctx.defenderStatuses, ["shield"]));
  const performance = ctx.performance ?? 1;

  const hits: HitResult[] = [];
  let total = 0;

  for (let i = 0; i < Math.max(1, ctx.hits); i += 1) {
    const crit = ctx.rng.next() < ctx.attacker.stats.critChance;
    const critMult = crit ? ctx.attacker.stats.critMult : 1;
    const raw = (attack * ctx.power) / 100;
    const damage = Math.max(
      1,
      Math.floor(
        raw *
          elementMult *
          mitigation(defense) *
          critMult *
          (1 - shield) *
          performance *
          variance(ctx.rng),
      ),
    );
    hits.push({ damage, crit });
    total += damage;
  }

  return { hits, total };
}

export function rollBasicDamage(
  rng: Rng,
  attacker: CombatantInit,
  attackerStatuses: Array<{ kind: StatusKind; magnitude: number }>,
  defender: CombatantInit,
  defenderStatuses: Array<{ kind: StatusKind; magnitude: number }>,
  performance: number,
): { damage: number; crit: boolean } {
  const { hits } = rollDamage({
    rng,
    attacker,
    attackerStatuses,
    defender,
    defenderStatuses,
    element: attacker.element,
    power: 100,
    hits: 1,
    magical: false,
    performance,
  });
  return hits[0];
}
