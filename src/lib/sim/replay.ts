import { BattleEngine, TICK_MS } from "./engine";
import type { BattleConfig, BattleEvent, BattleInput, BattleResult } from "./types";

export type SimulationOutput = {
  events: BattleEvent[];
  result: BattleResult;
};

/**
 * Run a battle to completion. Used by the server to verify a submitted input
 * log and by balance sweeps. Clients run the engine live instead.
 */
export function simulateBattle(
  config: BattleConfig,
  inputs: BattleInput[] = config.inputs ?? [],
): SimulationOutput {
  const engine = new BattleEngine({
    ...config,
    inputs,
    ai: config.ai ?? { a: true, b: true },
  });

  const events: BattleEvent[] = [];
  const maxTicks = Math.ceil((config.maxMs ?? 180_000) / TICK_MS) + 10;
  let guard = maxTicks;

  while (!engine.finished && guard > 0) {
    events.push(...engine.step(TICK_MS));
    guard -= 1;
  }

  const result = engine.result;
  if (!result) throw new Error("Battle did not terminate");

  return { events, result };
}

export type Verification = {
  ok: boolean;
  expected: string;
  actual: string;
  result: BattleResult;
  events: BattleEvent[];
};

/** Re-simulate a battle and compare its checksum with what the client reported. */
export function verifyBattle(
  config: BattleConfig,
  inputs: BattleInput[],
  expectedChecksum: string,
): Verification {
  const { result, events } = simulateBattle({ ...config, inputs }, inputs);
  return {
    ok: result.checksum === expectedChecksum,
    expected: expectedChecksum,
    actual: result.checksum,
    result,
    events,
  };
}
