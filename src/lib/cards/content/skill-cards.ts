import { allSkills } from "@/lib/game/combat-data";
import type { GeneratedSkill, StatusKind } from "@/lib/game/types";
import type {
  CardDefinition,
  CardEffect,
  CardRarity,
  CardStatusKind,
  CardTarget,
} from "../types";

const CARD_STATUS: Record<StatusKind, CardStatusKind> = {
  poison: "poison",
  stun: "stun",
  slow: "slow",
  haste: "haste",
  atkUp: "atkUp",
  defUp: "defUp",
  defDown: "defDown",
  shield: "shield",
};

function rarityForTier(tier: 1 | 2 | 3): CardRarity {
  return tier === 1 ? "common" : tier === 2 ? "uncommon" : "rare";
}

function costForTier(tier: 1 | 2 | 3, target: CardTarget): number {
  const extra = target === "allEnemies" || target === "allAllies" ? 1 : 0;
  return Math.min(3, Math.max(1, tier + extra));
}

function targetFor(skill: GeneratedSkill): CardTarget {
  if (skill.kind === "heal") return "ally";
  if (skill.target === "self") return "self";
  if (skill.target === "allEnemies") return "allEnemies";
  return "enemy";
}

function statusEffect(skill: GeneratedSkill, target: CardTarget): CardEffect | null {
  if (!skill.status) return null;
  return {
    kind: "status",
    status: CARD_STATUS[skill.status.kind],
    stacks: 2,
    turns: 2,
    chance: skill.status.chance,
    target:
      target === "self"
        ? "self"
        : target === "allEnemies"
          ? "allEnemies"
          : target === "ally"
            ? "ally"
            : "enemy",
  };
}

export function skillToCard(skill: GeneratedSkill): CardDefinition {
  const target = targetFor(skill);
  const effects: CardEffect[] = [];

  if (skill.kind === "heal") {
    effects.push({
      kind: "heal",
      power: skill.power,
      basis: skill.healBasis ?? "matk",
      target: "ally",
    });
  } else {
    effects.push({
      kind: "damage",
      power: skill.power,
      hits: skill.hits,
      stat: skill.kind === "magical" ? "matk" : "atk",
      target,
    });
  }

  const status = statusEffect(skill, target);
  if (status) effects.push(status);
  if (skill.target === "self" && !status && skill.kind !== "heal") {
    effects.push({ kind: "block", amount: 6, target: "self" });
  }

  const effectText = effects
    .map((effect) => {
      if (effect.kind === "damage") {
        return `${effect.hits && effect.hits > 1 ? `${effect.hits}×` : ""}${effect.power}% ${effect.stat === "matk" ? "MATK" : "ATK"}`;
      }
      if (effect.kind === "heal") return `heal ${effect.power ?? effect.amount ?? 0}%`;
      if (effect.kind === "status") return `${effect.status} ${effect.turns ?? 2}`;
      return effect.kind;
    })
    .join(" · ");

  return {
    id: `skill:${skill.id}`,
    name: skill.displayName,
    description: effectText,
    type: skill.kind === "heal" || skill.target === "self" ? "skill" : "attack",
    rarity: rarityForTier(skill.tier),
    element: skill.element,
    cost: costForTier(skill.tier, target),
    target,
    effects,
    iconId: skill.iconId,
    skillId: skill.id,
  };
}

const SKILL_CARD_CACHE = new Map<number, CardDefinition>();

export function getSkillCard(skillId: number): CardDefinition | undefined {
  const cached = SKILL_CARD_CACHE.get(skillId);
  if (cached) return cached;
  const skill = allSkills().find((entry) => entry.id === skillId);
  if (!skill) return undefined;
  const card = skillToCard(skill);
  SKILL_CARD_CACHE.set(skillId, card);
  return card;
}

export function allSkillCards(): CardDefinition[] {
  return allSkills().map((skill) => getSkillCard(skill.id)!);
}
