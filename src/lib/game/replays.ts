import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  battleShares,
  battles,
  profiles,
  type BattlePayload,
} from "@/lib/db/schema";
import { verifyBattle } from "@/lib/sim/replay";
import type { BattleInput, BattleResult } from "@/lib/sim/types";
import { logEvent } from "@/lib/log";
import { isShareToken } from "./share";

export type ReplayRecord = {
  token: string;
  battleId: string;
  mode: string;
  sharedBy: string;
  seed: string;
  payload: BattlePayload;
  inputLog: BattleInput[];
  result: BattleResult;
  resultHash: string;
  createdAt: string;
};

/**
 * Public replay view. Re-simulates the stored battle and refuses to serve a
 * replay whose checksum no longer matches.
 */
export async function getReplayByToken(
  token: string,
): Promise<ReplayRecord | null> {
  if (!isShareToken(token)) return null;

  const db = await getDb();
  const rows = await db
    .select({
      share: battleShares,
      battle: battles,
      owner: profiles,
    })
    .from(battleShares)
    .innerJoin(battles, eq(battleShares.battleId, battles.id))
    .innerJoin(profiles, eq(battleShares.ownerId, profiles.id))
    .where(
      and(eq(battleShares.token, token), isNull(battleShares.revokedAt)),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.battle.status !== "complete" || !row.battle.resultHash) return null;

  const payload = row.battle.payload;
  const inputLog = row.battle.inputLog ?? [];

  const verification = verifyBattle(
    {
      seed: row.battle.seed,
      teamA: payload.teamA,
      teamB: payload.teamB,
      ai: payload.ai,
      maxMs: payload.maxMs,
    },
    inputLog,
    row.battle.resultHash,
  );
  if (!verification.ok) {
    logEvent("warn", "replay.checksum_failed", {
      token,
      battleId: row.battle.id,
      expected: verification.expected,
      actual: verification.actual,
      inputs: inputLog.length,
    });
    return null;
  }

  return {
    token,
    battleId: row.battle.id,
    mode: row.battle.mode,
    sharedBy: row.owner.displayName,
    seed: row.battle.seed,
    payload,
    inputLog,
    result: verification.result,
    resultHash: row.battle.resultHash,
    createdAt: row.battle.createdAt.toISOString(),
  };
}
