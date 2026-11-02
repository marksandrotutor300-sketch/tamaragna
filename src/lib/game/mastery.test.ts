import { describe, expect, it } from "vitest";
import { masteryLevelForXp, masteryPowerMultiplier } from "./mastery";

describe("skill mastery", () => {
  it("uses the documented thresholds", () => {
    expect(masteryLevelForXp(0)).toBe(1);
    expect(masteryLevelForXp(9)).toBe(1);
    expect(masteryLevelForXp(10)).toBe(2);
    expect(masteryLevelForXp(40)).toBe(3);
    expect(masteryLevelForXp(100)).toBe(4);
    expect(masteryLevelForXp(200)).toBe(5);
    expect(masteryLevelForXp(9999)).toBe(5);
  });

  it("scales skill power by two percent per level", () => {
    expect(masteryPowerMultiplier(1)).toBe(1);
    expect(masteryPowerMultiplier(5)).toBeCloseTo(1.08);
  });
});
