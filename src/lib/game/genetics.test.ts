import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { MAX_STAR, awakenCost, starMultiplier } from "./awakening";
import { BREED_COST, breedChild } from "./breeding";
import { defaultCare } from "./care";
import { buildCombatant, zeroIvs } from "./combatant";
import {
  NATURE_IDS,
  NATURE_REROLL_COST,
  natureById,
  natureMultipliers,
  rerollNature,
  type NatureId,
} from "./nature";
import { requireSpecies } from "./species";
import { computeStats } from "./stats";
import { defaultLoadout, normalizeLoadout } from "./skills";
import {
  computeTeamSynergies,
  synergyBonusesFor,
  type TeamMember,
} from "./synergy";
import { teamToCombatants, type TeamPet } from "./team";
import type { Ivs } from "./types";

const species = requireSpecies(1002); // Poring
const care = { hunger: 100, mood: 100, friendship: 100 };
const noIvs = zeroIvs();

function statsFor(nature: NatureId = "hardy", star = 1, ivs: Ivs = noIvs) {
  return computeStats({ species, rarity: 3, level: 10, ivs, care, nature, star });
}

function ivsOf(value: number): Ivs {
  return { str: value, agi: value, vit: value, int: value, dex: value, luk: value };
}

describe("natures", () => {
  it("has eight natures and a neutral default", () => {
    expect(NATURE_IDS).toHaveLength(8);
    expect(natureById("hardy").up).toBeNull();
    expect(natureById("unknown")).toBe(natureById("hardy"));
    for (const value of Object.values(natureMultipliers("hardy"))) {
      expect(value).toBe(1);
    }
  });

  it("applies +10% and -10% to the right stats", () => {
    expect(natureMultipliers("modest").matk).toBeCloseTo(1.1);
    expect(natureMultipliers("modest").atk).toBeCloseTo(0.9);
    expect(natureMultipliers("timid").aspdMs).toBeCloseTo(0.9);
    expect(natureMultipliers("timid").atk).toBeCloseTo(0.9);
    expect(natureMultipliers("adamant").atk).toBeCloseTo(1.1);
    expect(natureMultipliers("adamant").matk).toBeCloseTo(0.9);
  });

  it("changes computed stats without changing the others", () => {
    const hardy = statsFor("hardy");
    const modest = statsFor("modest");
    const timid = statsFor("timid");

    expect(modest.matk).toBeGreaterThan(hardy.matk);
    expect(modest.atk).toBeLessThan(hardy.atk);
    expect(timid.aspdMs).toBeLessThan(hardy.aspdMs);
    expect(timid.atk).toBeLessThan(hardy.atk);
    expect(modest.hpMax).toBe(hardy.hpMax);
  });
});

describe("awakening", () => {
  it("adds 4% per star and caps at five", () => {
    expect(starMultiplier(1)).toBe(1);
    expect(starMultiplier(5)).toBeCloseTo(1.16);
    expect(starMultiplier(99)).toBeCloseTo(1.16);
    expect(MAX_STAR).toBe(5);
    expect(awakenCost(1)).toBe(150);
    expect(awakenCost(4)).toBe(600);
    expect(awakenCost(5)).toBe(600);
  });

  it("raises HP and ATK but not attack speed", () => {
    const one = statsFor("hardy", 1);
    const five = statsFor("hardy", 5);
    expect(five.hpMax).toBeGreaterThan(one.hpMax);
    expect(five.atk).toBeGreaterThan(one.atk);
    expect(five.aspdMs).toBe(one.aspdMs);
  });
});

describe("status resistance", () => {
  it("stays in range and rises with VIT and LUK", () => {
    const base = statsFor("hardy", 1);
    const high = statsFor("hardy", 1, { ...noIvs, vit: 31, luk: 31 });
    expect(base.statusResist).toBeGreaterThanOrEqual(0);
    expect(base.statusResist).toBeLessThanOrEqual(0.35);
    expect(high.statusResist).toBeGreaterThan(base.statusResist);
    expect(high.statusResist).toBeLessThanOrEqual(0.35);
  });
});

