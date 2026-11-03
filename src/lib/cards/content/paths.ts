export type RiftPathDefinition = {
  id: string;
  name: string;
  description: string;
  championHpMultiplier: number;
  enemyHpMultiplier: number;
  enemyDamageMultiplier: number;
  startGold: number;
  rewardBonus: number;
  restBonus: number;
  shopDiscount: number;
  scoreMultiplier: number;
};

export const RIFT_PATHS: RiftPathDefinition[] = [
  {
    id: "balanced",
    name: "The Balanced Path",
    description: "No modifiers. A clean three-act expedition.",
    championHpMultiplier: 1,
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 1,
    startGold: 0,
    rewardBonus: 0,
    restBonus: 0,
    shopDiscount: 0,
    scoreMultiplier: 1,
  },
  {
    id: "ember",
    name: "The Ember Path",
    description: "Enemies have more HP, but Ember runs score higher and start with gold.",
    championHpMultiplier: 1,
    enemyHpMultiplier: 1.1,
    enemyDamageMultiplier: 1,
    startGold: 25,
    rewardBonus: 0,
    restBonus: 0,
    shopDiscount: 0,
    scoreMultiplier: 1.15,
  },
  {
    id: "root",
    name: "The Root Path",
    description: "Champions gain 10% max HP and rest sites heal more.",
    championHpMultiplier: 1.1,
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 1,
    startGold: 0,
    rewardBonus: 0,
    restBonus: 0.1,
    shopDiscount: 0,
    scoreMultiplier: 1,
  },
  {
    id: "tide",
    name: "The Tide Path",
    description: "Card rewards offer one extra choice and shops are 10% cheaper.",
    championHpMultiplier: 1,
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 1,
    startGold: 0,
    rewardBonus: 1,
    restBonus: 0,
    shopDiscount: 0.1,
    scoreMultiplier: 1,
  },
  {
    id: "shadow",
    name: "The Shadow Path",
    description: "Champions have 10% less HP, but gain 50 gold and 25% more score.",
    championHpMultiplier: 0.9,
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 1,
    startGold: 50,
    rewardBonus: 0,
    restBonus: 0,
    shopDiscount: 0,
    scoreMultiplier: 1.25,
  },
];

const BY_ID = new Map(RIFT_PATHS.map((path) => [path.id, path]));

export function getRiftPath(id: string | null | undefined): RiftPathDefinition {
  return BY_ID.get(id ?? "balanced") ?? RIFT_PATHS[0];
}

export function allRiftPaths(): RiftPathDefinition[] {
  return RIFT_PATHS;
}
