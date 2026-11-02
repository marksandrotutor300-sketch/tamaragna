import { battleElementMultiplier } from "@/lib/game/combat-data";
import type { StatusKind } from "@/lib/game/types";
import type { CombatantInit } from "./types";

export type AiFighter = {
  init: CombatantInit;
  hp: number;
  maxHp: number;
  alive: boolean;
  cooldowns: number[];
  statuses: Array<{ kind: StatusKind; magnitude: number }>;
  casting: boolean;
};

export type AiView = {
  active: number;
  swapCooldownMs: number;
  skillLockMs: number;
  fighters: AiFighter[];
};

export type AiAction = { kind: "skill"; slot: number } | { kind: "swap"; index: number } | null;

const EMERGENCY_HP = 0.25;
const SWAP_IN_HP = 0.55;
const HEAL_HP = 0.45;

/**
 * Deterministic priority policy. Used for ghost/defender teams and for auto
 * mode, which means an auto battle replays identically everywhere.
 */
export function chooseAiAction(self: AiView, opponent: AiView): AiAction {
  const me = self.fighters[self.active];
  if (!me || !me.alive || me.casting) return null;
  if (me.statuses.some((status) => status.kind === "stun")) return null;

  const hpRatio = me.hp / me.maxHp;

  if (hpRatio < EMERGENCY_HP && self.swapCooldownMs === 0) {
    let bestIndex = -1;
    let bestRatio = SWAP_IN_HP;
    for (let i = 0; i < self.fighters.length; i += 1) {
      if (i === self.active) continue;
      const candidate = self.fighters[i];
      if (!candidate.alive) continue;
      const ratio = candidate.hp / candidate.maxHp;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) return { kind: "swap", index: bestIndex };
  }

  if (self.skillLockMs > 0) return null;

  const target = opponent.fighters[opponent.active];
  if (!target || !target.alive) return null;

  if (hpRatio < HEAL_HP) {
    const healSlot = me.init.skills.findIndex(
      (skill, index) => skill.kind === "heal" && me.cooldowns[index] === 0,
    );
    if (healSlot >= 0) return { kind: "skill", slot: healSlot };
  }

  let bestSlot = -1;
  let bestScore = 0;
  me.init.skills.forEach((skill, index) => {
    if (me.cooldowns[index] > 0) return;
    if (skill.kind === "heal" || skill.target === "self") return;

    const multiplier = battleElementMultiplier(
      skill.element,
      target.init.element,
      me.init.elementLevel,
    );
    const livingTargets = opponent.fighters.filter((fighter) => fighter.alive).length;
    const areaFactor = skill.target === "allEnemies" ? 0.6 * Math.max(1, livingTargets) : 1;
    const score = skill.power * skill.hits * multiplier * areaFactor;

    if (score > bestScore) {
      bestScore = score;
      bestSlot = index;
    }
  });

  if (bestSlot >= 0) return { kind: "skill", slot: bestSlot };

  const buffSlot = me.init.skills.findIndex(
    (skill, index) =>
      skill.target === "self" &&
      skill.kind !== "heal" &&
      skill.status !== null &&
      me.cooldowns[index] === 0 &&
      !me.statuses.some((status) => status.kind === skill.status?.kind),
  );
  if (buffSlot >= 0) return { kind: "skill", slot: buffSlot };

  return null;
}