describe("nature reroll", () => {
  it("always lands on a different valid nature", () => {
    expect(NATURE_REROLL_COST).toBe(300);
    for (let i = 0; i < 100; i += 1) {
      const next = rerollNature("modest", new Rng(`reroll-${i}`));
      expect(next).not.toBe("modest");
      expect(NATURE_IDS).toContain(next);
    }
  });
});

describe("skill loadouts", () => {
  const species = requireSpecies(1002);

  it("builds four unique skills from the six-skill kit", () => {
    expect(species.skills).toHaveLength(6);
    const loadout = defaultLoadout(species.skills);
    const available = new Set(species.skills.map((slot) => slot.id));

    expect(loadout).toHaveLength(4);
    expect(new Set(loadout).size).toBe(4);
    expect(loadout.every((id) => available.has(id))).toBe(true);
    expect(normalizeLoadout(species.skills, loadout)).toEqual(loadout);
  });

  it("falls back to the default for invalid loadouts", () => {
    const fallback = defaultLoadout(species.skills);
    expect(normalizeLoadout(species.skills, [1, 1, 1, 1])).toEqual(fallback);
    expect(normalizeLoadout(species.skills, [1, 2, 3])).toEqual(fallback);
    expect(normalizeLoadout(species.skills, [999, 998, 997, 996])).toEqual(fallback);
  });

  it("uses the requested order in a combatant", () => {
    const ids = species.skills.map((slot) => slot.id).slice(2, 6);
    const combatant = buildCombatant({
      petId: "loadout-test",
      species,
      rarity: 3,
      level: 10,
      ivs: noIvs,
      care: defaultCare(),
      name: species.name,
      loadout: ids,
    });
    expect(combatant.skills.map((skill) => skill.id)).toEqual(ids);
  });

  it("uses the stored pet loadout in team resolution", () => {
    const ids = species.skills.map((slot) => slot.id).slice(1, 5);
    const pet: TeamPet = {
      id: "loadout-team",
      speciesId: 1002,
      nickname: "Poring",
      rarity: 3,
      level: 10,
      ivs: noIvs,
      care: defaultCare(),
      nature: "hardy",
      star: 1,
      loadout: ids,
    };
    const [combatant] = teamToCombatants([pet]);
    expect(combatant.skills.map((skill) => skill.id)).toEqual(ids);
  });
});

describe("breeding", () => {
  const parentA = {
    speciesId: 1002,
    rarity: 4 as const,
    ivs: ivsOf(20),
    nature: "adamant" as const,
  };
  const parentB = {
    speciesId: 1001,
    rarity: 2 as const,
    ivs: ivsOf(10),
    nature: "modest" as const,
  };

  it("is deterministic for a seed", () => {
    const first = breedChild(parentA, parentB, new Rng("breeding-seed"));
    const second = breedChild(parentA, parentB, new Rng("breeding-seed"));
    expect(first).toEqual(second);
  });

  it("inherits the species line, keeps IVs near a parent, and rolls valid values", () => {
    for (let i = 0; i < 200; i += 1) {
      const child = breedChild(parentA, parentB, new Rng(`breed-${i}`));
      expect(child.speciesId).toBe(parentA.speciesId);
      expect(child.rarity).toBeGreaterThanOrEqual(1);
      expect(child.rarity).toBeLessThanOrEqual(5);
      expect(NATURE_IDS).toContain(child.nature);

      for (const key of ["str", "agi", "vit", "int", "dex", "luk"] as const) {
        expect(child.ivs[key]).toBeGreaterThanOrEqual(7);
        expect(child.ivs[key]).toBeLessThanOrEqual(23);
        expect(child.ivs[key]).toBeGreaterThanOrEqual(0);
        expect(child.ivs[key]).toBeLessThanOrEqual(31);
      }
    }
  });

  it("uses the documented cost", () => {
    expect(BREED_COST).toEqual({ eggs: 2, coins: 250 });
  });
});

