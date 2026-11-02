import { describe, expect, it } from "vitest";
import { expeditionRewards, getExpeditionRoute } from "./expeditions";

describe("expeditions", () => {
  it("returns the documented rewards and clamps bonuses", () => {
    const route = getExpeditionRoute("abyssal-rift");
    expect(route?.minutes).toBe(180);
    const rewards = expeditionRewards(route!, [
      { level: 50, care: { friendship: 100 } },
      { level: 50, care: { friendship: 100 } },
    ]);
    expect(rewards.eggs).toBe(1);
    expect(rewards.coins).toBeGreaterThan(route!.coins);
    expect(rewards.materials).toBeGreaterThan(route!.materials);
  });

  it("returns null for an unknown route", () => {
    expect(getExpeditionRoute("missing")).toBeNull();
  });
});
