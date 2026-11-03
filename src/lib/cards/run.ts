import { Rng } from "@/lib/rng";
import type { CombatantInit } from "@/lib/sim/types";
import type { ElementId } from "@/lib/game/types";
import type { CardDefinition, CardNode, CardRunData, CardRunStatus } from "./types";
import type {
  CardChampion,
  CardRewardOption,
  PendingNode,
  RelicDefinition,
} from "./types";
import { addCard, emptyDeck } from "./deck";
import { getCard, rollCardOptions } from "./content/cards";
import { getRelic, relicPoolForAct } from "./content/relics";
import { getEvent, randomEvent } from "./content/events";
import { createContracts } from "./content/contracts";
import { availableNodes, generateRunMap, nodeById, runActName } from "./map";

export const MAX_DECK_SIZE = 40;
const ALL_ELEMENTS: ElementId[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
export const CARD_RUN_WIN_REWARD = { coins: 450, materials: 8, eggs: 1, xp: 120, essence: 2 };
export const CARD_RUN_LOSS_REWARD = { coins: 120, materials: 3, eggs: 0, xp: 40, essence: 1 };
export const CARD_DAILY_CAP = { coins: 1_350, materials: 24, eggs: 1 };

export function createChampions(
  combatants: CombatantInit[],
  hpMultiplier = 1,
): CardChampion[] {
  return combatants.map((combatant) => {
    const cards = combatant.skills
      .map((skill) => `skill:${skill.id}`)
      .filter((id) => Boolean(getCard(id)));
    const maxHp = Math.max(1, Math.round(combatant.stats.hpMax * hpMultiplier));
    return {
      petId: combatant.petId,
      name: combatant.name,
      speciesId: combatant.speciesId,
      element: combatant.element,
      elementLevel: combatant.elementLevel,
      stats: { ...combatant.stats, hpMax: maxHp },
      maxHp,
      hp: maxHp,
      block: 0,
      statuses: [],
      cards: cards.length ? cards : ["neutral:jab", "neutral:guard", "neutral:jab", "neutral:guard"],
    };
  });
}

export function starterDeck(champions: CardChampion[]) {
  let deck = emptyDeck();
  for (const champion of champions) {
    for (const cardId of champion.cards) {
      deck = addCard(deck, cardId, champion.petId).deck;
    }
  }
  return deck;
}

export function championElements(champions: CardChampion[]): CardChampion[] {
  return champions;
}

export function nodeElements(champions: CardChampion[]) {
  return [...new Set(champions.map((champion) => champion.element))];
}

export function rewardForNode(
  seed: string,
  act: number,
  node: CardNode,
  deckSize: number,
  relics: string[],
  options: { cardCount?: number } = {},
): PendingNode | null {
  const requestedCards = options.cardCount ?? 3;
  if (node.type === "treasure") {
    const relic = rollRelic(seed, act, relics);
    const cards = rollCardOptions({
      seed: `${seed}:treasure:${node.id}`,
      act,
      elements: ALL_ELEMENTS,
      count: requestedCards,
    }).map(toCardOption);
    return {
      kind: "reward",
      nodeId: node.id,
      options: cards,
      relic: relic ? toRelicOption(relic) : undefined,
    };
  }
  if (node.type === "battle" || node.type === "elite" || node.type === "hunt" || node.type === "boss") {
    const elements = ALL_ELEMENTS;
    const cardCount = requestedCards;
    const cards =
      deckSize >= MAX_DECK_SIZE
        ? []
        : rollCardOptions({
            seed: `${seed}:reward:${node.id}`,
            act,
            elements,
            count: cardCount,
          }).map(toCardOption);
    const relic =
      node.type === "elite" || node.type === "hunt" || node.type === "boss"
        ? rollRelic(`${seed}:${node.id}`, act, relics)
        : undefined;
    return {
      kind: "reward",
      nodeId: node.id,
      options: cards,
      relic: relic ? toRelicOption(relic) : undefined,
    };
  }
  if (node.type === "rest") {
    return { kind: "rest", nodeId: node.id };
  }
  if (node.type === "shop") {
    const cards = rollCardOptions({
      seed: `${seed}:shop:${node.id}`,
      act,
      elements: ALL_ELEMENTS,
      count: 3,
    }).map((card) => ({
      ...toCardOption(card),
      price: card.rarity === "common" ? 40 : card.rarity === "uncommon" ? 60 : 90,
    }));
    const relic = rollRelic(`${seed}:shop:${node.id}`, act, relics);
    return {
      kind: "shop",
      nodeId: node.id,
      cards,
      relic: relic ? { ...toRelicOption(relic), price: 120 } : undefined,
      removalCost: 50,
    };
  }
  if (node.type === "event") {
    const event = randomEvent(seed, act);
    return {
      kind: "event",
      nodeId: node.id,
      eventId: event.id,
      title: event.title,
      body: event.body,
      options: event.options,
    };
  }
  return null;
}

function toCardOption(card: CardDefinition): CardRewardOption {
  return {
    kind: "card",
    id: card.id,
    name: card.name,
    description: card.description,
    rarity: card.rarity,
  };
}

function toRelicOption(relic: RelicDefinition): CardRewardOption {
  return {
    kind: "relic",
    id: relic.id,
    name: relic.name,
    description: relic.description,
    rarity: relic.rarity,
  };
}

export function rollRelic(seed: string, act: number, owned: string[]): RelicDefinition | null {
  const pool = relicPoolForAct(act).filter((relic) => !owned.includes(relic.id));
  if (!pool.length) return null;
  return new Rng(`relic:${seed}:${act}`).pick(pool);
}

export function createRun(params: {
  id: string;
  ownerId: string;
  seed: string;
  champions: CardChampion[];
  season: number;
  startedAt?: string;
  ascension?: number;
  path?: string;
  edicts?: string[];
  startGold?: number;
}): CardRunData {
  const map = generateRunMap(params.seed);
  return {
    id: params.id,
    ownerId: params.ownerId,
    seed: params.seed,
    status: "active",
    act: 1,
    nodeId: null,
    map,
    deck: starterDeck(params.champions),
    relics: [],
    champions: params.champions,
    runGold: params.startGold ?? 0,
    ascension: params.ascension ?? 0,
    path: params.path ?? "balanced",
    edicts: params.edicts ?? [],
    contracts: createContracts(params.seed),
    pending: null,
    score: 0,
    elapsedMs: 0,
    season: params.season,
    startedAt: params.startedAt ?? new Date().toISOString(),
    endedAt: null,
    completedNodeIds: [],
    rewardEssence: 0,
  };
}

export function currentActName(run: Pick<CardRunData, "map" | "act">): string {
  return runActName(run.map, run.act);
}

export function availableRunNodes(
  run: Pick<CardRunData, "map" | "nodeId" | "completedNodeIds" | "act" | "status">,
): CardNode[] {
  return availableNodes(run);
}

export function markNodeComplete(run: CardRunData, nodeId: string): CardRunData {
  return {
    ...run,
    nodeId,
    completedNodeIds: run.completedNodeIds.includes(nodeId)
      ? run.completedNodeIds
      : [...run.completedNodeIds, nodeId],
    score: run.score + 25,
  };
}

export function advanceAfterBoss(run: CardRunData): CardRunData {
  if (run.act >= 3) {
    return {
      ...run,
      status: "won",
      score: run.score + 1_000,
      endedAt: new Date().toISOString(),
    };
  }
  const next = run.act + 1;
  const healed = run.champions.map((champion) => ({
    ...champion,
    hp: Math.min(champion.maxHp, Math.round(champion.hp + champion.maxHp * 0.3)),
  }));
  return {
    ...run,
    act: next,
    nodeId: null,
    champions: healed,
    score: run.score + 500,
  };
}

export function lossRun(run: CardRunData): CardRunData {
  return {
    ...run,
    status: "lost" satisfies CardRunStatus,
    score: run.score + run.completedNodeIds.length * 10,
    endedAt: new Date().toISOString(),
  };
}

export function rewardSummary(run: CardRunData) {
  if (run.status === "won") return CARD_RUN_WIN_REWARD;
  if (run.status === "lost") return CARD_RUN_LOSS_REWARD;
  return { coins: 0, materials: 0, eggs: 0, xp: 0, essence: 0 };
}

export function ascensionScoreMultiplier(ascension: number): number {
  return 1 + Math.max(0, Math.min(5, ascension)) * 0.1;
}

export function applyScoreMultiplier(score: number, ascension: number, pathMultiplier: number): number {
  return Math.round(score * ascensionScoreMultiplier(ascension) * pathMultiplier);
}

export function nextNode(run: CardRunData): CardNode | null {
  const nodes = availableRunNodes(run);
  return nodes[0] ?? null;
}

export function nodeIsBoss(run: CardRunData, nodeId: string): boolean {
  return nodeById(run.map, nodeId)?.type === "boss";
}

export function eventById(id: string) {
  return getEvent(id);
}

export function relicById(id: string) {
  return getRelic(id);
}
