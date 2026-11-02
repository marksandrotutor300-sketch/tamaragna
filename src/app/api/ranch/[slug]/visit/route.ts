import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { profiles, ranchVisits } from "@/lib/db/schema";
import { getHabitat } from "@/lib/game/habitats";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params;
  return withUser(async (visitor) => {
    if (!(await checkRateLimit(`${visitor.id}:ranch-visit`, LIMITS.ranchVisit))) {
      return fail("Too many ranch visits - take a break", 429);
    }
    const db = await getDb();
    const hostRows = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.publicSlug, slug), eq(profiles.publicCard, true)))
      .limit(1);
    const host = hostRows[0];
    if (!host) return fail("Trainer card not found", 404);
    if (host.id === visitor.id) return fail("You cannot visit your own ranch", 400);

    const result = await db.transaction(async (tx) => {
      await tx.insert(ranchVisits).values({
        hostId: host.id,
        visitorId: visitor.id,
        message: "stopped by the ranch",
      });
      const [updatedHost] = await tx
        .update(profiles)
        .set({ coins: host.coins + 10 })
        .where(eq(profiles.id, host.id))
        .returning();
      const [updatedVisitor] = await tx
        .update(profiles)
        .set({ coins: visitor.coins + 5 })
        .where(eq(profiles.id, visitor.id))
        .returning();
      return { host: updatedHost, visitor: updatedVisitor };
    });

    return ok({
      visited: true,
      host: {
        displayName: host.displayName,
        habitat: getHabitat(host.habitat),
      },
      coins: result.visitor?.coins ?? visitor.coins + 5,
    });
  });
}
