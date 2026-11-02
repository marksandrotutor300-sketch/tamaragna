/**
 * Hand-authored combat model for a curated subset of rAthena skills.
 *
 * Only skills listed here can appear in a pet's kit. Everything else in
 * mob_skill_db is treated as non-combat flavour and ignored. Power values are
 * percentages of ATK (physical) or MATK (magical) and are authored for this
 * game's balance, not copied from Ragnarok Online formulas.
 */

export type ElementId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type StatusKind =
  | "poison"
  | "stun"
  | "slow"
  | "atkUp"
  | "defUp"
  | "shield"
  | "haste"
  | "defDown";

export type StatusEffect = {
  kind: StatusKind;
  chance: number;
  durationMs: number;
  magnitude: number;
};

export type SkillEffect = {
  /** percent of ATK or MATK per hit */
  power: number;
  kind: "physical" | "magical" | "heal";
  hits: number;
  target: "enemy" | "self" | "allEnemies";
  cooldownMs: number;
  castMs: number;
  /** 1 = basic, 2 = strong, 3 = signature */
  tier: 1 | 2 | 3;
  status?: StatusEffect;
  healBasis?: "matk" | "maxHp";
};

const stun = (chance: number, durationMs: number): StatusEffect => ({
  kind: "stun",
  chance,
  durationMs,
  magnitude: 0,
});

const poison = (chance: number, durationMs: number, magnitude: number): StatusEffect => ({
  kind: "poison",
  chance,
  durationMs,
  magnitude,
});

