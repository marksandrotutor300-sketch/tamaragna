import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { guildMembers, guildRaids } from "@/lib/db/schema";
import { getSpecies } from "@/lib/game/species";

export const runtime = "nodejs";

const BOSS_SPECIES_ID = 1039;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (profile) => {
    const db = await getDb();
    const membership = await db
      .select()
      .from(guildMembers)
      .where(
        and(eq(guildMembers.guildId, id), eq(guildMembers.profileId, profile.id)),
      )
      .limit(1);
    if (!membership[0]) return fail("Join the guild first", 403);
    if (membership[0].role !== "leader" && membership[0].role !== "officer") {
      return fail("Only leaders and officers can start raids", 403);
    }

    const active = await db
      .select()
      .from(guildRaids)
      .where(and(eq(guildRaids.guildId, id), eq(guildRaids.status, "active")))
      .limit(1);
    if (active[0]) return fail("Your guild already has an active raid", 409);

    const boss = getSpecies(BOSS_SPECIES_ID) ?? getSpecies(1002);
    if (!boss) return fail("Raid boss data unavailable", 500);

    const maxHp = 60_000;
    const inserted = await db
      .insert(guildRaids)
      .values({
        guildId: id,
        bossSpeciesId: boss.id,
        bossName: boss.name,
        maxHp,
        hp: maxHp,
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
      })
      .returning();

    return ok({ raid: inserted[0] });
  });
}
