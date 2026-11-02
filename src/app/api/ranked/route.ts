import { desc, eq } from "drizzle-orm";
import { ok } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { profiles, rankedCups, tournamentEntries, tournaments } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const db = await getDb();
  const leaders = await db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      rating: profiles.rating,
      season: profiles.season,
      spectatorPoints: profiles.spectatorPoints,
      publicSlug: profiles.publicSlug,
    })
    .from(profiles)
    .orderBy(desc(profiles.rating))
    .limit(20);

  const cupRows = await db
    .select({ cup: rankedCups, tournament: tournaments })
    .from(rankedCups)
    .innerJoin(tournaments, eq(rankedCups.tournamentId, tournaments.id))
    .orderBy(desc(rankedCups.startsAt))
    .limit(20);

  const entries = await db
    .select({
      tournamentId: tournamentEntries.tournamentId,
      profileId: tournamentEntries.profileId,
    })
    .from(tournamentEntries);
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.tournamentId, (counts.get(entry.tournamentId) ?? 0) + 1);
  }

  return ok({
    leaders,
    cups: cupRows.map(({ cup, tournament }) => ({
      ...cup,
      tournament,
      entrants: counts.get(tournament.id) ?? 0,
    })),
  });
}
