import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { battles, pets, profiles, type BattlePayload, type Profile } from "@/lib/db/schema";
import { grantExp } from "./leveling";
import { getPetMasteryMap } from "./mastery";
import type { Pet } from "@/lib/db/schema";

export async function loadTeamPets(
  ownerId: string,
): Promise<Array<Pet & { mastery: Record<number, number> }>> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(pets)
    .where(
      and(
        eq(pets.ownerId, ownerId),
        isNotNull(pets.slot),
        eq(pets.marketListed, false),
        isNull(pets.expeditionId),
      ),
    )
    .orderBy(asc(pets.slot));
  const mastery = await getPetMasteryMap(rows.map((pet) => pet.id));
  return rows.map((pet) => ({
    ...pet,
    mastery: mastery[pet.id] ?? {},
  }));
}

export async function createBattleRow(params: {
  ownerId: string;
  mode: "practice" | "tower" | "pvp" | "live" | "dojo";
  seed: string;
  payload: BattlePayload;
  opponentSnapshotId?: string;
  towerRunId?: string;
}) {
  const db = await getDb();
  const inserted = await db
    .insert(battles)
    .values({
      ownerId: params.ownerId,
      mode: params.mode,
      seed: params.seed,
      payload: {
        ...params.payload,
        version: params.payload.version ?? 2,
      },
      opponentSnapshotId: params.opponentSnapshotId ?? null,
      towerRunId: params.towerRunId ?? null,
    })
    .returning();
  return inserted[0];
}

export async function grantBattleRewards(
  profile: Profile,
  petIds: string[],
  coins: number,
  exp: number,
  eggs = 0,
): Promise<{ profile: Profile; levelUps: Array<{ petId: string; level: number }> }> {
  const db = await getDb();
  const levelUps: Array<{ petId: string; level: number }> = [];

  if (petIds.length > 0 && exp > 0) {
    const rows = await db
      .select()
      .from(pets)
      .where(and(eq(pets.ownerId, profile.id), inArray(pets.id, petIds)));

    for (const pet of rows) {
      const result = grantExp(pet.level, pet.exp, exp);
      if (result.levelsGained > 0) levelUps.push({ petId: pet.id, level: result.level });
      await db
        .update(pets)
        .set({ level: result.level, exp: result.exp })
        .where(eq(pets.id, pet.id));
    }
  }

  const updated = await db
    .update(profiles)
    .set({
      coins: Math.max(0, profile.coins + coins),
      eggs: profile.eggs + eggs,
      lastBattleAt: new Date(),
    })
    .where(eq(profiles.id, profile.id))
    .returning();

  return { profile: updated[0] ?? profile, levelUps };
}
