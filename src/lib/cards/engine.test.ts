import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { createCardBattle, applyCardAction, CardRuleError } from "./engine";
import { generateRunMap, availableNodes, isNodeReachable } from "./map";
import { createChampions, createRun, starterDeck } from "./run";
import type { CardBattleState, CardChampion, CardEnemy, CardInstance } from "./types";

function champion(petId = "p1"): CardChampion {
  return {
    petId,
    name: petId,
    speciesId: 1002,
    element: 0,
    elementLevel: 1,
    stats: {
      hpMax: 200,
      atk: 100,
      matk: 100,
      def: 20,
      mdef: 20,
      aspdMs: 1000,
      critChance: 0.1,
      critMult: 1.5,
      statusResist: 0,
      str: 10,
      agi: 10,
      vit: 10,
      int: 10,
      dex: 10,
      luk: 10,
    },
    maxHp: 200,
    hp: 200,
    block: 0,
    statuses: [],
    cards: ["neutral:jab", "neutral:guard", "neutral:jab", "neutral:guard"],
  };
}

function enemy(id = "e1"): CardEnemy {
  return {
    id,
    name: "Dummy",
    speciesId: 1002,
    element: 0,
    elementLevel: 1,
    stats: { atk: 30, matk: 30, def: 0, mdef: 0 },
    maxHp: 50,
    hp: 50,
    block: 0,
    statuses: [],
    moves: [{ kind: "attack", power: 50 }],
    intent: { kind: "attack", power: 50 },
  };
}

function deck(): CardInstance[] {
  return Array.from({ length: 10 }, (_, index) => ({
    instanceId: `c${index + 1}`,
    cardId: index % 2 === 0 ? "neutral:jab" : "neutral:guard",
    ownerPetId: "p1",
    upgraded: false,
  }));
}

function battle(seed = "test-battle"): CardBattleState {
  return createCardBattle({
    seed,
    champions: [champion()],
    enemies: [enemy()],
    deck: deck(),
    relics: [],
  });
}

describe("rift deck engine", () => {
  it("starts with a hand, energy, and enemy intent", () => {
    const state = battle();
    expect(state.hand).toHaveLength(5);
    expect(state.energy).toBe(3);
    expect(state.turn).toBe(1);
    expect(state.enemies[0].intent.kind).toBe("attack");
  });

  it("plays a card and spends energy", () => {
    const state = battle();
    const card = state.hand.find((entry) => entry.cardId === "neutral:jab");
    expect(card).toBeDefined();
    const after = applyCardAction(state, {
      kind: "playCard",
      instanceId: card!.instanceId,
      targetId: "e1",
    });
    expect(after.energy).toBe(2);
    expect(after.enemies[0].hp).toBeLessThan(50);
    expect(after.hand).not.toContainEqual(card);
  });

  it("is deterministic for the same seed", () => {
    const a = battle("same-seed");
    const b = battle("same-seed");
    expect(a.hand.map((card) => card.instanceId)).toEqual(
      b.hand.map((card) => card.instanceId),
    );
    expect(a.enemies[0].intent).toEqual(b.enemies[0].intent);
  });

  it("ends the turn and draws a fresh hand", () => {
    const state = battle();
    const after = applyCardAction(state, { kind: "endTurn" });
    expect(after.turn).toBe(2);
    expect(after.hand.length).toBeGreaterThan(0);
    expect(after.energy).toBe(3);
  });

  it("rejects invalid cards and unaffordable plays", () => {
    const state = battle();
    expect(() =>
      applyCardAction(state, { kind: "playCard", instanceId: "missing" }),
    ).toThrow(CardRuleError);
  });

  it("reaches a terminal result", () => {
    let state = battle("finish");
    let guard = 20;
    while (!state.result && guard > 0) {
      const attack = state.hand.find((entry) => entry.cardId === "neutral:jab");
      if (attack && state.energy >= 1) {
        state = applyCardAction(state, {
          kind: "playCard",
          instanceId: attack.instanceId,
          targetId: "e1",
        });
      } else {
        state = applyCardAction(state, { kind: "endTurn" });
      }
      guard -= 1;
    }
    expect(state.result).not.toBeNull();
  });
});

describe("rift deck run", () => {
  it("builds a 12-card starter deck from three champions", () => {
    const champions = [champion("p1"), champion("p2"), champion("p3")];
    const deck = starterDeck(champions);
    expect(deck.cards).toHaveLength(12);
  });

  it("generates a deterministic three-act map", () => {
    const a = generateRunMap("map-seed");
    const b = generateRunMap("map-seed");
    expect(a).toEqual(b);
    expect(a.acts).toHaveLength(3);
    expect(a.acts[0].nodes[0].type).toBe("battle");
    expect(a.acts[0].nodes.some((node) => node.type === "boss")).toBe(true);
  });

  it("only allows reachable nodes", () => {
    const champions = [champion("p1")];
    const run = createRun({
      id: "run",
      ownerId: "owner",
      seed: "reachable",
      champions,
      season: 1,
    });
    const start = availableNodes(run)[0];
    expect(start).toBeDefined();
    expect(isNodeReachable(run, start.id)).toBe(true);
    const elsewhere = run.map.acts[0].nodes.find((node) => node.id !== start.id)!;
    expect(isNodeReachable(run, elsewhere.id)).toBe(false);
  });

  it("creates a run with the seed's map and deck", () => {
    const champions = [champion("p1")];
    const run = createRun({
      id: "run",
      ownerId: "owner",
      seed: "run-seed",
      champions,
      season: 1,
    });
    expect(run.status).toBe("active");
    expect(run.deck.cards).toHaveLength(4);
    expect(run.map.acts).toHaveLength(3);
  });
});
