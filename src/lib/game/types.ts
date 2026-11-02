export type ElementId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type Rarity = 1 | 2 | 3 | 4 | 5;

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
  power: number;
  kind: "physical" | "magical" | "heal";
  hits: number;
  target: "enemy" | "self" | "allEnemies";
  cooldownMs: number;
  castMs: number;
  tier: 1 | 2 | 3;
  status?: StatusEffect;
  /** how a heal skill converts its power into restored HP */
  healBasis?: "matk" | "maxHp";
};

export type GeneratedSkill = {
  id: number;
  name: string;
  displayName: string;
  /** null means the skill inherits the attacker's element */
  element: ElementId | null;
  kind: "physical" | "magical" | "heal";
  target: "enemy" | "self" | "allEnemies";
  hits: number;
  power: number;
  cooldownMs: number;
  castMs: number;
  tier: 1 | 2 | 3;
  status: StatusEffect | null;
  iconId: number;
  healBasis: "matk" | "maxHp" | null;
};

export type BaseStats = {
  hp: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  aspdMs: number;
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
};

export type GeneratedSpecies = {
  id: number;
  aegisName: string;
  name: string;
  tier: Rarity;
  level: number;
  element: ElementId;
  elementLevel: number;
  race: number;
  raceName: string;
  size: number;
  sizeName: string;
  mvp: boolean;
  boss: boolean;
  /** false for test dummies, champion variants and scripted structures */
  playable: boolean;
  base: BaseStats;
  skills: Array<{ id: number; baseLevel: number }>;
  spawnMaps: string[];
};

export type Ivs = {
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
};

export type CareState = {
  hunger: number;
  mood: number;
  energy: number;
  friendship: number;
  lastCareAt: string;
  sleeping: boolean;
};

export type CareAction = "feed" | "play" | "rest" | "wake" | "train";
