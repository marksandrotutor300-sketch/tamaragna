import { describe, expect, it } from "vitest";
import { createCardBattle, applyCardAction } from "./engine";
import { createRun } from "./run";
import { createContracts, advanceContracts } from "./content/contracts";
import { syncRelicSets, getRelic } from "./content/relics";
import { ultimateForElement } from "./content/ultimate-cards";
import { generateRunMap } from "./map";
import type { CardChampion, CardEnemy, CardInstance } from "./types";

function champion(): CardChampion {
  return {
    petId: "p1",
    name: "P1",
    speciesId: 1002,
    element: 2,
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
    hp: 100,
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
    stats: { atk: 1, matk: 0, def: 0, mdef: 0 },
    maxHp: 1000,
    hp: 1000,
    block: 0,
    statuses: [],
    moves: [{ kind: "block", amount: 1 }],
    intent: { kind: "block", amount: 1 },
  };
}

function deck(rune?: CardInstance["rune"]): CardInstance[] {
  return Array.from({ length: 10 }, (_, index) => ({
    instanceId: `c${index + 1}`,
    cardId: "neutral:jab",
    ownerPetId: "p1",
    upgraded: false,
    rune,
  }));
}

describe("second Rift Deck upgrade pack", () => {
  it("creates three contracts and completes the hunter objective", () => {
    const contracts = createContracts("contracts-seed");
    expect(contracts).toHaveLength(3);
    const hunter = {
      id: "hunter" as const,
      progress: 2,
      completed: false,
      claimed: false,
      rewardGold: 80,
    };
    const [advanced] = advanceContracts([hunter], "elite", 1);
    expect(advanced.completed).toBe(true);
  });

  it("activates relic sets from base and evolved relics", () => {
    const relics = syncRelicSets(["moss-cloak+", "root-sigil"]);
    expect(relics).toContain("set:verdant-2");
    expect(getRelic("set:verdant-2")?.effect.startBlock).toBe(5);
  });

  it("puts one hunt node in each act", () => {
    const map = generateRunMap("hunt-map");
    expect(map.acts.flatMap((act) => act.nodes).filter((node) => node.type === "hunt")).toHaveLength(3);
  });

  it("builds an ultimate card for each element group", () => {
    expect(ultimateForElement(2).id).toBe("ultimate:verdant");
    expect(ultimateForElement(3).id).toBe("ultimate:ember");
    expect(ultimateForElement(7).id).toBe("ultimate:veil");
    expect(ultimateForElement(8).id).toBe("ultimate:radiant");
    expect(ultimateForElement(9).id).toBe("ultimate:hollow");
  });

  it("applies an ember rune to damage", () => {
    const plain = createCardBattle({
      seed: "rune-plain",
      champions: [champion()],
      enemies: [enemy()],
      deck: deck(),
      relics: [],
    });
    const carved = createCardBattle({
      seed: "rune-carved",
      champions: [champion()],
      enemies: [enemy()],
      deck: deck("ember"),
      relics: [],
    });
    const plainCard = plain.hand.find((card) => card.cardId === "neutral:jab")!;
    const carvedCard = carved.hand.find((card) => card.cardId === "neutral:jab")!;
    const afterPlain = applyCardAction(plain, {
      kind: "playCard",
      instanceId: plainCard.instanceId,
      targetId: "e1",
    });
    const afterCarved = applyCardAction(carved, {
      kind: "playCard",
      instanceId: carvedCard.instanceId,
      targetId: "e1",
    });
    const plainDamage = 1000 - afterPlain.enemies[0].hp;
    const carvedDamage = 1000 - afterCarved.enemies[0].hp;
    expect(carvedDamage).toBeGreaterThan(plainDamage);
  });

  it("keeps contracts on a new run", () => {
    const run = createRun({
      id: "run",
      ownerId: "owner",
      seed: "contract-run",
      champions: [champion()],
      season: 1,
    });
    expect(run.contracts).toHaveLength(3);
  });
});
