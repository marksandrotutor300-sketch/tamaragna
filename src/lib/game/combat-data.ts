import attrFixJson from "@data/generated/attr-fix.json";
import skillsJson from "@data/generated/skills.json";
import { ELEMENT_NAMES } from "./elements";
import type { ElementId, GeneratedSkill } from "./types";

const SKILLS = skillsJson as unknown as Record<string, GeneratedSkill>;
const ATTR_FIX = attrFixJson as unknown as Record<string, Record<string, Record<string, number>>>;

export function getSkill(id: number): GeneratedSkill | undefined {
  return SKILLS[String(id)];
}

export function requireSkill(id: number): GeneratedSkill {
  const skill = getSkill(id);
  if (!skill) throw new Error(`Unknown skill ${id}`);
  return skill;
}

export function allSkills(): GeneratedSkill[] {
  return Object.values(SKILLS);
}

/**
 * Percentage multiplier from the rAthena attribute table (100 = neutral).
 * `level` is the attacker element level, 1-4.
 */
export function elementMultiplier(
  attacker: ElementId,
  defender: ElementId,
  level = 1,
): number {
  const clampedLevel = Math.min(4, Math.max(1, Math.round(level)));
  const row = ATTR_FIX[String(clampedLevel)]?.[ELEMENT_NAMES[attacker]];
  const value = row?.[ELEMENT_NAMES[defender]];
  return typeof value === "number" ? value / 100 : 1;
}

/**
 * Compressed for a 1v1 auto-battler: RO's raw 150%/50% swing decides fights
 * before stats matter, so pull every multiplier toward 1 while keeping the
 * rock-paper-scissors readable.
 */
export function battleElementMultiplier(
  attacker: ElementId,
  defender: ElementId,
  level = 1,
): number {
  const raw = elementMultiplier(attacker, defender, level);
  const compressed = 1 + (raw - 1) * 0.55;
  return Math.min(1.45, Math.max(0.4, compressed));
}
