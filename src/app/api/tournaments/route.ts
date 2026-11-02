import { z } from "zod";
import { superAdminGuard } from "@/lib/admin";
import { ok, parseBody } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { tournaments } from "@/lib/db/schema";
import { currentSeason } from "@/lib/db/auth";
import { featureUnavailable } from "@/lib/features";
import { listTournaments } from "@/lib/tournaments";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const disabled = featureUnavailable("livePvp");
  if (disabled) return disabled;
  return ok({ tournaments: await listTournaments() });
}

const schema = z.object({
  name: z.string().trim().min(3).max(60),
  size: z.union([z.literal(4), z.literal(8), z.literal(16)]),
  startsAt: z.string().datetime().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const disabled = featureUnavailable("livePvp");
  if (disabled) return disabled;

  const guard = await superAdminGuard(request);
  if (guard) return guard;

  const parsed = await parseBody(request, schema);
  if ("error" in parsed) return parsed.error;

  const db = await getDb();
  const inserted = await db
    .insert(tournaments)
    .values({
      name: parsed.data.name,
      size: parsed.data.size,
      season: await currentSeason(),
      startsAt: parsed.data.startsAt
        ? new Date(parsed.data.startsAt)
        : new Date(Date.now() + 60 * 60_000),
    })
    .returning();

  return ok({ tournament: inserted[0] });
}
