import { describe, expect, it } from "vitest";
import { AFFIXES, affixesForWave, applyAffixes } from "./affixes";
import { BLESSINGS, applyBlessing, draftOptions } from "./blessings";
import { buildCombatant, zeroIvs } from "./combatant";
import { defaultCare } from "./care";
import { featuredForDate } from "./featured";
import {
  claimLogin,
  claimQuest,
  dayKey,
  defaultQuestState,
  loginView,
  normalizeQuestState,
  questViews,
  recordQuestEvent,
  weekKey,
} from "./quests";
import {
  PLACEMENT_MATCHES,
  placementK,
  seasonRewards,
  seasonTier,
} from "./season";
import { requireSpecies } from "./species";
import { buildWave } from "./tower";

const NOW = new Date("2026-10-31T12:00:00Z"); // Saturday
const TOMORROW = new Date("2026-11-01T12:00:00Z");
const NEXT_WEEK = new Date("2026-11-02T12:00:00Z"); // Monday

describe("quests", () => {
  it("uses UTC day and Monday week keys", () => {
    expect(dayKey(NOW)).toBe("2026-10-31");
    expect(weekKey(NOW)).toBe("2026-10-26");
    expect(weekKey(TOMORROW)).toBe("2026-10-26");
    expect(weekKey(NEXT_WEEK)).toBe("2026-11-02");
  });

  it("records progress and resets periods independently", () => {
    const state = recordQuestEvent(defaultQuestState(NOW), "care", 3, NOW);
    expect(state.daily.progress.care).toBe(3);
    expect(state.weekly.progress.care).toBe(3);

    const tomorrow = normalizeQuestState(state, TOMORROW);
    expect(tomorrow.daily.progress.care).toBeUndefined();
    expect(tomorrow.weekly.progress.care).toBe(3);

    const nextWeek = normalizeQuestState(state, NEXT_WEEK);
    expect(nextWeek.daily.progress.care).toBeUndefined();
    expect(nextWeek.weekly.progress.care).toBeUndefined();
  });

  it("shows completion and claims rewards once", () => {
    const state = recordQuestEvent(defaultQuestState(NOW), "care", 3, NOW);
    const views = questViews(state);
    const care = views.daily.find((quest) => quest.id === "care-3");
    expect(care?.completed).toBe(true);

    const claimed = claimQuest(state, "daily", "care-3", NOW);
    expect(claimed?.coins).toBe(60);
    expect(claimed?.eggs).toBe(0);
    expect(claimQuest(claimed!.state, "daily", "care-3", NOW)).toBeNull();
    expect(claimQuest(state, "daily", "win-2", NOW)).toBeNull();
  });

  it("advances the login streak, resets after a miss, and pays day seven", () => {
    const initial = defaultQuestState(NOW);
    expect(loginView(initial, NOW).nextStreak).toBe(1);

    const first = claimLogin(initial, NOW);
    expect(first?.coins).toBe(60);
    expect(claimLogin(first!.state, NOW)).toBeNull();

    const second = claimLogin(first!.state, TOMORROW);
    expect(second?.coins).toBe(70);
    expect(second?.state.streak).toBe(2);

    const missed = claimLogin(second!.state, new Date("2026-11-05T12:00:00Z"));
    expect(missed?.state.streak).toBe(1);

    const daySeven = claimLogin(
      { ...initial, streak: 6, lastClaimedDay: "2026-10-30" },
      NOW,
    );
    expect(daySeven?.eggs).toBe(1);
    expect(daySeven?.state.streak).toBe(7);
  });
});

describe("season", () => {
  it("maps ratings to tiers and adds the tower bonus", () => {
    expect(seasonTier(999).name).toBe("Bronze");
    expect(seasonTier(1100).name).toBe("Silver");
    expect(seasonTier(1250).name).toBe("Gold");
    expect(seasonTier(1400).name).toBe("Platinum");
    expect(seasonTier(1550).name).toBe("Diamond");

    const reward = seasonRewards(1550, 20);
    expect(reward.tier.name).toBe("Diamond");
    expect(reward.coins).toBe(900);
    expect(reward.eggs).toBe(3);
  });

  it("uses provisional K until placements finish", () => {
    expect(placementK(0)).toBe(40);
    expect(placementK(PLACEMENT_MATCHES - 1)).toBe(40);
    expect(placementK(PLACEMENT_MATCHES)).toBe(24);
  });
});

describe("featured species", () => {
  it("picks three deterministic, unique playable species per day", () => {
    const first = featuredForDate("2026-10-31");
    const second = featuredForDate("2026-10-31");
    expect(first.map((entry) => entry.id)).toEqual(second.map((entry) => entry.id));
    expect(first).toHaveLength(3);
    expect(new Set(first.map((entry) => entry.id)).size).toBe(3);
    expect(first.every((entry) => entry.playable)).toBe(true);
  });
});

describe("tower blessings", () => {
  const species = requireSpecies(1002);
  const combatant = buildCombatant({
    petId: "blessing-test",
    species,
    rarity: 3,
    level: 10,
    ivs: zeroIvs(),
    care: defaultCare(),
    name: species.name,
  });

  it("offers three unique deterministic choices", () => {
    const first = draftOptions("run-seed", 4);
    const second = draftOptions("run-seed", 4);
    expect(first.map((blessing) => blessing.id)).toEqual(
      second.map((blessing) => blessing.id),
    );
    expect(first).toHaveLength(3);
    expect(new Set(first.map((blessing) => blessing.id)).size).toBe(3);
    expect(first.every((blessing) => BLESSINGS.some((entry) => entry.id === blessing.id))).toBe(
      true,
    );
  });

  it("applies stat and HP blessings", () => {
    const fury = BLESSINGS.find((blessing) => blessing.id === "fury")!;
    const vitality = BLESSINGS.find((blessing) => blessing.id === "vitality")!;
    const strong = applyBlessing([combatant], fury)[0];
    const healthy = applyBlessing([combatant], vitality)[0];

    expect(strong.stats.atk).toBeGreaterThan(combatant.stats.atk);
    expect(healthy.stats.hpMax).toBeGreaterThan(combatant.stats.hpMax);
  });
});

describe("elite affixes", () => {
  const species = requireSpecies(1002);
  const combatant = buildCombatant({
    petId: "affix-test",
    species,
    rarity: 3,
    level: 10,
    ivs: zeroIvs(),
    care: defaultCare(),
    name: species.name,
  });

  it("picks deterministic affixes and labels the enemy", () => {
    const first = affixesForWave("wave-seed", 10, 2);
    const second = affixesForWave("wave-seed", 10, 2);
    expect(first.map((affix) => affix.id)).toEqual(second.map((affix) => affix.id));
    expect(first).toHaveLength(2);
    expect(first.every((affix) => AFFIXES.some((entry) => entry.id === affix.id))).toBe(true);

    const affixed = applyAffixes(combatant, first);
    expect(affixed.affix).toBeTruthy();
  });

  it("marks elite and boss waves but leaves the opening neutral", () => {
    expect(buildWave("run", 1, 10).enemies[0].affix).toBeUndefined();
    expect(buildWave("run", 5, 10).enemies[0].affix).toBeTruthy();
    expect(buildWave("run", 10, 10).enemies[0].affix).toBeTruthy();
  });
});
