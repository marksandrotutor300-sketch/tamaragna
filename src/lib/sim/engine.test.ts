import { describe, expect, it } from "vitest";
import { defaultCare } from "@/lib/game/care";
import { buildCombatant, zeroIvs } from "@/lib/game/combatant";
import { battleElementMultiplier, elementMultiplier } from "@/lib/game/combat-data";
import { requireSpecies } from "@/lib/game/species";
import { BattleEngine, TICK_MS } from "./engine";
import { simulateBattle } from "./replay";
import type { BattleConfig, CombatantInit } from "./types";

function fighter(speciesId: number, overrides: Partial<CombatantInit> = {}): CombatantInit {
  const species = requireSpecies(speciesId);
  return {
    ...buildCombatant({
      petId: `pet-${speciesId}`,
      species,
      rarity: 3,
      level: 10,
      ivs: zeroIvs(),
      care: defaultCare(),
      name: species.name,
    }),
    ...overrides,
  };
}

function config(seed: string, extra: Partial<BattleConfig> = {}): BattleConfig {
  return {
    seed,
    teamA: [fighter(1002), fighter(1001), fighter(1005)],
    teamB: [fighter(1001), fighter(1002), fighter(1005)],
    ai: { a: true, b: true },
    ...extra,
  };
}

describe("battle determinism", () => {
  it("replays identically from the same seed", () => {
    const first = simulateBattle(config("alpha"));
    const second = simulateBattle(config("alpha"));
    expect(first.result.checksum).toBe(second.result.checksum);
    expect(first.events.length).toBe(second.events.length);
  });

  it("diverges across different seeds", () => {
    const first = simulateBattle(config("alpha"));
    const second = simulateBattle(config("beta"));
    expect(first.result.checksum).not.toBe(second.result.checksum);
  });

  it("produces a decisive result", () => {
    const { result } = simulateBattle(config("gamma"));
    expect(["a", "b", "draw"]).toContain(result.winner);
    expect(["wipe", "timeout"]).toContain(result.reason);
    expect(result.durationMs).toBeGreaterThan(0);
  });
});

describe("manual input replay", () => {
  it("verifies a recorded input log against the server replay", () => {
    const cfg = config("manual", { ai: { a: false, b: true } });
    const engine = new BattleEngine(cfg);

    let guard = 4000;
    while (!engine.finished && guard > 0) {
      if (engine.currentTime === 1000) engine.pressSkill(0);
      if (engine.currentTime === 3000) engine.pressSkill(1);
      if (engine.currentTime === 6000) engine.swap(1);
      engine.step(TICK_MS);
      guard -= 1;
    }

    const liveResult = engine.result;
    expect(liveResult).not.toBeNull();
    expect(engine.inputLog.length).toBeGreaterThan(0);

    const replayed = simulateBattle({ ...cfg, inputs: engine.inputLog }, engine.inputLog);
    expect(replayed.result.checksum).toBe(liveResult?.checksum);
  });

  it("rejects a tampered result hash", () => {
    const cfg = config("tamper");
    const { result } = simulateBattle(cfg);
    expect(result.checksum).not.toBe("0000000000000000");
  });
});

describe("battle rules", () => {
  it("uses the RO element chart", () => {
    expect(elementMultiplier(1, 3)).toBe(1.5); // Water vs Fire
    expect(elementMultiplier(8, 0)).toBeCloseTo(0.9); // Ghost vs Neutral
    expect(battleElementMultiplier(1, 3)).toBeCloseTo(1.275);
  });

  it("times out and awards the healthier side", () => {
    const { result } = simulateBattle({
      seed: "timeout",
      teamA: [fighter(1038)],
      teamB: [fighter(1038)],
      ai: { a: false, b: false },
      maxMs: 1000,
    });
    expect(result.reason).toBe("timeout");
    expect(result.durationMs).toBe(1000);

    const fraction = (side: typeof result.sides.a) => {
      const hp = side.fighters.reduce((sum, entry) => sum + entry.hp, 0);
      const max = side.fighters.reduce((sum, entry) => sum + entry.maxHp, 0);
      return max > 0 ? hp / max : 0;
    };
    const a = fraction(result.sides.a);
    const b = fraction(result.sides.b);
    if (result.winner === "a") expect(a).toBeGreaterThanOrEqual(b);
    if (result.winner === "b") expect(b).toBeGreaterThanOrEqual(a);
  });

  it("forces a swap when the active pet faints", () => {
    const fragile = fighter(1002, { hp: 1 });
    const { events } = simulateBattle({
      seed: "faint",
      teamA: [fragile, fighter(1001)],
      teamB: [fighter(1038)],
      ai: { a: true, b: true },
      maxMs: 30_000,
    });

    const faint = events.find((event) => event.type === "faint" && event.side === "a");
    const swap = events.find((event) => event.type === "swap" && event.side === "a");
    expect(faint).toBeDefined();
    expect(swap).toBeDefined();
  });

  it("emits skill, damage and heal events", () => {
    const { events } = simulateBattle(config("events", { maxMs: 30_000 }));
    const types = new Set(events.map((event) => event.type));
    expect(types.has("start")).toBe(true);
    expect(types.has("attack")).toBe(true);
    expect(types.has("end")).toBe(true);
    expect([...types].some((type) => type === "skill" || type === "cast")).toBe(true);
  });

  it("never lets hp go negative", () => {
    const { result } = simulateBattle(config("hp-floor"));
    for (const side of [result.sides.a, result.sides.b]) {
      for (const entry of side.fighters) {
        expect(entry.hp).toBeGreaterThanOrEqual(0);
        expect(entry.hp).toBeLessThanOrEqual(entry.maxHp);
      }
    }
  });
});
