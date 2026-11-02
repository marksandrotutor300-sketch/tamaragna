import { and, eq, isNull } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { battleShares, battles } from "@/lib/db/schema";
import { featureUnavailable } from "@/lib/features";
import { createShareToken, sharePath } from "@/lib/game/share";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("share");
  if (disabled) return disabled;

  const { id } = await context.params;

  return withUser(async (profile) => {
    if (
      !(await checkRateLimit(`${profile.id}:share-create`, LIMITS.shareCreate))
    ) {
      return fail("Too many share links - wait a minute", 429);
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(battles)
      .where(and(eq(battles.id, id), eq(battles.ownerId, profile.id)))
      .limit(1);
    const battle = rows[0];

    if (!battle) return fail("Battle not found", 404);
    if (battle.status !== "complete" || !battle.result) {
      return fail("Finish the battle before sharing it", 400);
    }

    const token = createShareToken();
    await db.transaction(async (tx) => {
      await tx
        .update(battleShares)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(battleShares.battleId, battle.id),
            isNull(battleShares.revokedAt),
          ),
        );
      await tx.insert(battleShares).values({
        token,
        battleId: battle.id,
        ownerId: profile.id,
      });
    });

    return ok({
      token,
      path: sharePath(token),
      url: `${siteUrl(request)}${sharePath(token)}`,
    });
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("share");
  if (disabled) return disabled;

  const { id } = await context.params;

  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(battles)
      .where(and(eq(battles.id, id), eq(battles.ownerId, profile.id)))
      .limit(1);

    if (!rows[0]) return fail("Battle not found", 404);

    await db
      .update(battleShares)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(battleShares.battleId, id),
          isNull(battleShares.revokedAt),
        ),
      );

    return ok({ revoked: true });
  });
}
