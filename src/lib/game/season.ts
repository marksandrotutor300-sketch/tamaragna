import { PVP_K_FACTOR } from "./pvp";

export const PLACEMENT_MATCHES = 5;
export const PLACEMENT_K_FACTOR = 40;

export type SeasonTierDef = {
  id: string;
  name: string;
  min: number;
  coins: number;
  eggs: number;
};

export const SEASON_TIERS: SeasonTierDef[] = [
  { id: "bronze", name: "Bronze", min: 0, coins: 100, eggs: 0 },
  { id: "silver", name: "Silver", min: 1100, coins: 200, eggs: 1 },
  { id: "gold", name: "Gold", min: 1250, coins: 350, eggs: 1 },
  { id: "platinum", name: "Platinum", min: 1400, coins: 500, eggs: 2 },
  { id: "diamond", name: "Diamond", min: 1550, coins: 800, eggs: 3 },
];

export function seasonTier(rating: number): SeasonTierDef {
  let current = SEASON_TIERS[0];
  for (const tier of SEASON_TIERS) {
    if (rating >= tier.min) current = tier;
  }
  return current;
}

/** Rating reward plus a capped tower bonus (5 coins per best wave). */
export function seasonRewards(
  rating: number,
  bestWave: number,
): { tier: SeasonTierDef; coins: number; eggs: number } {
  const tier = seasonTier(rating);
  const towerBonus = Math.min(300, Math.max(0, Math.floor(bestWave)) * 5);
  return { tier, coins: tier.coins + towerBonus, eggs: tier.eggs };
}

/** Provisional ratings move faster until placement is complete. */
export function placementK(matches: number): number {
  return matches < PLACEMENT_MATCHES ? PLACEMENT_K_FACTOR : PVP_K_FACTOR;
}
