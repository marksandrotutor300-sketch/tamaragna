import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { battles, dojoGhosts, profiles } from "@/lib/db/schema";
import { loadTeamPets } from "@/lib/game/battles";
import { teamToCombatants } from "@/lib/game/team";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(24),
  source: z.enum(["team", "lastOpponent"]).default("team"),
});

export async function GET(): Promise<Response> {
  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(dojoGhosts)
      .where(eq(dojoGhosts.ownerId, profile.id))
      .orderBy(desc(dojoGhosts.createdAt))
      .limit(20);
    return ok({ ghosts: rows });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:dojo-train`, LIMITS.dojoTrain))) {
      return fail("The dojo needs time to reset", 429);
    }
    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;
    if (profile.coins < 100) return fail("Training a ghost needs 100 coins", 400);

    const db = await getDb();
    const existing = await db
      .select({ id: dojoGhosts.id })
      .from(dojoGhosts)
      .where(eq(dojoGhosts.ownerId, profile.id));
    if (existing.length >= 8) return fail("The dojo holds eight ghosts", 400);

    let team;
    let source = parsed.data.source;
    if (source === "team") {
      const members = await loadTeamPets(profile.id);
      if (members.length === 0) return fail("Put a team together first", 400);
      team = teamToCombatants(members);
    } else {
      const recent = await db
        .select()
        .from(battles)
        .where(eq(battles.ownerId, profile.id))
        .orderBy(desc(battles.createdAt))
        .limit(20);
      const withOpponent = recent.find(
        (battle) => battle.payload.teamB.length > 0,
      );
      if (!withOpponent) {
        return fail("No recent opponent to learn from yet", 400);
      }
      team = withOpponent.payload.teamB;
      source = "lastOpponent";
    }

    const ghost = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(dojoGhosts)
        .values({
          ownerId: profile.id,
          name: parsed.data.name,
          team,
          source,
          difficulty: Math.max(1, Math.min(10, Math.floor(profile.rating / 100) - 8)),
        })
        .returning();
      await tx
        .update(profiles)
        .set({ coins: profile.coins - 100 })
        .where(eq(profiles.id, profile.id));
      return inserted;
    });

    return ok({ ghost, coins: profile.coins - 100 });
  });
}
