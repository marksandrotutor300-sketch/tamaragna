import { describe, expect, it } from "vitest";
import { cardForInstance } from "./content/cards";
import { getRelic } from "./content/relics";
import { allEdicts } from "./content/edicts";
import { allRiftPaths } from "./content/paths";
import { applyScoreMultiplier, createRun } from "./run";
import { createCardBattle, applyCardAction } from "./engine";
import type { CardChampion, CardEnemy, CardInstance } from "./types";

function champion(): CardChampion {
  return {
    petId: "p1",
    name: "P1",
    speciesId: 1002,
    element: 0,
    elementLevel: 1,
    stats: {
      hpMax: 100,
      atk: 100,
      matk: 100,
      def: 0,
      mdef: 0,
      aspdMs: 1000,
      critChance: 0,
      critMult: 1.5,
      statusResist: 0,
      str: 10,
      agi: 10,
      vit: 10,
      int: 10,
      dex: 10,
      luk: 10,
    },
    maxHp: 100,
    hp: 10,
    block: 0,
    statuses: [],
    cards: ["neutral:jab", "neutral:guard", "neutral:jab", "neutral:guard"],
  };
}

function enemy(): CardEnemy {
  return {
    id: "e1",
    name: "Dummy",
    speciesId: 1002,
    element: 0,
    elementLevel: 1,
    stats: { atk: 500, matk: 0, def: 0, mdef: 0 },
    maxHp: 999,
    hp: 999,
    block: 0,
    statuses: [],
    moves: [{ kind: "attack", power: 500 }],
    intent: { kind: "attack", power: 500 },
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

describe("advanced Rift Deck upgrades", () => {
  it("exposes five edicts and five rift paths", () => {
    expect(allEdicts()).toHaveLength(5);
    expect(allRiftPaths()).toHaveLength(5);
  });

  it("builds a signature card above a normal upgrade", () => {
    const base = cardForInstance("neutral:jab", false)!;
    const upgraded = cardForInstance("neutral:jab", true)!;
    const signature = cardForInstance("neutral:jab", true, true)!;
    expect(upgraded.name.endsWith("+")).toBe(true);
    expect(signature.name.endsWith("++")).toBe(true);
    expect(signature.cost).toBeLessThanOrEqual(upgraded.cost);
    expect(signature.effects).not.toEqual(base.effects);
  });

  it("resolves an evolved relic", () => {
    const base = getRelic("moss-cloak")!;
    const evolved = getRelic("moss-cloak+")!;
    expect(evolved.name.endsWith("+")).toBe(true);
    expect(evolved.effect.startBlock).toBeGreaterThan(base.effect.startBlock ?? 0);
  });

  it("adds an extra opening card with Open Hand", () => {
    const state = createCardBattle({
      seed: "open-hand",
      champions: [champion()],
      enemies: [enemy()],
      deck: deck(),
      relics: [],
      edicts: ["open-hand"],
    });
    expect(state.hand).toHaveLength(6);
  });

  it("revives the first fallen champion with Second Wind", () => {
    const state = createCardBattle({
      seed: "second-wind",
      champions: [champion()],
      enemies: [enemy()],
      deck: deck(),
      relics: [],
      edicts: ["second-wind"],
    });
    const after = applyCardAction(state, { kind: "endTurn" });
    expect(after.secondWindUsed).toBe(true);
    expect(after.champions[0].hp).toBeGreaterThan(0);
  });

  it("applies ascension and path score multipliers", () => {
    expect(applyScoreMultiplier(100, 0, 1)).toBe(100);
    expect(applyScoreMultiplier(100, 1, 1.15)).toBe(127);
  });

  it("stores run upgrade choices", () => {
    const run = createRun({
      id: "run",
      ownerId: "owner",
      seed: "upgrade-run",
      champions: [champion()],
      season: 1,
      ascension: 2,
      path: "tide",
      edicts: ["iron-heart"],
      startGold: 20,
    });
    expect(run.ascension).toBe(2);
    expect(run.path).toBe("tide");
    expect(run.edicts).toEqual(["iron-heart"]);
    expect(run.runGold).toBe(20);
  });
});