describe("team synergies", () => {
  const fire = 3;
  const water = 1;

  it("does nothing for a single pet", () => {
    expect(computeTeamSynergies([])).toEqual([]);
    expect(
      computeTeamSynergies([{ speciesId: 1, element: fire, raceName: "Plant" }]),
    ).toEqual([]);
  });

  it("activates element focus, race bond and diversity independently", () => {
    const sameElement: TeamMember[] = [
      { speciesId: 1, element: fire, raceName: "Plant" },
      { speciesId: 2, element: fire, raceName: "Plant" },
      { speciesId: 3, element: water, raceName: "Plant" },
    ];
    const synergies = computeTeamSynergies(sameElement);
    expect(synergies.find((entry) => entry.id === "element-focus")?.bonus.atk ?? 0).toBeCloseTo(
      0.05,
    );
    expect(synergies.find((entry) => entry.id === "race-bond")?.bonus.def ?? 0).toBeCloseTo(0.08);
    expect(synergies.find((entry) => entry.id === "diversity")).toBeUndefined();

    const threeSame: TeamMember[] = [
      { speciesId: 1, element: fire, raceName: "Plant" },
      { speciesId: 2, element: fire, raceName: "Plant" },
      { speciesId: 3, element: fire, raceName: "Plant" },
    ];
    expect(
      computeTeamSynergies(threeSame).find((entry) => entry.id === "element-focus")?.bonus.atk ?? 0,
    ).toBeCloseTo(0.08);

    const diverse: TeamMember[] = [
      { speciesId: 1, element: fire, raceName: "Plant" },
      { speciesId: 2, element: water, raceName: "Brute" },
      { speciesId: 3, element: fire, raceName: "Demon" },
    ];
    const diverseSynergies = computeTeamSynergies(diverse);
    expect(diverseSynergies.find((entry) => entry.id === "diversity")?.bonus.hp ?? 0).toBeCloseTo(
      0.05,
    );
    expect(diverseSynergies.find((entry) => entry.id === "race-bond")).toBeUndefined();
  });

  it("applies bonuses only to matching members", () => {
    const members: TeamMember[] = [
      { speciesId: 1, element: fire, raceName: "Plant" },
      { speciesId: 2, element: fire, raceName: "Plant" },
      { speciesId: 3, element: water, raceName: "Brute" },
    ];
    const synergies = computeTeamSynergies(members);
    const insider = synergyBonusesFor(members[0], synergies);
    const outsider = synergyBonusesFor(
      { speciesId: 9, element: 0, raceName: "Demon" },
      synergies,
    );

    expect(insider.atk).toBeCloseTo(1.05);
    expect(insider.matk).toBeCloseTo(1.05);
    expect(insider.def).toBeCloseTo(1.08);
    expect(outsider.atk).toBe(1);
    expect(outsider.def).toBe(1);
  });

  it("applies the multipliers to a real team", () => {
    const base: TeamPet = {
      id: "a",
      speciesId: 1002,
      nickname: "Poring",
      rarity: 3,
      level: 10,
      ivs: noIvs,
      care: defaultCare(),
      nature: "hardy",
      star: 1,
      loadout: null,
    };
    const solo = teamToCombatants([base]);
    const trio = teamToCombatants([
      base,
      { ...base, id: "b" },
      { ...base, id: "c" },
    ]);

    expect(trio[0].stats.atk).toBeGreaterThan(solo[0].stats.atk);
    expect(trio[0].stats.def).toBeGreaterThan(solo[0].stats.def);
    expect(trio[0].stats.hpMax).toBe(solo[0].stats.hpMax);
  });
});
