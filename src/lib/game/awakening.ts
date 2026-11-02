export const MAX_STAR = 5;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Each star adds 4% to HP, ATK, MATK, DEF and MDEF. */
export function starMultiplier(star: number): number {
  return 1 + 0.04 * (clamp(Math.round(star), 1, MAX_STAR) - 1);
}

/** Coins consumed to merge a duplicate into a pet of the given star. */
export function awakenCost(star: number): number {
  return 150 * clamp(Math.round(star), 1, MAX_STAR - 1);
}
