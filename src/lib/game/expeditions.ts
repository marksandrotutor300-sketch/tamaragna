export type ExpeditionRoute = {
  id: string;
  name: string;
  description: string;
  minutes: number;
  coins: number;
  eggs: number;
  materials: number;
  minLevel: number;
};

export const EXPEDITION_ROUTES: ExpeditionRoute[] = [
  {
    id: "verdant-trail",
    name: "Verdant Trail",
    description: "A short forage through the mossy lowlands.",
    minutes: 15,
    coins: 180,
    eggs: 0,
    materials: 4,
    minLevel: 1,
  },
  {
    id: "ember-pass",
    name: "Ember Pass",
    description: "A hot crossing with mineral-rich caches.",
    minutes: 60,
    coins: 500,
    eggs: 0,
    materials: 10,
    minLevel: 10,
  },
  {
    id: "abyssal-rift",
    name: "Abyssal Rift",
    description: "A long, dangerous route with a chance at an egg.",
    minutes: 180,
    coins: 1_200,
    eggs: 1,
    materials: 20,
    minLevel: 25,
  },
];

export function getExpeditionRoute(id: string): ExpeditionRoute | null {
  return EXPEDITION_ROUTES.find((route) => route.id === id) ?? null;
}

export function expeditionRewards(
  route: ExpeditionRoute,
  pets: Array<{ level: number; care: { friendship: number } }>,
): { coins: number; eggs: number; materials: number } {
  const levelBonus = Math.min(0.5, pets.reduce((sum, pet) => sum + pet.level, 0) / 150);
  const bondBonus = Math.min(
    0.3,
    pets.reduce((sum, pet) => sum + pet.care.friendship, 0) / 1000,
  );
  return {
    coins: Math.round(route.coins * (1 + levelBonus + bondBonus)),
    eggs: route.eggs,
    materials: Math.round(route.materials * (1 + bondBonus)),
  };
}
