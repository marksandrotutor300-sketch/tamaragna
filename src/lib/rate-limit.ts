import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { rateLimits } from "@/lib/db/schema";

export type RateLimitRule = {
  limit: number;
  windowMs: number;
};

export const LIMITS = {
  hatch: { limit: 3, windowMs: 10_000 },
  care: { limit: 20, windowMs: 10_000 },
  practice: { limit: 10, windowMs: 10_000 },
  pvpMatch: { limit: 2, windowMs: 10_000 },
  questClaim: { limit: 10, windowMs: 10_000 },
  seasonClaim: { limit: 3, windowMs: 60_000 },
  transferCreate: { limit: 3, windowMs: 60_000 },
  transferRedeem: { limit: 5, windowMs: 600_000 },
  accountExport: { limit: 3, windowMs: 60_000 },
  accountImport: { limit: 3, windowMs: 60_000 },
  towerStart: { limit: 5, windowMs: 10_000 },
  shareCreate: { limit: 10, windowMs: 60_000 },
  revenge: { limit: 2, windowMs: 10_000 },
  publicCard: { limit: 5, windowMs: 60_000 },
  authEmail: { limit: 5, windowMs: 600_000 },
  authVerify: { limit: 20, windowMs: 600_000 },
  pushSubscribe: { limit: 10, windowMs: 60_000 },
  evolve: { limit: 5, windowMs: 60_000 },
  liveQueue: { limit: 12, windowMs: 60_000 },
  liveSpectate: { limit: 20, windowMs: 60_000 },
  tournamentJoin: { limit: 10, windowMs: 60_000 },
  tournamentStart: { limit: 10, windowMs: 60_000 },
  guildCreate: { limit: 3, windowMs: 600_000 },
  guildAttack: { limit: 12, windowMs: 60_000 },
  marketList: { limit: 10, windowMs: 600_000 },
  marketBuy: { limit: 20, windowMs: 600_000 },
  expeditionStart: { limit: 6, windowMs: 600_000 },
  ranchVisit: { limit: 20, windowMs: 600_000 },
  rankedJoin: { limit: 10, windowMs: 600_000 },
  spectatorPick: { limit: 20, windowMs: 600_000 },
  legacyRetire: { limit: 5, windowMs: 600_000 },
  dojoTrain: { limit: 6, windowMs: 600_000 },
  dojoSpar: { limit: 20, windowMs: 600_000 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Fixed-window limit persisted in Postgres. The upsert resets an expired
 * window and otherwise increments, so it works across processes.
 */
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<boolean> {
  const db = await getDb();
  const resetAt = new Date(Date.now() + rule.windowMs).toISOString();

  const rows = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: new Date(resetAt) })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} < now() THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} < now() THEN ${resetAt}::timestamptz ELSE ${rateLimits.resetAt} END`,
      },
    })
    .returning({ count: rateLimits.count });

  return (rows[0]?.count ?? 1) <= rule.limit;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "local";
}
