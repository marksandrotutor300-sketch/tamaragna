import type { ElementId } from "@/lib/game/types";
import type { CombatStats } from "@/lib/game/stats";

export type CardRarity = "starter" | "common" | "uncommon" | "rare" | "epic";
export type CardType = "attack" | "skill" | "power";
export type CardTarget =
  | "enemy"
  | "randomEnemy"
  | "allEnemies"
  | "self"
  | "ally"
  | "allAllies"
  | "none";

export type CardStatusKind =
  | "poison"
  | "stun"
  | "slow"
  | "haste"
  | "atkUp"
  | "defUp"
  | "defDown"
  | "shield"
  | "weak"
  | "vulnerable"
  | "frail";

export type CardStatus = {
  kind: CardStatusKind;
  stacks: number;
  remaining: number;
};

export type CardEffect =
  | {
      kind: "damage";
      power: number;
      hits?: number;
      stat?: "atk" | "matk";
      target?: CardTarget;
    }
  | { kind: "block"; amount: number; target?: CardTarget }
  | {
      kind: "heal";
      amount?: number;
      power?: number;
      basis?: "matk" | "maxHp";
      target?: CardTarget;
    }
  | { kind: "draw"; amount: number }
  | { kind: "energy"; amount: number }
  | {
      kind: "status";
      status: CardStatusKind;
      stacks: number;
      turns?: number;
      chance?: number;
      target?: CardTarget;
    };

export type CardDefinition = {
  id: string;
  name: string;
  description: string;
  type: CardType;
  rarity: CardRarity;
  element: ElementId | null;
  cost: number;
  target: CardTarget;
  effects: CardEffect[];
  iconId?: number;
  exhaust?: boolean;
  skillId?: number;
  upgradedFrom?: string;
};

export type CardInstance = {
  instanceId: string;
  cardId: string;
  ownerPetId: string;
  upgraded: boolean;
  signature?: boolean;
};

export type CardDeck = {
  cards: CardInstance[];
  nextInstanceId: number;
};

export type CardChampion = {
  petId: string;
  name: string;
  speciesId: number;
  element: ElementId;
  elementLevel: number;
  stats: CombatStats;
  maxHp: number;
  hp: number;
  block: number;
  statuses: CardStatus[];
  cards: string[];
};

export type EnemyMove =
  | { kind: "attack"; power: number; hits?: number }
  | { kind: "block"; amount: number }
  | { kind: "buff"; status: CardStatusKind; stacks: number }
  | {
      kind: "debuff";
      status: CardStatusKind;
      stacks: number;
      target: "champion" | "allChampions";
    };

export type CardEnemy = {
  id: string;
  name: string;
  speciesId: number;
  element: ElementId;
  elementLevel: number;
  stats: Pick<CombatStats, "atk" | "matk" | "def" | "mdef">;
  maxHp: number;
  hp: number;
  block: number;
  statuses: CardStatus[];
  moves: EnemyMove[];
  intent: EnemyMove;
};

export type CardEvent = {
  type: string;
  text: string;
  targetId?: string;
  amount?: number;
};

export type CardBattleResult = {
  winner: "player" | "enemy";
  turns: number;
  checksum: string;
};

export type CardBattleState = {
  seed: string;
  turn: number;
  phase: "player" | "enemy" | "won" | "lost";
  energy: number;
  maxEnergy: number;
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  champions: CardChampion[];
  enemies: CardEnemy[];
  relics: string[];
  edicts: string[];
  events: CardEvent[];
  firstAttackUsed: boolean;
  secondWindUsed: boolean;
  rngCounter: number;
  result: CardBattleResult | null;
};

export type CardAction =
  | { kind: "playCard"; instanceId: string; targetId?: string }
  | { kind: "endTurn" };

export type CardNodeType =
  | "battle"
  | "elite"
  | "event"
  | "rest"
  | "shop"
  | "treasure"
  | "boss";

export type CardNode = {
  id: string;
  act: number;
  floor: number;
  type: CardNodeType;
  next: string[];
};

export type CardActMap = {
  act: number;
  name: string;
  nodes: CardNode[];
};

export type CardMap = {
  acts: CardActMap[];
};

export type CardRewardOption = {
  kind: "card" | "relic";
  id: string;
  name: string;
  description: string;
  rarity?: CardRarity;
  price?: number;
};

export type CardEventOption = {
  id: string;
  label: string;
  description: string;
  effect:
    | { kind: "heal"; amount: number }
    | { kind: "gold"; amount: number }
    | { kind: "card"; cardId: string }
    | { kind: "relic"; relicId: string }
    | { kind: "damage"; amount: number };
};

export type PendingNode =
  | {
      kind: "reward";
      nodeId: string;
      options: CardRewardOption[];
      relic?: CardRewardOption;
    }
  | { kind: "rest"; nodeId: string }
  | {
      kind: "shop";
      nodeId: string;
      cards: CardRewardOption[];
      relic?: CardRewardOption;
      removalCost: number;
    }
  | {
      kind: "event";
      nodeId: string;
      eventId: string;
      title: string;
      body: string;
      options: CardEventOption[];
    };

export type CardRunStatus = "active" | "won" | "lost" | "abandoned";

export type CardRunData = {
  id: string;
  ownerId: string;
  seed: string;
  status: CardRunStatus;
  act: number;
  nodeId: string | null;
  map: CardMap;
  deck: CardDeck;
  relics: string[];
  champions: CardChampion[];
  runGold: number;
  ascension: number;
  path: string;
  edicts: string[];
  pending: PendingNode | null;
  score: number;
  elapsedMs: number;
  season: number;
  startedAt: string;
  endedAt: string | null;
  completedNodeIds: string[];
  rewardEssence: number;
};

export type CardRunView = Omit<CardRunData, "seed"> & {
  availableNodes: CardNode[];
  deckCards: Array<CardInstance & { definition: CardDefinition }>;
  relicDefinitions: RelicDefinition[];
};

export type RelicEffect = {
  startBlock?: number;
  startEnergy?: number;
  startDraw?: number;
  firstAttackBonus?: number;
  turnBlock?: number;
  drawPerTurn?: number;
  energyPerTurn?: number;
  elementBonus?: Partial<Record<ElementId, number>>;
  poisonBonus?: number;
  healAfterBattle?: number;
  shopDiscount?: number;
  restHealBonus?: number;
  maxHpBonus?: number;
  goldBonus?: number;
};

export type RelicDefinition = {
  id: string;
  name: string;
  description: string;
  rarity: CardRarity;
  effect: RelicEffect;
};

export type CardBattleView = {
  id: string;
  runId: string;
  nodeId: string;
  version: number;
  status: "pending" | "complete" | "lost";
  state: CardBattleState;
};
