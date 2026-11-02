import { defaultCare } from "../src/lib/game/care";
import { buildCombatant, zeroIvs } from "../src/lib/game/combatant";
import { requireSpecies } from "../src/lib/game/species";
import type { Rarity } from "../src/lib/game/types";
import { simulateBattle } from "../src/lib/sim/replay";
import type { CombatantInit } from "../src/lib/sim/types";

function make(speciesId: number, level: number, rarity: Rarity, key: string): CombatantInit {
  const species = requireSpecies(speciesId);
  return buildCombatant({
    petId: key,
    species,
    rarity,
    level,
    ivs: zeroIvs(),
    care: defaultCare(),
    name: species.name,
  });
}

const POOL = [1002, 1001, 1005, 1048, 1050, 1004, 1009, 1010, 1011, 1012, 1030, 1031, 1049];

function run(label: string, a: CombatantInit[], b: CombatantInit[], count: number) {
  const durations: number[] = [];
  const wins = { a: 0, b: 0, draw: 0 };

  for (let i = 0; i < count; i += 1) {
    const { result } = simulateBattle({
      seed: `${label}-${i}`,
      teamA: a,
      teamB: b,
      ai: { a: true, b: true },
    });
    durations.push(result.durationMs);
    wins[result.winner] += 1;
  }

  durations.sort((x, y) => x - y);
  const median = durations[Math.floor(durations.length / 2)];
  const p90 = durations[Math.floor(durations.length * 0.9)];
  console.log(
    `${label.padEnd(26)} median ${String(Math.round(median / 100) / 10).padStart(5)}s  p90 ${String(
      Math.round(p90 / 100) / 10,
    ).padStart(5)}s  A ${String(wins.a).padStart(3)}  B ${String(wins.b).padStart(3)}  draw ${wins.draw}`,
  );
}

console.log("Battle pacing sweep (AI vs AI, zero IVs, rarity 3)\n");

run("1v1 lvl 1", [make(1002, 1, 3, "a")], [make(1001, 1, 3, "b")], 100);
run("1v1 lvl 10", [make(1002, 10, 3, "a")], [make(1001, 10, 3, "b")], 100);
run("1v1 lvl 30", [make(1002, 30, 3, "a")], [make(1001, 30, 3, "b")], 100);
run("1v1 lvl 50", [make(1002, 50, 3, "a")], [make(1001, 50, 3, "b")], 100);

run(
  "3v3 lvl 10",
  POOL.slice(0, 3).map((id) => make(id, 10, 3, `a-${id}`)),
  POOL.slice(3, 6).map((id) => make(id, 10, 3, `b-${id}`)),
  100,
);

run(
  "3v3 lvl 30",
  POOL.slice(0, 3).map((id) => make(id, 30, 3, `a-${id}`)),
  POOL.slice(3, 6).map((id) => make(id, 30, 3, `b-${id}`)),
  100,
);

run(
  "common vs legendary",
  [make(1002, 20, 1, "a")],
  [make(1002, 20, 5, "b")],
  100,
);

run(
  "water vs fire",
  [make(1002, 20, 3, "a")],
  [make(1001, 20, 3, "b")],
  100,
);

run(
  "tank vs tank",
  [make(1038, 40, 3, "a")],
  [make(1038, 40, 3, "b")],
  50,
);

console.log("\nMirror and symmetry checks\n");

const mirror = POOL.slice(0, 3).map((id) => make(id, 20, 3, `m-${id}`));
run(
  "mirror 3v3 (same both)",
  mirror.map((entry) => ({ ...entry, petId: `a-${entry.petId}` })),
  mirror.map((entry) => ({ ...entry, petId: `b-${entry.petId}` })),
  200,
);

run(
  "scorpion vs poring",
  [make(1001, 50, 3, "a")],
  [make(1002, 50, 3, "b")],
  200,
);

run(
  "poring vs scorpion",
  [make(1002, 50, 3, "a")],
  [make(1001, 50, 3, "b")],
  200,
);

run(
  "same species diff rarity",
  [make(1050, 20, 3, "a")],
  [make(1050, 20, 4, "b")],
  100,
);
