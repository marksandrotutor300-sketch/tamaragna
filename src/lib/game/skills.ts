import { getSkill } from "./combat-data";
import { RARITY } from "./rarity";
import type { ElementId, GeneratedSkill, Rarity, StatusEffect } from "./types";

export const MAX_SKILL_LEVEL = 10;
export const LOADOUT_SIZE = 4;

/** Skills must hit harder than a basic attack to be worth a cooldown. */
const TIER_POWER_SCALE = { 1: 1.5, 2: 1.75, 3: 2.0 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type ResolvedSkill = {
  id: number;
  displayName: string;
  iconId: number;
  element: ElementId;
  kind: "physical" | "magical" | "heal";
  target: "enemy" | "self" | "allEnemies";
  hits: number;
  power: number;
  cooldownMs: number;
  castMs: number;
  tier: 1 | 2 | 3;
  status: StatusEffect | null;
  level: number;
  /** 1..5, baked from pet_skill_mastery */
  masteryLevel?: number;
  healBasis: "matk" | "maxHp" | null;
};

/**
 * A pet's skill level is its species base level plus the rarity bonus. This is
 * how two pets of the same species still differ meaningfully.
 */
export function skillLevelFor(baseLevel: number, rarity: Rarity): number {
  return clamp(baseLevel + RARITY[rarity].skillBonus, 1, MAX_SKILL_LEVEL);
}

export function resolveSkill(
  skill: GeneratedSkill,
  level: number,
  attackerElement: ElementId,
): ResolvedSkill {
  const clamped = clamp(Math.round(level), 1, MAX_SKILL_LEVEL);
  const powerMult = 1 + (clamped - 1) * 0.08;
  const cooldownMs = Math.max(1500, Math.round(skill.cooldownMs - (clamped - 1) * 120));

  const status = skill.status
    ? {
        ...skill.status,
        chance: Math.min(0.9, skill.status.chance * (1 + (clamped - 1) * 0.03)),
      }
    : null;

  return {
    id: skill.id,
    displayName: skill.displayName,
    iconId: skill.iconId,
    element: skill.element ?? attackerElement,
    kind: skill.kind,
    target: skill.target,
    hits: skill.hits,
    power: Math.round(skill.power * powerMult * TIER_POWER_SCALE[skill.tier]),
    cooldownMs,
    castMs: skill.castMs,
    tier: skill.tier,
    status,
    level: clamped,
    healBasis: skill.healBasis,
  };
}

export function isSupportSkill(skill: { target: string; kind: string }): boolean {
  return skill.target === "self" || skill.kind === "heal";
}

/**
 * The default four are the first three attacks plus one support, which is the
 * shape the old fixed kits had. Players can replace any of them in the team UI.
 */
export function defaultLoadout(skills: Array<{ id: number }>): number[] {
  const definitions = skills
    .map((slot) => ({ id: slot.id, definition: getSkill(slot.id) }))
    .filter((entry): entry is { id: number; definition: GeneratedSkill } => Boolean(entry.definition));

  const offense = definitions.filter((entry) => !isSupportSkill(entry.definition));
  const support = definitions.filter((entry) => isSupportSkill(entry.definition));

  const chosen = [
    ...offense.slice(0, 3).map((entry) => entry.id),
    ...support.slice(0, 1).map((entry) => entry.id),
  ];

  for (const entry of definitions) {
    if (chosen.length >= LOADOUT_SIZE) break;
    if (!chosen.includes(entry.id)) chosen.push(entry.id);
  }

  return chosen.slice(0, LOADOUT_SIZE);
}

export function normalizeLoadout(
  skills: Array<{ id: number }>,
  requested?: number[] | null,
): number[] {
  const available = new Set(skills.map((slot) => slot.id));

  if (requested) {
    const unique = [...new Set(requested)];
    if (unique.length === LOADOUT_SIZE && unique.every((id) => available.has(id))) {
      return unique;
    }
  }

  return defaultLoadout(skills);
}
