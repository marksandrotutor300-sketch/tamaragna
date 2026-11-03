import type { Rng } from "@/lib/rng";
import type { CardDeck, CardInstance, CardRuneId } from "./types";

export function emptyDeck(): CardDeck {
  return { cards: [], nextInstanceId: 1 };
}

export function addCard(
  deck: CardDeck,
  cardId: string,
  ownerPetId: string,
  upgraded = false,
): { deck: CardDeck; instance: CardInstance } {
  const instance: CardInstance = {
    instanceId: `c${deck.nextInstanceId}`,
    cardId,
    ownerPetId,
    upgraded,
  };
  return {
    deck: {
      cards: [...deck.cards, instance],
      nextInstanceId: deck.nextInstanceId + 1,
    },
    instance,
  };
}

export function removeCard(deck: CardDeck, instanceId: string): CardDeck {
  return {
    ...deck,
    cards: deck.cards.filter((card) => card.instanceId !== instanceId),
  };
}

export function upgradeInstance(deck: CardDeck, instanceId: string): CardDeck {
  return {
    ...deck,
    cards: deck.cards.map((card) =>
      card.instanceId === instanceId ? { ...card, upgraded: true } : card,
    ),
  };
}

export function signatureInstance(deck: CardDeck, instanceId: string): CardDeck {
  return {
    ...deck,
    cards: deck.cards.map((card) =>
      card.instanceId === instanceId
        ? { ...card, upgraded: true, signature: true }
        : card,
    ),
  };
}

export function inscribeInstance(
  deck: CardDeck,
  instanceId: string,
  rune: CardRuneId,
): CardDeck {
  return {
    ...deck,
    cards: deck.cards.map((card) =>
      card.instanceId === instanceId ? { ...card, rune } : card,
    ),
  };
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = rng.int(0, index);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
