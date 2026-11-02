import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { battleShares, battles, profiles, pvpSnapshots } from "@/lib/db/schema";

export type DefenseRow = {
  battleId: string;
  attackerName: string;
  attackerRating: number;
  outcome: "win" | "loss" | "draw";
  durationMs: number;
  createdAt: string;
  replayToken: string | null;
};

export async function getDefenseLog(profileId: string): Promise<DefenseRow[]> {
  const db = await getDb();
  const snapshots = await db
    .select({ id: pvpSnapshots.id })
    .from(pvpSnapshots)
    .where(eq(pvpSnapshots.ownerId, profileId));

  const snapshotIds = snapshots.map((snapshot) => snapshot.id);
  if (snapshotIds.length === 0) return [];

  const rows = await db
    .select({ battle: battles, attacker: profiles })
    .from(battles)
    .innerJoin(profiles, eq(battles.ownerId, profiles.id))
    .where(
      and(
        inArray(battles.opponentSnapshotId, snapshotIds),
        eq(battles.status, "complete"),
      ),
    )
    .orderBy(desc(battles.createdAt))
    .limit(10);

  if (rows.length === 0) return [];

  const battleIds = rows.map((row) => row.battle.id);
  const shares = await db
    .select({ battleId: battleShares.battleId, token: battleShares.token })
    .from(battleShares)
    .where(
      and(
        inArray(battleShares.battleId, battleIds),
        isNull(battleShares.revokedAt),
      ),
    );
  const tokens = new Map(shares.map((share) => [share.battleId, share.token]));

  return rows.map(({ battle, attacker }) => {
    const winner = battle.result?.winner;
    return {
      battleId: battle.id,
      attackerName: attacker.displayName,
      attackerRating: attacker.rating,
      outcome: winner === "b" ? "win" : winner === "a" ? "loss" : "draw",
      durationMs: battle.result?.durationMs ?? 0,
      createdAt: battle.createdAt.toISOString(),
      replayToken: tokens.get(battle.id) ?? null,
    };
  });
}
