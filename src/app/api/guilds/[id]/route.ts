import { desc, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import {
  guildContributions,
  guildMembers,
  guildRaids,
  guilds,
  profiles,
} from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const db = await getDb();
  const rows = await db.select().from(guilds).where(eq(guilds.id, id)).limit(1);
  const guild = rows[0];
  if (!guild) return fail("Guild not found", 404);

  const members = await db
    .select({
      profileId: guildMembers.profileId,
      role: guildMembers.role,
      joinedAt: guildMembers.joinedAt,
      displayName: profiles.displayName,
      rating: profiles.rating,
    })
    .from(guildMembers)
    .innerJoin(profiles, eq(guildMembers.profileId, profiles.id))
    .where(eq(guildMembers.guildId, id))
    .orderBy(desc(profiles.rating));

  const raidRows = await db
    .select()
    .from(guildRaids)
    .where(eq(guildRaids.guildId, id))
    .orderBy(desc(guildRaids.createdAt))
    .limit(1);
  const raid = raidRows[0] ?? null;

  let contributions: Array<{
    profileId: string;
    displayName: string;
    damage: number;
    attacks: number;
  }> = [];
  if (raid) {
    contributions = await db
      .select({
        profileId: guildContributions.profileId,
        displayName: profiles.displayName,
        damage: guildContributions.damage,
        attacks: guildContributions.attacks,
      })
      .from(guildContributions)
      .innerJoin(profiles, eq(guildContributions.profileId, profiles.id))
      .where(eq(guildContributions.raidId, raid.id))
      .orderBy(desc(guildContributions.damage))
      .limit(20);
  }

  return ok({ guild, members, raid, contributions });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db.select().from(guilds).where(eq(guilds.id, id)).limit(1);
    if (!rows[0]) return fail("Guild not found", 404);
    if (rows[0].ownerId !== profile.id) return fail("Only the leader can disband", 403);
    await db.delete(guilds).where(eq(guilds.id, id));
    return ok({ disbanded: true });
  });
}
