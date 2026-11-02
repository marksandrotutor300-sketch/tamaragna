import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { rollIvs } from "./combatant";
import { CARE_DECAY_PER_HOUR, normalizeCare, defaultCare } from "./care";
import { expToNext, grantExp } from "./leveling";
import { RARITY, RARITY_IDS, hatchWeightsFor, ivGrade } from "./rarity";
import { MAX_LEVEL } from "./stats";

describe("rarity", () => {
  it("respects the IV floor for every rarity", () => {
    const rng = new Rng("iv-test");
    for (const rarity of RARITY_IDS) {
      const floor = RARITY[rarity].ivFloor;
      for (let i = 0; i < 500; i += 1) {
        const ivs = rollIvs(rarity, rng);
        for (const value of Object.values(ivs)) {
          expect(value).toBeGreaterThanOrEqual(floor);
          expect(value).toBeLessThanOrEqual(31);
        }
      }
    }
  });

  it("has hatch weight tables that sum to 100", () => {
    for (const tier of RARITY_IDS) {
      const total = hatchWeightsFor(tier).reduce((sum, weight) => sum + weight, 0);
      expect(total).toBeCloseTo(100);
    }
  });

  it("never drops a tier-5 species below rare", () => {
    expect(hatchWeightsFor(5)[0]).toBe(0);
    expect(hatchWeightsFor(5)[1]).toBe(0);
  });

  it("grades individual values", () => {
    expect(ivGrade(31)).toBe("S");
    expect(ivGrade(0)).toBe("D");
  });
});

describe("care", () => {
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

  it("decays hunger and mood over time", () => {
    const care = { ...defaultCare(), hunger: 100, mood: 100, energy: 100, lastCareAt: hoursAgo(10).toISOString() };
    const next = normalizeCare(care);
    expect(next.hunger).toBeCloseTo(100 - 10 * CARE_DECAY_PER_HOUR.hunger);
    expect(next.mood).toBeCloseTo(100 - 10 * CARE_DECAY_PER_HOUR.mood);
  });

  it("caps offline decay at 36 hours", () => {
    const short = { ...defaultCare(), hunger: 100, mood: 100, lastCareAt: hoursAgo(36).toISOString() };
    const long = { ...defaultCare(), hunger: 100, mood: 100, lastCareAt: hoursAgo(1000).toISOString() };
    expect(normalizeCare(short).hunger).toBe(normalizeCare(long).hunger);
    expect(normalizeCare(short).mood).toBe(normalizeCare(long).mood);
  });

  it("recovers energy while sleeping", () => {
    const care = { ...defaultCare(), energy: 10, sleeping: true, lastCareAt: hoursAgo(5).toISOString() };
    const next = normalizeCare(care);
    expect(next.energy).toBeGreaterThan(10);
  });
});

describe("leveling", () => {
  it("levels up through the curve", () => {
    const need = expToNext(1);
    const result = grantExp(1, 0, need);
    expect(result.level).toBe(2);
    expect(result.levelsGained).toBe(1);
    expect(result.exp).toBe(0);
  });

  it("caps at max level", () => {
    const result = grantExp(MAX_LEVEL, 0, 10_000_000);
    expect(result.level).toBe(MAX_LEVEL);
    expect(result.exp).toBe(0);
  });
});
