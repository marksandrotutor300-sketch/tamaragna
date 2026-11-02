import { eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { guildMembers, guilds } from "@/lib/db/schema";

export const runtime = "nodejs";

const MAX_MEMBERS = 20;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (profile) => {
    const db = await getDb();
    const guildRows = await db.select().from(guilds).where(eq(guilds.id, id)).limit(1);
    if (!guildRows[0]) return fail("Guild not found", 404);

    const current = await db
      .select({ guildId: guildMembers.guildId })
      .from(guildMembers)
      .where(eq(guildMembers.profileId, profile.id))
      .limit(1);
    if (current[0]) return fail("You are already in a guild", 409);

    const members = await db
      .select({ profileId: guildMembers.profileId })
      .from(guildMembers)
      .where(eq(guildMembers.guildId, id));
    if (members.length >= MAX_MEMBERS) return fail("Guild is full", 400);

    await db.insert(guildMembers).values({ guildId: id, profileId: profile.id });
    return ok({ joined: true });
  });
}
