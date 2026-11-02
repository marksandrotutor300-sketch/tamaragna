import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { petSkillMastery } from "@/lib/db/schema";
import type { BattleEvent, CombatantInit, Side } from "@/lib/sim/types";

export const MASTERY_THRESHOLDS = [0, 10, 40, 100, 200] as const;

export function masteryLevelForXp(xp: number): number {
  let level = 1;
  for (let index = 0; index < MASTERY_THRESHOLDS.length; index += 1) {
    if (xp >= MASTERY_THRESHOLDS[index]) level = index + 1;
  }
  return Math.min(5, level);
}

export function masteryPowerMultiplier(level: number): number {
  return 1 + 0.02 * (Math.max(1, Math.min(5, level)) - 1);
}

/**
 * Counts verified casts from side A and adds one XP per cast. Only the server's
 * replayed events are trusted.
 */
export async function recordSkillMastery(
  team: CombatantInit[],
  events: BattleEvent[],
  side: Side = "a",
): Promise<void> {
  const casts = new Map<string, Map<number, number>>();

  for (const event of events) {
    if (event.type !== "skill" || event.side !== side) continue;
    const pet = team[event.actor];
    if (!pet) continue;
    const perPet = casts.get(pet.petId) ?? new Map<number, number>();
    perPet.set(event.skillId, (perPet.get(event.skillId) ?? 0) + 1);
    casts.set(pet.petId, perPet);
  }

  if (casts.size === 0) return;

  const db = await getDb();
  const petIds = [...casts.keys()];
  const existing = await db
    .select()
    .from(petSkillMastery)
    .where(inArray(petSkillMastery.petId, petIds));

  const byKey = new Map(
    existing.map((row) => [`${row.petId}:${row.skillId}`, row]),
  );

  for (const [petId, skills] of casts) {
    for (const [skillId, gained] of skills) {
      const current = byKey.get(`${petId}:${skillId}`);
      const xp = (current?.xp ?? 0) + gained;
      const level = masteryLevelForXp(xp);

      if (current) {
        await db
          .update(petSkillMastery)
          .set({ xp, level, updatedAt: new Date() })
          .where(
            and(
              eq(petSkillMastery.petId, petId),
              eq(petSkillMastery.skillId, skillId),
            ),
          );
      } else {
        await db.insert(petSkillMastery).values({ petId, skillId, xp, level });
      }
    }
  }
}

export async function getPetMasteryMap(
  petIds: string[],
): Promise<Record<string, Record<number, number>>> {
  if (petIds.length === 0) return {};
  const db = await getDb();
  const rows = await db
    .select()
    .from(petSkillMastery)
    .where(inArray(petSkillMastery.petId, petIds));

  const out: Record<string, Record<number, number>> = {};
  for (const row of rows) {
    out[row.petId] ??= {};
    out[row.petId][row.skillId] = row.level;
  }
  return out;
}
