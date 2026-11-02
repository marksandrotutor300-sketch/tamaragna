import { MAX_LEVEL } from "./stats";

export const EXP_CURVE_BASE = 80;

export function expToNext(level: number): number {
  if (level >= MAX_LEVEL) return Number.POSITIVE_INFINITY;
  return Math.floor(EXP_CURVE_BASE * Math.pow(level, 1.5));
}

export type LevelResult = {
  level: number;
  exp: number;
  levelsGained: number;
};

export function grantExp(level: number, exp: number, amount: number): LevelResult {
  let nextLevel = Math.max(1, level);
  let nextExp = Math.max(0, exp) + Math.max(0, Math.floor(amount));
  let levelsGained = 0;

  while (nextLevel < MAX_LEVEL && nextExp >= expToNext(nextLevel)) {
    nextExp -= expToNext(nextLevel);
    nextLevel += 1;
    levelsGained += 1;
  }

  if (nextLevel >= MAX_LEVEL) nextExp = 0;

  return { level: nextLevel, exp: nextExp, levelsGained };
}
