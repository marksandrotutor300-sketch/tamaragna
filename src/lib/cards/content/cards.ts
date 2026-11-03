import { Rng } from "@/lib/rng";
import type { ElementId } from "@/lib/game/types";
import { allSkillCards, getSkillCard } from "./skill-cards";
import { NEUTRAL_CARDS } from "./neutral-cards";
import type { CardDefinition, CardEffect, CardRarity } from "../types";

const CARD_CACHE = new Map<string, CardDefinition>();
let ALL_CACHE: CardDefinition[] | null = null;

export function allCards(): CardDefinition[] {
  if (!ALL_CACHE) {
    ALL_CACHE = [...allSkillCards(), ...NEUTRAL_CARDS];
    for (const card of ALL_CACHE) CARD_CACHE.set(card.id, card);
  }
  return ALL_CACHE;
}

export function getCard(cardId: string): CardDefinition | undefined {
  if (!CARD_CACHE.size) allCards();
  return CARD_CACHE.get(cardId);
}

function upgradeEffect(effect: CardEffect): CardEffect {
  switch (effect.kind) {
    case "damage":
      return { ...effect, power: Math.round(effect.power * 1.25) };
    case "block":
      return { ...effect, amount: effect.amount + 3 };
    case "heal":
      return {
        ...effect,
        amount: effect.amount ? effect.amount + 3 : effect.amount,
        power: effect.power ? Math.round(effect.power * 1.25) : effect.power,
      };
    case "draw":
      return { ...effect, amount: effect.amount + 1 };
    case "status":
      return { ...effect, stacks: effect.stacks + 1 };
    default:
      return effect;
  }
}

export function upgradedCard(card: CardDefinition): CardDefinition {
  const id = `${card.id}+`;
  const cached = CARD_CACHE.get(id);
  if (cached) return cached;

  const upgraded: CardDefinition = {
    ...card,
    id,
    name: `${card.name}+`,
    description: `${card.description} · upgraded`,
    cost: Math.max(0, card.cost - 1),
    effects: card.effects.map(upgradeEffect),
    upgradedFrom: card.id,
  };
  CARD_CACHE.set(id, upgraded);
  return upgraded;
}

export function cardForInstance(
  cardId: string,
  upgraded: boolean,
  signature = false,
): CardDefinition | undefined {
  const base = getCard(cardId);
  if (!base) return undefined;
  if (signature) return signatureCard(base);
  return upgraded ? upgradedCard(base) : base;
}

export function signatureCard(card: CardDefinition): CardDefinition {
  const first = upgradedCard(card);
  const id = `${first.id}+`;
  const cached = CARD_CACHE.get(id);
  if (cached) return cached;

  const signature: CardDefinition = {
    ...first,
    id,
    name: `${card.name}++`,
    description: `${card.description} · signature`,
    cost: Math.max(0, first.cost - 1),
    effects: first.effects.map(upgradeEffect),
    upgradedFrom: first.id,
  };
  CARD_CACHE.set(id, signature);
  return signature;
}

const RARITY_WEIGHTS: Record<CardRarity, number> = {
  starter: 0,
  common: 50,
  uncommon: 32,
  rare: 14,
  epic: 4,
};

export function cardPoolForAct(act: number, elements: ElementId[]): CardDefinition[] {
  const elementSet = new Set(elements);
  return allCards().filter((card) => {
    if (card.rarity === "starter") return false;
    if (card.element !== null && !elementSet.has(card.element)) return false;
    if (act === 1) return card.rarity === "common" || card.rarity === "uncommon";
    if (act === 2) return card.rarity === "uncommon" || card.rarity === "rare";
    return card.rarity === "rare" || card.rarity === "epic" || card.rarity === "uncommon";
  });
}

export function rollCardOptions(params: {
  seed: string;
  act: number;
  elements: ElementId[];
  count: number;
  exclude?: string[];
}): CardDefinition[] {
  const rng = new Rng(params.seed);
  const excluded = new Set(params.exclude ?? []);
  const pool = cardPoolForAct(params.act, params.elements).filter(
    (card) => !excluded.has(card.id),
  );
  const chosen: CardDefinition[] = [];

  while (chosen.length < params.count && pool.length > 0) {
    const weights = pool.map((card) => Math.max(1, RARITY_WEIGHTS[card.rarity]));
    const picked = rng.weighted(pool, weights);
    const index = pool.indexOf(picked);
    if (index >= 0) pool.splice(index, 1);
    if (picked && !chosen.some((card) => card.id === picked.id)) chosen.push(picked);
  }

  return chosen;
}

export function skillCardForId(skillId: number): CardDefinition | undefined {
  return getSkillCard(skillId);
}

export function starterCard(cardId: string): CardDefinition {
  return getCard(cardId) ?? NEUTRAL_CARDS[2];
}
