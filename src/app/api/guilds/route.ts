import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withActor, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { guildMembers, guilds, profiles } from "@/lib/db/schema";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(3).max(24),
  tag: z.string().trim().min(2).max(5),
  description: z.string().trim().max(160).optional(),
});

export async function GET(): Promise<Response> {
  return withActor(async (actor) => {
    const db = await getDb();
    const rows = await db.select().from(guilds).orderBy(desc(guilds.createdAt)).limit(30);
    const members = await db
      .select({ guildId: guildMembers.guildId, profileId: guildMembers.profileId })
      .from(guildMembers);
    const counts = new Map<string, number>();
    for (const member of members) {
      counts.set(member.guildId, (counts.get(member.guildId) ?? 0) + 1);
    }
    const mine = await db
      .select({ guildId: guildMembers.guildId })
      .from(guildMembers)
      .where(eq(guildMembers.profileId, actor.profile.id))
      .limit(1);
    return ok({
      guilds: rows.map((guild) => ({
        ...guild,
        members: counts.get(guild.id) ?? 0,
      })),
      myGuildId: mine[0]?.guildId ?? null,
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:guild-create`, LIMITS.guildCreate))) {
      return fail("Too many guild actions - wait a few minutes", 429);
    }
    const parsed = await parseBody(request, createSchema);
    if ("error" in parsed) return parsed.error;

    const db = await getDb();
    const existing = await db
      .select({ guildId: guildMembers.guildId })
      .from(guildMembers)
      .where(eq(guildMembers.profileId, profile.id))
      .limit(1);
    if (existing[0]) return fail("Leave your current guild first", 409);
    if (profile.coins < 500) return fail("Creating a guild needs 500 coins", 400);

    const name = parsed.data.name;
    const conflict = await db
      .select({ id: guilds.id })
      .from(guilds)
      .where(eq(guilds.name, name))
      .limit(1);
    if (conflict[0]) return fail("That guild name is taken", 409);

    const guild = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(guilds)
        .values({
          name,
          tag: parsed.data.tag.toUpperCase(),
          ownerId: profile.id,
          description: parsed.data.description ?? "",
        })
        .returning();
      await tx.insert(guildMembers).values({
        guildId: inserted[0].id,
        profileId: profile.id,
        role: "leader",
      });
      await tx
        .update(profiles)
        .set({ coins: profile.coins - 500 })
        .where(eq(profiles.id, profile.id));
      return inserted[0];
    });

    return ok({ guild });
  });
}
