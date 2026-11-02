import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { battles } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  return withUser(async (profile) => {
    const db = await getDb();
    const found = await db
      .select()
      .from(battles)
      .where(and(eq(battles.id, id), eq(battles.ownerId, profile.id)))
      .limit(1);

    const battle = found[0];
    if (!battle) return fail("Battle not found", 404);

    return ok({
      battleId: battle.id,
      mode: battle.mode,
      seed: battle.seed,
      payload: battle.payload,
      status: battle.status,
      result: battle.result,
      resultHash: battle.resultHash,
      inputLog: battle.inputLog,
    });
  });
}
