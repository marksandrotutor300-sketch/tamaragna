import { z } from "zod";
import { adminGuard } from "@/lib/admin";
import { fail, ok, parseBody } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { rankedCups, tournaments } from "@/lib/db/schema";
import { currentSeason } from "@/lib/db/auth";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(3).max(60),
  size: z.union([z.literal(4), z.literal(8)]),
  startsAt: z.string().datetime().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const guard = adminGuard(request);
  if (guard) return guard;
  const parsed = await parseBody(request, schema);
  if ("error" in parsed) return parsed.error;
  if (!process.env.ADMIN_TOKEN) return fail("ADMIN_TOKEN is not configured", 404);

  const db = await getDb();
  const season = await currentSeason();
  const startsAt = parsed.data.startsAt
    ? new Date(parsed.data.startsAt)
    : new Date(Date.now() + 60 * 60_000);

  const result = await db.transaction(async (tx) => {
    const [tournament] = await tx
      .insert(tournaments)
      .values({
        name: parsed.data.name,
        size: parsed.data.size,
        season,
        startsAt,
      })
      .returning();
    const [cup] = await tx
      .insert(rankedCups)
      .values({
        tournamentId: tournament.id,
        name: parsed.data.name,
        season,
        startsAt,
      })
      .returning();
    return { cup, tournament };
  });

  return ok(result);
}
