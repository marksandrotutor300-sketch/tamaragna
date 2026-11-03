import { Rng } from "@/lib/rng";
import type { CardEventOption } from "../types";

export type CardEventDefinition = {
  id: string;
  title: string;
  body: string;
  act: number[];
  options: CardEventOption[];
};

export const EVENTS: CardEventDefinition[] = [
  {
    id: "moss-shrine",
    title: "Moss Shrine",
    body: "A stone altar drinks the mist. Something small rustles beneath it.",
    act: [1, 2, 3],
    options: [
      {
        id: "pray",
        label: "Pray",
        description: "Heal your squad for 18% of max HP.",
        effect: { kind: "heal", amount: 18 },
      },
      {
        id: "search",
        label: "Search the roots",
        description: "Gain 35 run gold.",
        effect: { kind: "gold", amount: 35 },
      },
    ],
  },
  {
    id: "wandering-smith",
    title: "Wandering Smith",
    body: "A smith with no face offers to sharpen something you carry.",
    act: [1, 2, 3],
    options: [
      {
        id: "sharpen",
        label: "Sharpen a card",
        description: "Upgrade a random card in your deck.",
        effect: { kind: "card", cardId: "upgrade-random" },
      },
      {
        id: "coin",
        label: "Take the coin",
        description: "Gain 40 run gold.",
        effect: { kind: "gold", amount: 40 },
      },
    ],
  },
  {
    id: "mirror-pool",
    title: "Mirror Pool",
    body: "Your reflection moves a heartbeat late.",
    act: [1, 2],
    options: [
      {
        id: "drink",
        label: "Drink",
        description: "Heal 25% and take 8 damage.",
        effect: { kind: "heal", amount: 25 },
      },
      {
        id: "leave",
        label: "Leave",
        description: "Gain 20 run gold.",
        effect: { kind: "gold", amount: 20 },
      },
    ],
  },
  {
    id: "sealed-cache",
    title: "Sealed Cache",
    body: "A cache hums with an element you cannot name.",
    act: [1, 2, 3],
    options: [
      {
        id: "open",
        label: "Open it",
        description: "Gain a random relic.",
        effect: { kind: "relic", relicId: "random" },
      },
      {
        id: "ignore",
        label: "Leave it sealed",
        description: "Heal 15% of max HP.",
        effect: { kind: "heal", amount: 15 },
      },
    ],
  },
  {
    id: "starving-shade",
    title: "Starving Shade",
    body: "The shade asks for a memory. It looks very hungry.",
    act: [2, 3],
    options: [
      {
        id: "feed",
        label: "Feed it",
        description: "Lose 15% max HP and gain a rare card.",
        effect: { kind: "card", cardId: "neutral:last-stand" },
      },
      {
        id: "refuse",
        label: "Refuse",
        description: "Take 6 damage and gain 30 run gold.",
        effect: { kind: "damage", amount: 6 },
      },
    ],
  },
  {
    id: "astral-gate",
    title: "Astral Gate",
    body: "A door made of stars opens only for the very brave.",
    act: [3],
    options: [
      {
        id: "step",
        label: "Step through",
        description: "Lose 12% max HP and gain a random relic.",
        effect: { kind: "relic", relicId: "random" },
      },
      {
        id: "wait",
        label: "Wait",
        description: "Heal 20% of max HP.",
        effect: { kind: "heal", amount: 20 },
      },
    ],
  },
];

const BY_ID = new Map(EVENTS.map((event) => [event.id, event]));

export function getEvent(id: string): CardEventDefinition | undefined {
  return BY_ID.get(id);
}

export function randomEvent(seed: string, act: number): CardEventDefinition {
  const rng = new Rng(`event:${seed}:${act}`);
  const pool = EVENTS.filter((event) => event.act.includes(act));
  return rng.pick(pool.length ? pool : EVENTS);
}
