import { BattleEngine, TICK_MS } from "@/lib/sim/engine";
import { simulateBattle } from "@/lib/sim/replay";
import type { CombatantInit } from "@/lib/sim/types";

const BASE = "http://localhost:3000";
let cookie = "";

type CallResult = { status: number; json: unknown };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(path: string, init: RequestInit = {}): Promise<CallResult> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...init.headers,
    },
  });

  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) cookie = setCookies.map((entry) => entry.split(";")[0]).join("; ");

  const text = await response.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: response.status, json };
}

type PracticeResponse = {
  battleId: string;
  seed: string;
  payload: {
    teamA: CombatantInit[];
    teamB: CombatantInit[];
    ai: { a: boolean; b: boolean };
    maxMs?: number;
  };
};

async function main() {
  const me = await call("/api/me");
  console.log("1. profile", me.status, JSON.stringify((me.json as { profile: unknown }).profile));

  const hatch = await call("/api/hatch", {
    method: "POST",
    body: JSON.stringify({ kind: "wild" }),
  });
  const pet = (hatch.json as { pet: { nickname: string; rarity: number; speciesId: number } }).pet;
  console.log("2. hatch", hatch.status, pet.nickname, "species", pet.speciesId, "rarity", pet.rarity);

  // ---- auto battle, server replays the same deterministic result
  const autoBattle = (await call("/api/battle/practice", {
    method: "POST",
    body: JSON.stringify({ speciesId: 1001, auto: true }),
  })) as CallResult;
  const auto = autoBattle.json as PracticeResponse;
  console.log("3. practice battle", autoBattle.status, auto.battleId);

  const simulated = simulateBattle({
    seed: auto.seed,
    teamA: auto.payload.teamA,
    teamB: auto.payload.teamB,
    ai: auto.payload.ai,
  });
  console.log(
    "   simulated:",
    simulated.result.winner,
    simulated.result.reason,
    `${simulated.result.durationMs}ms`,
    simulated.result.checksum,
  );

  const submitAuto = await call(`/api/battle/${auto.battleId}/submit`, {
    method: "POST",
    body: JSON.stringify({ inputLog: [], resultHash: simulated.result.checksum }),
  });
  console.log("4. submit auto", submitAuto.status, JSON.stringify(submitAuto.json).slice(0, 240));

  // ---- manual battle with a recorded input log
  await sleep(2200);
  const manualBattle = (await call("/api/battle/practice", {
    method: "POST",
    body: JSON.stringify({ speciesId: 1002, auto: false }),
  })) as CallResult;
  const manual = manualBattle.json as PracticeResponse;

  const engine = new BattleEngine({
    seed: manual.seed,
    teamA: manual.payload.teamA,
    teamB: manual.payload.teamB,
    ai: manual.payload.ai,
  });

  let guard = 4000;
  while (!engine.finished && guard > 0) {
    const t = engine.currentTime;
    if (t === 900) engine.pressSkill(0);
    if (t === 2500) engine.pressSkill(1);
    if (t === 5000) engine.swap(1);
    engine.step(TICK_MS);
    guard -= 1;
  }

  console.log(
    "5. manual battle:",
    engine.result?.winner,
    `${engine.result?.durationMs}ms`,
    "inputs",
    engine.inputLog.length,
  );

  const submitManual = await call(`/api/battle/${manual.battleId}/submit`, {
    method: "POST",
    body: JSON.stringify({
      inputLog: engine.inputLog,
      resultHash: engine.result?.checksum,
    }),
  });
  console.log("6. submit manual", submitManual.status, JSON.stringify(submitManual.json).slice(0, 240));

  // ---- tampered hash must be rejected
  await sleep(2200);
  const tamperedBattle = (await call("/api/battle/practice", {
    method: "POST",
    body: JSON.stringify({ speciesId: 1002, auto: true }),
  })) as CallResult;
  const tampered = tamperedBattle.json as PracticeResponse;
  const tamperedSubmit = await call(`/api/battle/${tampered.battleId}/submit`, {
    method: "POST",
    body: JSON.stringify({ inputLog: [], resultHash: "deadbeefdeadbeef" }),
  });
  console.log("7. tampered submit (expect 400)", tamperedSubmit.status);

  // ---- tower
  await sleep(2200);
  const towerStart = (await call("/api/tower/start", {
    method: "POST",
    body: JSON.stringify({ auto: true }),
  })) as CallResult;
  const tower = towerStart.json as {
    run: { id: string; wave: number };
    battle: { battleId: string; seed: string; payload: PracticeResponse["payload"]; boss: boolean };
  };
  console.log("8. tower start", towerStart.status, "wave", tower.run.wave, "boss", tower.battle?.boss);

  const towerSim = simulateBattle({
    seed: tower.battle.seed,
    teamA: tower.battle.payload.teamA,
    teamB: tower.battle.payload.teamB,
    ai: tower.battle.payload.ai,
  });
  const towerSubmit = await call(`/api/battle/${tower.battle.battleId}/submit`, {
    method: "POST",
    body: JSON.stringify({ inputLog: [], resultHash: towerSim.result.checksum }),
  });
  console.log(
    "9. tower submit",
    towerSubmit.status,
    JSON.stringify(towerSubmit.json).slice(0, 260),
  );

  // small delay so the submission rate limit does not trip
  await sleep(2200);

  const next = await call(`/api/tower/${tower.run.id}/next`, {
    method: "POST",
    body: JSON.stringify({ auto: true }),
  });
  console.log("10. tower next", next.status, JSON.stringify(next.json).slice(0, 200));

  const board = await call("/api/tower/leaderboard");
  console.log("11. leaderboard", board.status, JSON.stringify(board.json).slice(0, 200));

  const bestiary = await call("/api/bestiary?q=poring");
  console.log("12. bestiary search", bestiary.status, JSON.stringify(bestiary.json).slice(0, 200));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
