import type { CareAction, CareState } from "./types";

const HOUR = 3_600_000;

export const CARE_DECAY_PER_HOUR = {
  hunger: 4,
  energy: 6,
  mood: 3,
};

export const SLEEP_ENERGY_PER_HOUR = 8;
export const MAX_OFFLINE_HOURS = 36;

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function defaultCare(now = new Date()): CareState {
  return {
    hunger: 80,
    mood: 80,
    energy: 80,
    friendship: 20,
    lastCareAt: now.toISOString(),
    sleeping: false,
  };
}

/**
 * Advance care values to `now`. Nothing ticks in the background - this is the
 * single source of truth for decay, capped so a long absence is not fatal.
 */
export function normalizeCare(care: CareState, now = new Date()): CareState {
  const last = new Date(care.lastCareAt).getTime();
  if (!Number.isFinite(last)) return { ...care, lastCareAt: now.toISOString() };

  const elapsedHours = Math.min(MAX_OFFLINE_HOURS, Math.max(0, (now.getTime() - last) / HOUR));
  if (elapsedHours === 0) return care;

  const hungerRate = care.sleeping
    ? CARE_DECAY_PER_HOUR.hunger * 0.5
    : CARE_DECAY_PER_HOUR.hunger;
  const energyDelta = care.sleeping
    ? SLEEP_ENERGY_PER_HOUR
    : -CARE_DECAY_PER_HOUR.energy;

  return {
    hunger: clamp(care.hunger - elapsedHours * hungerRate),
    mood: clamp(care.mood - elapsedHours * CARE_DECAY_PER_HOUR.mood),
    energy: clamp(care.energy + elapsedHours * energyDelta),
    friendship: clamp(care.friendship),
    sleeping: care.sleeping,
    lastCareAt: now.toISOString(),
  };
}

export function applyCareAction(care: CareState, action: CareAction, now = new Date()): CareState {
  const current = normalizeCare(care, now);

  switch (action) {
    case "feed":
      return { ...current, hunger: clamp(current.hunger + 30), friendship: clamp(current.friendship + 1) };
    case "play":
      return {
        ...current,
        mood: clamp(current.mood + 15),
        energy: clamp(current.energy - 10),
        friendship: clamp(current.friendship + 1),
      };
    case "rest":
      return { ...current, sleeping: true };
    case "wake":
      return { ...current, sleeping: false };
    case "train":
      return {
        ...current,
        energy: clamp(current.energy - 20),
        friendship: clamp(current.friendship + 1),
      };
    default:
      return current;
  }
}

export const CARE_COSTS: Record<CareAction, number> = {
  feed: 20,
  play: 10,
  rest: 0,
  wake: 0,
  train: 30,
};

export type CareMood = "happy" | "content" | "hungry" | "tired" | "sad";

export function careMood(care: CareState): CareMood {
  if (care.hunger < 35) return "hungry";
  if (care.energy < 30) return "tired";
  if (care.mood < 35) return "sad";
  if (care.mood >= 70 && care.hunger >= 70) return "happy";
  return "content";
}
