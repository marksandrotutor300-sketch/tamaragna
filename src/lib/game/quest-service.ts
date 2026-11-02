import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, questStates } from "@/lib/db/schema";
import {
  claimLogin,
  claimQuest,
  defaultQuestState,
  loginView,
  normalizeQuestState,
  questViews,
  recordQuestEvent as applyQuestEvent,
  type QuestEvent,
  type QuestKind,
  type QuestState,
  type QuestSummary,
} from "./quests";

export async function loadQuestState(profileId: string): Promise<QuestState> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(questStates)
    .where(eq(questStates.profileId, profileId))
    .limit(1);

  if (!rows[0]) {
    const state = defaultQuestState();
    await db.insert(questStates).values({ profileId, state }).onConflictDoNothing();
    return state;
  }

  const state = normalizeQuestState(rows[0].state);
  if (rows[0].state.day !== state.day || rows[0].state.week !== state.week) {
    await db
      .update(questStates)
      .set({ state, updatedAt: new Date() })
      .where(eq(questStates.profileId, profileId));
  }
  return state;
}

export async function getQuestSummary(profileId: string): Promise<QuestSummary> {
  const state = await loadQuestState(profileId);
  const views = questViews(state);
  return {
    day: state.day,
    week: state.week,
    daily: views.daily,
    weekly: views.weekly,
    login: loginView(state),
  };
}

export async function recordQuestEvent(
  profileId: string,
  event: QuestEvent,
  amount = 1,
): Promise<void> {
  const state = await loadQuestState(profileId);
  const next = applyQuestEvent(state, event, amount);
  const db = await getDb();
  await db
    .insert(questStates)
    .values({ profileId, state: next })
    .onConflictDoUpdate({
      target: questStates.profileId,
      set: { state: next, updatedAt: new Date() },
    });
}

/** Progress is a nice-to-have; never fail the primary action because of it. */
export async function recordQuestEventSafe(
  profileId: string,
  event: QuestEvent,
  amount = 1,
): Promise<void> {
  try {
    await recordQuestEvent(profileId, event, amount);
  } catch (error) {
    console.error("[quests]", error);
  }
}

export async function claimQuestReward(
  profileId: string,
  kind: QuestKind,
  id: string,
): Promise<{ coins: number; eggs: number } | null> {
  const state = await loadQuestState(profileId);
  const result = claimQuest(state, kind, id);
  if (!result) return null;

  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        coins: sql`${profiles.coins} + ${result.coins}`,
        eggs: sql`${profiles.eggs} + ${result.eggs}`,
      })
      .where(eq(profiles.id, profileId));

    await tx
      .insert(questStates)
      .values({ profileId, state: result.state })
      .onConflictDoUpdate({
        target: questStates.profileId,
        set: { state: result.state, updatedAt: new Date() },
      });
  });

  return { coins: result.coins, eggs: result.eggs };
}

export async function claimLoginReward(
  profileId: string,
): Promise<{ coins: number; eggs: number } | null> {
  const state = await loadQuestState(profileId);
  const result = claimLogin(state);
  if (!result) return null;

  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        coins: sql`${profiles.coins} + ${result.coins}`,
        eggs: sql`${profiles.eggs} + ${result.eggs}`,
      })
      .where(eq(profiles.id, profileId));

    await tx
      .insert(questStates)
      .values({ profileId, state: result.state })
      .onConflictDoUpdate({
        target: questStates.profileId,
        set: { state: result.state, updatedAt: new Date() },
      });
  });

  return { coins: result.coins, eggs: result.eggs };
}
