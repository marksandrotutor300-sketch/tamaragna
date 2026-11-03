export type QuestEvent =
  | "care"
  | "hatch"
  | "battle_win"
  | "tower_wave"
  | "card_win"
  | "card_room"
  | "card_run";
export type QuestKind = "daily" | "weekly";

export type QuestDef = {
  id: string;
  name: string;
  description: string;
  event: QuestEvent;
  target: number;
  kind: QuestKind;
  coins: number;
  eggs: number;
};

export const DAILY_QUESTS: QuestDef[] = [
  {
    id: "care-3",
    name: "Tender care",
    description: "Feed, play or train 3 times.",
    event: "care",
    target: 3,
    kind: "daily",
    coins: 60,
    eggs: 0,
  },
  {
    id: "win-2",
    name: "Winning mood",
    description: "Win 2 battles in any mode.",
    event: "battle_win",
    target: 2,
    kind: "daily",
    coins: 80,
    eggs: 0,
  },
  {
    id: "tower-3",
    name: "Climb three",
    description: "Clear 3 tower waves.",
    event: "tower_wave",
    target: 3,
    kind: "daily",
    coins: 100,
    eggs: 0,
  },
  {
    id: "hatch-1",
    name: "New friend",
    description: "Hatch 1 egg.",
    event: "hatch",
    target: 1,
    kind: "daily",
    coins: 50,
    eggs: 0,
  },
  {
    id: "card-win-1",
    name: "Rift skirmish",
    description: "Win 1 Rift Deck battle.",
    event: "card_win",
    target: 1,
    kind: "daily",
    coins: 80,
    eggs: 0,
  },
];

export const WEEKLY_QUESTS: QuestDef[] = [
  {
    id: "win-10",
    name: "Duelist",
    description: "Win 10 battles in any mode.",
    event: "battle_win",
    target: 10,
    kind: "weekly",
    coins: 300,
    eggs: 1,
  },
  {
    id: "tower-15",
    name: "Tower climber",
    description: "Clear 15 tower waves.",
    event: "tower_wave",
    target: 15,
    kind: "weekly",
    coins: 400,
    eggs: 0,
  },
  {
    id: "hatch-5",
    name: "Ranch growth",
    description: "Hatch 5 eggs.",
    event: "hatch",
    target: 5,
    kind: "weekly",
    coins: 300,
    eggs: 1,
  },
  {
    id: "card-room-10",
    name: "Rift delver",
    description: "Clear 10 Rift Deck rooms.",
    event: "card_room",
    target: 10,
    kind: "weekly",
    coins: 350,
    eggs: 0,
  },
  {
    id: "card-run-1",
    name: "Rift conqueror",
    description: "Complete 1 three-act Rift Deck run.",
    event: "card_run",
    target: 1,
    kind: "weekly",
    coins: 500,
    eggs: 1,
  },
];

export type QuestPeriod = {
  progress: Record<string, number>;
  claimed: string[];
};

export type QuestState = {
  day: string;
  week: string;
  streak: number;
  lastClaimedDay: string | null;
  daily: QuestPeriod;
  weekly: QuestPeriod;
};

export type QuestView = QuestDef & {
  progress: number;
  completed: boolean;
  claimed: boolean;
};

export type LoginView = {
  claimable: boolean;
  streak: number;
  nextStreak: number;
  coins: number;
  eggs: number;
  lastClaimedDay: string | null;
};

export type QuestSummary = {
  day: string;
  week: string;
  daily: QuestView[];
  weekly: QuestView[];
  login: LoginView;
};

export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function weekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return dayKey(d);
}

export function defaultQuestState(now = new Date()): QuestState {
  return {
    day: dayKey(now),
    week: weekKey(now),
    streak: 0,
    lastClaimedDay: null,
    daily: { progress: {}, claimed: [] },
    weekly: { progress: {}, claimed: [] },
  };
}

export function normalizeQuestState(state: QuestState, now = new Date()): QuestState {
  const day = dayKey(now);
  const week = weekKey(now);
  return {
    ...state,
    day,
    week,
    daily: state.day === day ? state.daily : { progress: {}, claimed: [] },
    weekly: state.week === week ? state.weekly : { progress: {}, claimed: [] },
  };
}

export function recordQuestEvent(
  state: QuestState,
  event: QuestEvent,
  amount = 1,
  now = new Date(),
): QuestState {
  const current = normalizeQuestState(state, now);
  const increment = Math.max(0, amount);

  return {
    ...current,
    daily: {
      ...current.daily,
      progress: {
        ...current.daily.progress,
        [event]: (current.daily.progress[event] ?? 0) + increment,
      },
    },
    weekly: {
      ...current.weekly,
      progress: {
        ...current.weekly.progress,
        [event]: (current.weekly.progress[event] ?? 0) + increment,
      },
    },
  };
}

export function questViews(state: QuestState): {
  daily: QuestView[];
  weekly: QuestView[];
} {
  const view = (defs: QuestDef[], period: QuestPeriod): QuestView[] =>
    defs.map((def) => {
      const progress = Math.min(def.target, period.progress[def.event] ?? 0);
      return {
        ...def,
        progress,
        completed: progress >= def.target,
        claimed: period.claimed.includes(def.id),
      };
    });

  return {
    daily: view(DAILY_QUESTS, state.daily),
    weekly: view(WEEKLY_QUESTS, state.weekly),
  };
}

export function findQuest(kind: QuestKind, id: string): QuestDef | undefined {
  return (kind === "daily" ? DAILY_QUESTS : WEEKLY_QUESTS).find((quest) => quest.id === id);
}

export function claimQuest(
  state: QuestState,
  kind: QuestKind,
  id: string,
  now = new Date(),
): { state: QuestState; coins: number; eggs: number } | null {
  const current = normalizeQuestState(state, now);
  const definition = findQuest(kind, id);
  if (!definition) return null;

  const period = kind === "daily" ? current.daily : current.weekly;
  const progress = period.progress[definition.event] ?? 0;
  if (progress < definition.target || period.claimed.includes(id)) return null;

  const nextPeriod: QuestPeriod = {
    ...period,
    claimed: [...period.claimed, id],
  };

  return {
    state: {
      ...current,
      ...(kind === "daily" ? { daily: nextPeriod } : { weekly: nextPeriod }),
    },
    coins: definition.coins,
    eggs: definition.eggs,
  };
}

export function loginReward(streak: number): { coins: number; eggs: number } {
  return {
    coins: 50 + 10 * Math.min(streak, 10),
    eggs: [7, 14, 21, 28].includes(streak) ? 1 : 0,
  };
}

export function loginView(state: QuestState, now = new Date()): LoginView {
  const current = normalizeQuestState(state, now);
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const claimable = current.lastClaimedDay !== today;
  const nextStreak = claimable
    ? current.lastClaimedDay === yesterday
      ? current.streak + 1
      : 1
    : current.streak;
  const reward = loginReward(nextStreak);

  return {
    claimable,
    streak: current.streak,
    nextStreak,
    coins: reward.coins,
    eggs: reward.eggs,
    lastClaimedDay: current.lastClaimedDay,
  };
}

export function claimLogin(
  state: QuestState,
  now = new Date(),
): { state: QuestState; coins: number; eggs: number } | null {
  const current = normalizeQuestState(state, now);
  const view = loginView(current, now);
  if (!view.claimable) return null;

  return {
    state: {
      ...current,
      streak: view.nextStreak,
      lastClaimedDay: dayKey(now),
    },
    coins: view.coins,
    eggs: view.eggs,
  };
}
