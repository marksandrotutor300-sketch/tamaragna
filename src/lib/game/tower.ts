import { Rng } from "@/lib/rng";
import { checksum } from "@/lib/sim/checksum";
import type { CombatantInit } from "@/lib/sim/types";
import { affixesForWave, applyAffixes } from "./affixes";
import { buildWildCombatant, zeroIvs } from "./combatant";
import { ALL_SPECIES } from "./species";
import type { Rarity } from "./types";

export const EGG_REWARD_WAVES = new Set([10, 25, 50, 100, 200]);

export function waveEnemyCount(wave: number): number {
  if (wave < 5) return 1;
  if (wave < 10) return 2;
  return 3;
}

export function waveSeed(runSeed: string, wave: number): string {
  return checksum(`${runSeed}:wave:${wave}`);
}

export function waveRewards(wave: number): { coins: number; exp: number; eggs: number } {
  return {
    coins: 20 + 4 * wave,
    exp: 15 + 3 * wave,
    eggs: EGG_REWARD_WAVES.has(wave) ? 1 : 0,
  };
}

export type Wave = {
  wave: number;
  seed: string;
  boss: boolean;
  enemies: CombatantInit[];
};

/**
 * Build a deterministic wave. Enemies scale from the team's level so a fresh
 * level-1 pet can clear the opening waves; every 10th wave is an MVP.
 */
export function buildWave(runSeed: string, wave: number, teamLevel = 10): Wave {
  const seed = waveSeed(runSeed, wave);
  const rng = new Rng(seed);
  const boss = wave % 10 === 0;

  const eligible = boss
    ? ALL_SPECIES.filter((species) => species.mvp && species.playable)
    : ALL_SPECIES.filter(
        (species) =>
          species.playable &&
          !species.mvp &&
          species.level <= 30 + wave * 3 &&
          species.level >= Math.max(1, wave * 1.5 - 10),
      );

  const pool =
    eligible.length > 0
      ? eligible
      : ALL_SPECIES.filter((species) => species.playable && !species.mvp);

  const level = Math.min(80, Math.max(1, teamLevel + Math.floor(wave / 2) - 1));
  const rarity = Math.min(5, 1 + Math.floor(wave / 15)) as Rarity;
  const statMultiplier = (boss ? 1.15 : 1) * (1 + 0.035 * (wave - 1));
  const hpMultiplier = (boss ? 1.15 : 1) * (1 + 0.05 * (wave - 1));
  const count = waveEnemyCount(wave);
  // Every fifth wave is elite; every tenth (MVP) wave carries two affixes.
  const affixCount = wave % 10 === 0 ? 2 : wave % 5 === 0 ? 1 : 0;
  const affixes = affixCount > 0 ? affixesForWave(seed, wave, affixCount) : [];

  const enemies: CombatantInit[] = [];
  for (let i = 0; i < count; i += 1) {
    const species = rng.pick(pool);
    const enemy = buildWildCombatant({
      petId: `wave-${wave}-${i}`,
      species,
      level,
      rarity,
      rng,
      statMultiplier,
      hpMultiplier,
      // Keep the opening waves neutral and IV-free so a fresh pet can
      // clear them; later waves roll both for variety.
      nature: wave < 5 ? "hardy" : undefined,
      ivs: wave < 5 ? zeroIvs() : undefined,
    });
    enemies.push(affixes.length > 0 ? applyAffixes(enemy, affixes) : enemy);
  }

  return { wave, seed, boss, enemies };
}

/** Heal between waves so a run is survivable without being free. */
export function healTeam(combatants: CombatantInit[], fraction = 0.25): CombatantInit[] {
  return combatants.map((combatant) => {
    const maxHp = combatant.stats.hpMax;
    const current = combatant.hp ?? maxHp;
    return {
      ...combatant,
      hp: Math.min(maxHp, Math.round(current + maxHp * fraction)),
    };
  });
}

export function carryOverHp(
  combatants: CombatantInit[],
  resultSides: { a: { fighters: Array<{ petId: string; hp: number }> } },
): CombatantInit[] {
  const hpByPet = new Map(resultSides.a.fighters.map((fighter) => [fighter.petId, fighter.hp]));
  return combatants.map((combatant) => ({
    ...combatant,
    hp: hpByPet.get(combatant.petId) ?? combatant.hp,
  }));
}
