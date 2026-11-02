import { simulateBattle } from "@/lib/sim/replay";
import type { CombatantInit } from "@/lib/sim/types";

const BASE = "http://localhost:3000";

type Session = { cookie: string };

type CallResult = { status: number; json: unknown };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(session: Session, path: string, init: RequestInit = {}): Promise<CallResult> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(session.cookie ? { cookie: session.cookie } : {}),
      ...init.headers,
    },
  });

  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    session.cookie = setCookies.map((entry) => entry.split(";")[0]).join("; ");
  }

  const text = await response.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: response.status, json };
}

type MatchResponse = {
  battleId: string;
  seed: string;
  payload: {
    teamA: CombatantInit[];
    teamB: CombatantInit[];
    ai: { a: boolean; b: boolean };
  };
  opponent: { displayName: string; rating: number };
};

async function prepare(session: Session, label: string) {
  const me = await call(session, "/api/me");
  const profile = (me.json as { profile: { id: string; rating: number } }).profile;
  const hatch = await call(session, "/api/hatch", {
    method: "POST",
    body: JSON.stringify({ kind: "wild" }),
  });
  const pet = (hatch.json as { pet: { nickname: string; speciesId: number; power: number } }).pet;
  console.log(`${label}: ${profile.id.slice(0, 8)} hatched ${pet.nickname} (${pet.power} power)`);
  return { profile, pet };
}

async function main() {
  const a: Session = { cookie: "" };
  const b: Session = { cookie: "" };

  await prepare(a, "A");
  await prepare(b, "B");

  // B enters the arena first so a snapshot exists for A to match against.
  const bMatch = await call(b, "/api/pvp/match", {
    method: "POST",
    body: JSON.stringify({ auto: true }),
  });
  console.log("B match (creates B's snapshot; 404 only when the table is empty):", bMatch.status);
  await sleep(500);

  const aMatch = await call(a, "/api/pvp/match", {
    method: "POST",
    body: JSON.stringify({ auto: true }),
  });
  console.log("A match:", aMatch.status);
  if (aMatch.status !== 200) {
    console.log(JSON.stringify(aMatch.json));
    return;
  }

  const match = aMatch.json as MatchResponse;
  console.log("  opponent:", match.opponent.displayName, "rating", match.opponent.rating);

  const fetched = await call(a, `/api/battle/${match.battleId}`);
  console.log("  fetch battle:", fetched.status);

  const { result } = simulateBattle({
    seed: match.seed,
    teamA: match.payload.teamA,
    teamB: match.payload.teamB,
    ai: match.payload.ai,
  });

  await sleep(2200);
  const submit = await call(a, `/api/battle/${match.battleId}/submit`, {
    method: "POST",
    body: JSON.stringify({ inputLog: [], resultHash: result.checksum }),
  });
  console.log("  submit:", submit.status, JSON.stringify(submit.json).slice(0, 300));

  const history = await call(a, "/api/pvp/history");
  console.log("  history:", history.status, JSON.stringify(history.json).slice(0, 250));

  const replay = await call(a, `/api/battle/${match.battleId}/submit`, {
    method: "POST",
    body: JSON.stringify({ inputLog: [], resultHash: result.checksum }),
  });
  console.log("  duplicate submit (expect 409/429):", replay.status);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
