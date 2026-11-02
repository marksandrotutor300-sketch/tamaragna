import { starMultiplier } from "./awakening";
import { natureMultipliers, type NatureId } from "./nature";
import { RARITY } from "./rarity";
import type { CareState, GeneratedSpecies, Ivs, Rarity } from "./types";

export const MAX_LEVEL = 50;

export type CareModifiers = {
  atk: number;
  crit: number;
  hp: number;
};

export function careModifiers(
  care: Pick<CareState, "hunger" | "mood" | "friendship">,
): CareModifiers {
  const atk = care.hunger >= 70 ? 1 : care.hunger >= 40 ? 0.95 : 0.88;
  const crit = care.mood >= 70 ? 0.05 : care.mood < 30 ? -0.05 : 0;
  const hp = care.friendship >= 80 ? 1.05 : 1;
  return { atk, crit, hp };
}

export function levelMultiplier(level: number): number {
  return 1 + 0.02 * (Math.max(1, level) - 1);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type CombatStats = {
  hpMax: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  aspdMs: number;
  critChance: number;
  critMult: number;
  /** chance to shrug off an enemy status effect, 0..0.35 */
  statusResist: number;
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
};

/**
 * Admin-supplied final values. An override is applied after every multiplier
 * (nature, stars, evolution stage, care), so the stored number is what the
 * player sees and what battles use.
 */
export type StatOverrides = Partial<
  Pick<
    CombatStats,
    | "hpMax"
    | "atk"
    | "matk"
    | "def"
    | "mdef"
    | "aspdMs"
    | "critChance"
    | "critMult"
    | "statusResist"
  >
>;

export const STAT_OVERRIDE_KEYS = [
  "hpMax",
  "atk",
  "matk",
  "def",
  "mdef",
  "aspdMs",
  "critChance",
  "critMult",
  "statusResist",
] as const satisfies readonly (keyof StatOverrides)[];

const OVERRIDE_BOUNDS: Record<keyof StatOverrides, [number, number]> = {
  hpMax: [1, 10_000_000],
  atk: [0, 10_000_000],
  matk: [0, 10_000_000],
  def: [0, 10_000_000],
  mdef: [0, 10_000_000],
  aspdMs: [350, 2400],
  critChance: [0, 1],
  critMult: [1, 10],
  statusResist: [0, 1],
};

export function applyStatOverrides(
  stats: CombatStats,
  overrides?: StatOverrides | null,
): CombatStats {
  if (!overrides) return stats;

  const next = { ...stats };
  for (const key of STAT_OVERRIDE_KEYS) {
    const value = overrides[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const [min, max] = OVERRIDE_BOUNDS[key];
    next[key] = clamp(Math.round(value * 1000) / 1000, min, max);
  }
  return next;
}

export function computeStats(params: {
  species: GeneratedSpecies;
  rarity: Rarity;
  level: number;
  ivs: Ivs;
  care: Pick<CareState, "hunger" | "mood" | "friendship">;
  nature?: NatureId;
  star?: number;
}): CombatStats {
  const { species, rarity, level, ivs } = params;
  const care = careModifiers(params.care);
  const nature = natureMultipliers(params.nature ?? "hardy");
  const star = starMultiplier(params.star ?? 1);
  const rarityMult = RARITY[rarity].statMult;
  const levelMult = levelMultiplier(level);
  const base = species.base;

  const vit = Math.round(base.vit * (1 + ivs.vit / 200));
  const luk = Math.round(base.luk * (1 + ivs.luk / 200));

  const hpMax = Math.max(
    1,
    Math.floor(base.hp * rarityMult * levelMult * (1 + ivs.vit / 200) * care.hp * star),
  );
  const atk = Math.max(
    1,
    Math.floor(
      base.atk * rarityMult * levelMult * (1 + ivs.str / 150) * care.atk * nature.atk * star,
    ),
  );
  const matk = Math.max(
    1,
    Math.floor(
      base.matk * rarityMult * levelMult * (1 + ivs.int / 150) * care.atk * nature.matk * star,
    ),
  );
  const def = Math.floor(
    base.def * rarityMult * levelMult * (1 + ivs.vit / 200) * nature.def * star,
  );
  const mdef = Math.floor(
    base.mdef * rarityMult * levelMult * (1 + ivs.int / 200) * nature.mdef * star,
  );

  const aspdMs = clamp(
    Math.round(
      (base.aspdMs / (1 + (base.agi + ivs.agi * 2) / 500)) * nature.aspdMs,
    ),
    350,
    2400,
  );

  const critChance = clamp(0.02 + (base.luk + ivs.luk * 2) / 1200 + care.crit, 0, 0.35);
  const critMult = 1.35 + (base.dex + ivs.dex * 2) / 1000;
  const statusResist = clamp((vit * 0.4 + luk * 0.25) / 500, 0, 0.35);

  return {
    hpMax,
    atk,
    matk,
    def,
    mdef,
    aspdMs,
    critChance,
    critMult,
    statusResist,
    str: Math.round(base.str * (1 + ivs.str / 150)),
    agi: Math.round(base.agi * (1 + ivs.agi / 200)),
    vit,
    int: Math.round(base.int * (1 + ivs.int / 150)),
    dex: Math.round(base.dex * (1 + ivs.dex / 200)),
    luk,
  };
}

/** Rough power number used for sorting the roster and comparing pets. */
export function powerScore(stats: CombatStats): number {
  return Math.round(
    stats.hpMax * 0.5 +
      stats.atk * 2 +
      stats.matk * 1.5 +
      stats.def * 3 +
      stats.mdef * 2 +
      (2400 - stats.aspdMs) * 0.4,
  );
}
