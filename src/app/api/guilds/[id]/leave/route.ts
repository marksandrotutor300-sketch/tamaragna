import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { guildMembers } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(guildMembers)
      .where(
        and(eq(guildMembers.guildId, id), eq(guildMembers.profileId, profile.id)),
      )
      .limit(1);
    if (!rows[0]) return fail("You are not in this guild", 404);
    if (rows[0].role === "leader") {
      return fail("Leaders must disband the guild", 400);
    }
    await db
      .delete(guildMembers)
      .where(
        and(eq(guildMembers.guildId, id), eq(guildMembers.profileId, profile.id)),
      );
    return ok({ left: true });
  });
}
