import { and, desc, eq } from "drizzle-orm";
import { ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { battles } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(battles)
      .where(and(eq(battles.ownerId, profile.id), eq(battles.mode, "pvp")))
      .orderBy(desc(battles.createdAt))
      .limit(20);

    return ok({
      rating: profile.rating,
      battles: rows.map((battle) => ({
        id: battle.id,
        createdAt: battle.createdAt,
        status: battle.status,
        winner: battle.result?.winner ?? null,
        durationMs: battle.result?.durationMs ?? null,
      })),
    });
  });
}
