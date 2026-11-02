export const PVP_K_FACTOR = 24;
export const PVP_SEARCH_RANGE = 150;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function eloDelta(
  ratingA: number,
  ratingB: number,
  scoreA: 0 | 0.5 | 1,
  k = PVP_K_FACTOR,
): number {
  const expected = expectedScore(ratingA, ratingB);
  return Math.round(k * (scoreA - expected));
}