export const SKILL_EFFECTS: Record<number, SkillEffect> = {
  // ------------------------------------------------------------------ basics
  5: { power: 120, kind: "physical", hits: 1, target: "enemy", cooldownMs: 4000, castMs: 0, tier: 1 }, // SM_BASH
  42: { power: 145, kind: "physical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 2 }, // MC_MAMMONITE
  46: { power: 60, kind: "physical", hits: 2, target: "enemy", cooldownMs: 4000, castMs: 0, tier: 1 }, // AC_DOUBLE
  52: { power: 85, kind: "physical", hits: 1, target: "enemy", cooldownMs: 6000, castMs: 0, tier: 2, status: poison(0.3, 6000, 0.03) }, // TF_POISON
  57: { power: 130, kind: "physical", hits: 1, target: "enemy", cooldownMs: 6000, castMs: 0, tier: 2 }, // KN_BRANDISHSPEAR
  136: { power: 55, kind: "physical", hits: 3, target: "enemy", cooldownMs: 8000, castMs: 0, tier: 3 }, // AS_SONICBLOW
  149: { power: 80, kind: "physical", hits: 1, target: "enemy", cooldownMs: 4500, castMs: 0, tier: 1, status: { kind: "slow", chance: 0.2, durationMs: 4000, magnitude: 0.2 } }, // TF_SPRINKLESAND

  // ------------------------------------------------------------- mob physical
  158: { power: 110, kind: "physical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 2 }, // NPC_PIERCINGATT
  170: { power: 140, kind: "physical", hits: 1, target: "enemy", cooldownMs: 6000, castMs: 0, tier: 2 }, // NPC_CRITICALSLASH
  171: { power: 65, kind: "physical", hits: 2, target: "enemy", cooldownMs: 5500, castMs: 0, tier: 2 }, // NPC_COMBOATTACK
  172: { power: 100, kind: "physical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 1 }, // NPC_GUIDEDATTACK
  174: { power: 90, kind: "physical", hits: 1, target: "allEnemies", cooldownMs: 8000, castMs: 0, tier: 3 }, // NPC_SPLASHATTACK
  176: { power: 85, kind: "physical", hits: 1, target: "enemy", cooldownMs: 6000, castMs: 0, tier: 2, status: poison(0.25, 8000, 0.035) }, // NPC_POISON
  177: { power: 85, kind: "physical", hits: 1, target: "enemy", cooldownMs: 6000, castMs: 0, tier: 2, status: { kind: "defDown", chance: 0.25, durationMs: 6000, magnitude: 0.15 } }, // NPC_BLINDATTACK
  178: { power: 85, kind: "physical", hits: 1, target: "enemy", cooldownMs: 6000, castMs: 0, tier: 2, status: stun(0.15, 1200) }, // NPC_SILENCEATTACK
  179: { power: 90, kind: "physical", hits: 1, target: "enemy", cooldownMs: 7000, castMs: 0, tier: 2, status: stun(0.25, 1500) }, // NPC_STUNATTACK
  181: { power: 90, kind: "physical", hits: 1, target: "enemy", cooldownMs: 6500, castMs: 0, tier: 2 }, // NPC_CURSEATTACK
  182: { power: 80, kind: "physical", hits: 1, target: "enemy", cooldownMs: 7000, castMs: 0, tier: 2, status: stun(0.3, 1800) }, // NPC_SLEEPATTACK
  199: { power: 90, kind: "physical", hits: 1, target: "enemy", cooldownMs: 7000, castMs: 0, tier: 2 }, // NPC_BLOODDRAIN (lifesteal)
  344: { power: 95, kind: "physical", hits: 1, target: "enemy", cooldownMs: 7000, castMs: 0, tier: 2, status: { kind: "defDown", chance: 0.35, durationMs: 8000, magnitude: 0.25 } }, // NPC_ARMORBRAKE
  660: { power: 90, kind: "physical", hits: 1, target: "enemy", cooldownMs: 6000, castMs: 0, tier: 2, status: poison(0.3, 6000, 0.04) }, // NPC_BLEEDING
  661: { power: 50, kind: "physical", hits: 3, target: "enemy", cooldownMs: 9000, castMs: 0, tier: 3 }, // NPC_PULSESTRIKE
  673: { power: 110, kind: "physical", hits: 1, target: "enemy", cooldownMs: 6000, castMs: 0, tier: 2 }, // NPC_CRITICALWOUND
  742: { power: 130, kind: "magical", hits: 1, target: "enemy", cooldownMs: 8000, castMs: 400, tier: 3 }, // NPC_POISON_BUSTER

  // --------------------------------------------------------------- mob magic
  159: { power: 90, kind: "magical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 2 }, // NPC_MENTALBREAKER
  202: { power: 150, kind: "magical", hits: 1, target: "enemy", cooldownMs: 9000, castMs: 600, tier: 3 }, // NPC_DARKBREATH
  340: { power: 45, kind: "magical", hits: 3, target: "enemy", cooldownMs: 8000, castMs: 500, tier: 3 }, // NPC_DARKSTRIKE
  653: { power: 55, kind: "magical", hits: 3, target: "allEnemies", cooldownMs: 15000, castMs: 900, tier: 3 }, // NPC_EARTHQUAKE
  654: { power: 140, kind: "magical", hits: 1, target: "enemy", cooldownMs: 9000, castMs: 500, tier: 3 }, // NPC_FIREBREATH
  655: { power: 140, kind: "magical", hits: 1, target: "enemy", cooldownMs: 9000, castMs: 500, tier: 3 }, // NPC_ICEBREATH
  658: { power: 140, kind: "magical", hits: 1, target: "enemy", cooldownMs: 9000, castMs: 500, tier: 3 }, // NPC_DARKNESSBREATH
  662: { power: 40, kind: "magical", hits: 4, target: "allEnemies", cooldownMs: 14000, castMs: 800, tier: 3 }, // NPC_HELLJUDGEMENT
  724: { power: 70, kind: "magical", hits: 2, target: "allEnemies", cooldownMs: 12000, castMs: 700, tier: 3 }, // NPC_FIRESTORM

  // ------------------------------------------------------ element attribute
  184: { power: 95, kind: "physical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 1 }, // NPC_WATERATTACK
  185: { power: 95, kind: "physical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 1 }, // NPC_GROUNDATTACK
  186: { power: 95, kind: "physical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 1 }, // NPC_FIREATTACK
  187: { power: 95, kind: "physical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 1 }, // NPC_WINDATTACK
  188: { power: 95, kind: "physical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 1, status: poison(0.2, 6000, 0.03) }, // NPC_POISONATTACK
  189: { power: 95, kind: "physical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 1 }, // NPC_HOLYATTACK
  190: { power: 95, kind: "physical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 1 }, // NPC_DARKNESSATTACK
  191: { power: 95, kind: "physical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 1 }, // NPC_TELEKINESISATTACK
  347: { power: 95, kind: "physical", hits: 1, target: "enemy", cooldownMs: 5000, castMs: 0, tier: 1 }, // NPC_UNDEADATTACK

  // -------------------------------------------------------------- player magic
  14: { power: 25, kind: "magical", hits: 5, target: "enemy", cooldownMs: 6000, castMs: 500, tier: 2 }, // MG_COLDBOLT
  15: { power: 80, kind: "magical", hits: 1, target: "enemy", cooldownMs: 7000, castMs: 400, tier: 2, status: stun(0.3, 1500) }, // MG_FROSTDIVER
  19: { power: 25, kind: "magical", hits: 5, target: "enemy", cooldownMs: 6000, castMs: 500, tier: 2 }, // MG_FIREBOLT
  20: { power: 25, kind: "magical", hits: 5, target: "enemy", cooldownMs: 6000, castMs: 500, tier: 2 }, // MG_LIGHTNINGBOLT
  21: { power: 50, kind: "magical", hits: 3, target: "allEnemies", cooldownMs: 12000, castMs: 700, tier: 3 }, // MG_THUNDERSTORM
  7: { power: 110, kind: "physical", hits: 1, target: "allEnemies", cooldownMs: 8000, castMs: 0, tier: 2 }, // SM_MAGNUM (fire)
  83: { power: 60, kind: "magical", hits: 3, target: "allEnemies", cooldownMs: 15000, castMs: 1000, tier: 3 }, // WZ_METEOR
  84: { power: 50, kind: "magical", hits: 3, target: "enemy", cooldownMs: 8000, castMs: 500, tier: 3 }, // WZ_JUPITEL
  86: { power: 45, kind: "magical", hits: 4, target: "enemy", cooldownMs: 9000, castMs: 600, tier: 3 }, // WZ_WATERBALL
  89: { power: 60, kind: "magical", hits: 3, target: "allEnemies", cooldownMs: 15000, castMs: 1000, tier: 3 }, // WZ_STORMGUST
  91: { power: 70, kind: "magical", hits: 2, target: "enemy", cooldownMs: 8000, castMs: 400, tier: 2 }, // WZ_HEAVENDRIVE

  // ------------------------------------------------------------------ support
  28: { power: 120, kind: "heal", hits: 1, target: "self", cooldownMs: 7000, castMs: 300, tier: 2, healBasis: "matk" }, // AL_HEAL
  29: { power: 0, kind: "magical", hits: 1, target: "self", cooldownMs: 12000, castMs: 0, tier: 2, status: { kind: "haste", chance: 1, durationMs: 10000, magnitude: 0.25 } }, // AL_INCAGI
  34: { power: 0, kind: "magical", hits: 1, target: "self", cooldownMs: 12000, castMs: 0, tier: 2, status: { kind: "atkUp", chance: 1, durationMs: 10000, magnitude: 0.2 } }, // AL_BLESSING
  60: { power: 0, kind: "physical", hits: 1, target: "self", cooldownMs: 12000, castMs: 0, tier: 2, status: { kind: "haste", chance: 1, durationMs: 10000, magnitude: 0.2 } }, // KN_TWOHANDQUICKEN
  114: { power: 0, kind: "physical", hits: 1, target: "self", cooldownMs: 13000, castMs: 0, tier: 2, status: { kind: "atkUp", chance: 1, durationMs: 9000, magnitude: 0.25 } }, // BS_MAXIMIZE
  249: { power: 0, kind: "physical", hits: 1, target: "self", cooldownMs: 12000, castMs: 0, tier: 2, status: { kind: "shield", chance: 1, durationMs: 8000, magnitude: 0.25 } }, // CR_AUTOGUARD
  252: { power: 0, kind: "physical", hits: 1, target: "self", cooldownMs: 14000, castMs: 0, tier: 3, status: { kind: "shield", chance: 1, durationMs: 7000, magnitude: 0.2 } }, // CR_REFLECTSHIELD
  349: { power: 0, kind: "physical", hits: 1, target: "self", cooldownMs: 12000, castMs: 0, tier: 2, status: { kind: "atkUp", chance: 1, durationMs: 10000, magnitude: 0.2 } }, // NPC_POWERUP
  350: { power: 0, kind: "physical", hits: 1, target: "self", cooldownMs: 12000, castMs: 0, tier: 2, status: { kind: "haste", chance: 1, durationMs: 10000, magnitude: 0.2 } }, // NPC_AGIUP
  675: { power: 0, kind: "magical", hits: 1, target: "self", cooldownMs: 14000, castMs: 0, tier: 3, status: { kind: "defUp", chance: 1, durationMs: 10000, magnitude: 0.4 } }, // NPC_STONESKIN
  687: { power: 45, kind: "heal", hits: 1, target: "self", cooldownMs: 20000, castMs: 600, tier: 3, healBasis: "maxHp" }, // NPC_ALLHEAL
};

/** Skill element overrides where the RO data file is ambiguous or per-level. */
export const SKILL_ELEMENT_OVERRIDE: Record<number, ElementId> = {
  5: 0,
  7: 3,
  14: 1,
  15: 1,
  19: 3,
  20: 4,
  21: 4,
  28: 6,
  29: 0,
  34: 0,
  42: 0,
  46: 0,
  52: 5,
  57: 0,
  60: 0,
  83: 3,
  84: 4,
  86: 1,
  89: 1,
  91: 2,
  114: 0,
  136: 0,
  149: 2,
  158: 0,
  159: 8,
  170: 0,
  171: 0,
  172: 0,
  174: 0,
  176: 5,
  177: 0,
  178: 0,
  179: 0,
  181: 7,
  182: 0,
  184: 1,
  185: 2,
  186: 3,
  187: 4,
  188: 5,
  189: 6,
  190: 7,
  191: 8,
  199: 7,
  202: 7,
  249: 0,
  252: 0,
  340: 7,
  344: 0,
  347: 9,
  349: 0,
  350: 0,
  653: 2,
  654: 3,
  655: 1,
  658: 7,
  660: 0,
  661: 0,
  662: 7,
  673: 0,
  675: 0,
  687: 6,
  724: 3,
  742: 5,
};

/**
 * Fallback kits used to pad species that have fewer than four usable skills in
 * mob_skill_db. Ordered strongest-last; the builder takes what it needs.
 */
export const ELEMENT_KITS: Record<ElementId, number[]> = {
  0: [170, 171, 349, 5],
  1: [184, 14, 86, 15],
  2: [185, 149, 91, 179],
  3: [186, 19, 7, 654],
  4: [187, 20, 84, 21],
  5: [188, 176, 52, 742],
  6: [189, 28, 34, 252],
  7: [190, 202, 340, 181],
  8: [191, 159, 675, 673],
  9: [347, 176, 181, 660],
};

/**
 * Neutral offensive skills used to pad kits without flooding a species with
 * support abilities. Ordered from basic to signature.
 */
export const NEUTRAL_PAD_KIT = [170, 171, 5, 42, 136, 661, 673];

export const ELEMENT_NAMES = [
  "Neutral",
  "Water",
  "Earth",
  "Fire",
  "Wind",
  "Poison",
  "Holy",
  "Dark",
  "Ghost",
  "Undead",
] as const;

export const ELEMENT_COLORS = [
  "#c8c8b8",
  "#4aa3ff",
  "#b07a3a",
  "#ff6b3d",
  "#8fe36b",
  "#a45bd0",
  "#ffd75e",
  "#8b5cf6",
  "#7de3e0",
  "#9a8a7a",
] as const;

export const SIZE_NAMES = ["Small", "Medium", "Large"] as const;

export const RACE_NAMES = [
  "Formless",
  "Undead",
  "Brute",
  "Plant",
  "Insect",
  "Fish",
  "Demon",
  "Demihuman",
  "Angel",
  "Dragon",
  "Boss",
] as const;
