import { describe, expect, it } from "vitest";
import {
  applyStatOverrides,
  powerScore,
  STAT_OVERRIDE_KEYS,
  type CombatStats,
  type StatOverrides,
} from "./stats";

const base: CombatStats = {
  hpMax: 1000,
  atk: 100,
  matk: 90,
  def: 50,
  mdef: 40,
  aspdMs: 1000,
  critChance: 0.1,
  critMult: 1.5,
  statusResist: 0.1,
  str: 10,
  agi: 10,
  vit: 10,
  int: 10,
  dex: 10,
  luk: 10,
};

describe("applyStatOverrides", () => {
  it("returns the computed stats when there is nothing to override", () => {
    expect(applyStatOverrides(base, null)).toEqual(base);
    expect(applyStatOverrides(base, {})).toEqual(base);
  });

  it("replaces only the keys that are provided", () => {
    const result = applyStatOverrides(base, { atk: 5000, hpMax: 42000 });
    expect(result.atk).toBe(5000);
    expect(result.hpMax).toBe(42000);
    expect(result.def).toBe(base.def);
  });

  it("clamps values to their bounds", () => {
    const result = applyStatOverrides(base, {
      aspdMs: 10,
      critChance: 4,
      critMult: 0.5,
      statusResist: -2,
      hpMax: 0,
    });
    expect(result.aspdMs).toBe(350);
    expect(result.critChance).toBe(1);
    expect(result.critMult).toBe(1);
    expect(result.statusResist).toBe(0);
    expect(result.hpMax).toBe(1);
  });

  it("ignores unknown and non-finite keys", () => {
    const dirty = {
      atk: 250,
      nope: 9,
      def: Number.NaN,
      mdef: Number.POSITIVE_INFINITY,
    } as unknown as StatOverrides;

    const result = applyStatOverrides(base, dirty);
    expect(result.atk).toBe(250);
    expect(result.def).toBe(base.def);
    expect(result.mdef).toBe(base.mdef);
    expect("nope" in result).toBe(false);
  });

  it("rounds to three decimals", () => {
    const result = applyStatOverrides(base, { critChance: 0.123456 });
    expect(result.critChance).toBe(0.123);
  });

  it("feeds the power score", () => {
    const boosted = applyStatOverrides(base, { hpMax: 9999, atk: 500 });
    expect(powerScore(boosted)).toBeGreaterThan(powerScore(base));
  });

  it("covers every documented override key", () => {
    expect(STAT_OVERRIDE_KEYS).toHaveLength(9);
  });
});
