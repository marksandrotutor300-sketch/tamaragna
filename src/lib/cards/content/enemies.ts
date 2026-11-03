import { Rng } from "@/lib/rng";
import { zeroIvs, buildWildCombatant } from "@/lib/game/combatant";
import { ALL_SPECIES } from "@/lib/game/species";
import type { ElementId, Rarity } from "@/lib/game/types";
import type { CardEnemy, EnemyMove } from "../types";

type EncounterKind = "normal" | "elite" | "boss";

const ENCOUNTERS = [
  "Moss Patrol",
  "Thorn Ambush",
  "River Skirmish",
  "Gale Hunt",
  "Ember Pack",
  "Ash Watch",
  "Cinder Patrol",
  "Smoke Veil",
  "Void Echo",
  "Astral Choir",
  "Grave Procession",
  "Prism Hunt",
] as const;

const BOSSES = [
  { name: "Rootbound Colossus", element: 2 satisfies ElementId, level: 16 },
  { name: "Cinder Regent", element: 3 satisfies ElementId, level: 30 },
  { name: "Null Archon", element: 7 satisfies ElementId, level: 44 },
] as const;

function scaledLevel(act: number, kind: EncounterKind, floor: number): number {
  const base = 5 + (act - 1) * 13 + Math.floor(floor / 2);
  return Math.min(80, base + (kind === "elite" ? 4 : kind === "boss" ? 10 : 0));
}

function movesFor(act: number, kind: EncounterKind, element: ElementId): EnemyMove[] {
  const heavy = 120 + act * 15 + (kind === "boss" ? 55 : kind === "elite" ? 20 : 0);
  const multi = 50 + act * 8 + (kind === "boss" ? 15 : 0);
  const block = 6 + act * 4 + (kind === "boss" ? 12 : 0);
  const pool: EnemyMove[] = [
    { kind: "attack", power: 80 + act * 10 },
    { kind: "attack", power: heavy },
    { kind: "block", amount: block },
    { kind: "attack", power: multi, hits: 2 },
  ];

  if (element === 5 || element === 6) {
    pool.push({ kind: "debuff", status: "poison", stacks: 2 + act, target: "champion" });
  }
  if (element === 3 || element === 7) {
    pool.push({ kind: "debuff", status: "vulnerable", stacks: 2, target: "champion" });
  }
  if (element === 4 || element === 8) {
    pool.push({ kind: "debuff", status: "weak", stacks: 2, target: "champion" });
  }
  if (kind !== "normal") {
    pool.push({ kind: "buff", status: "atkUp", stacks: 2 });
    pool.push({ kind: "block", amount: Math.round(block * 1.4) });
  }
  if (kind === "boss") {
    pool.push({ kind: "attack", power: heavy + 30, hits: 2 });
    pool.push({ kind: "debuff", status: "frail", stacks: 2, target: "allChampions" });
  }
  return pool;
}

function chooseSpecies(act: number, kind: EncounterKind, rng: Rng) {
  const all = ALL_SPECIES.filter((species) => species.playable);
  if (kind === "boss") {
    const mvps = all.filter((species) => species.mvp);
    return rng.pick(mvps.length ? mvps : all);
  }
  const actSpecies = all.filter((species) => {
    if (act === 1) return [1, 2, 4].includes(species.element);
    if (act === 2) return [3, 4, 5].includes(species.element);
    return [5, 6, 7, 8, 9].includes(species.element);
  });
  return rng.pick(actSpecies.length ? actSpecies : all);
}

export function buildEncounter(
  seed: string,
  act: number,
  kind: EncounterKind,
  floor: number,
  mods: { hpMultiplier?: number; damageMultiplier?: number } = {},
): CardEnemy[] {
  const hpMultiplier = mods.hpMultiplier ?? 1;
  const damageMultiplier = mods.damageMultiplier ?? 1;
  const rng = new Rng(`encounter:${seed}:${act}:${kind}:${floor}`);
  const boss = kind === "boss" ? BOSSES[act - 1] ?? BOSSES[2] : null;
  const count = kind === "boss" ? 1 : kind === "elite" ? rng.int(1, 2) : rng.int(1, 2);
  const level = boss?.level ?? scaledLevel(act, kind, floor);
  const rarity = Math.min(5, 1 + act) as Rarity;
  const enemies: CardEnemy[] = [];

  for (let index = 0; index < count; index += 1) {
    const species = chooseSpecies(act, kind, rng);
    const element = boss?.element ?? species.element;
    const combatant = buildWildCombatant({
      petId: `card-enemy-${act}-${kind}-${floor}-${index}`,
      species,
      level,
      rarity,
      rng,
      statMultiplier: 1 + 0.12 * (act - 1) + (kind === "elite" ? 0.1 : 0),
      hpMultiplier: (1 + 0.2 * (act - 1) + (kind === "elite" ? 0.2 : 0)) * hpMultiplier,
      nature: "hardy",
      ivs: zeroIvs(),
    });
    const name =
      boss && index === 0
        ? boss.name
        : kind === "elite"
          ? `Elite ${species.name}`
          : index === 0
            ? ENCOUNTERS[((act - 1) * 4 + (floor % 4)) % ENCOUNTERS.length]
            : species.name;

    const moves = movesFor(act, kind, element).map((move) =>
      move.kind === "attack"
        ? { ...move, power: Math.round(move.power * damageMultiplier) }
        : move,
    );
    enemies.push({
      id: `e${index + 1}`,
      name,
      speciesId: species.id,
      element,
      elementLevel: species.elementLevel,
      stats: {
        atk: combatant.stats.atk,
        matk: combatant.stats.matk,
        def: combatant.stats.def,
        mdef: combatant.stats.mdef,
      },
      maxHp: combatant.stats.hpMax,
      hp: combatant.stats.hpMax,
      block: 0,
      statuses: [],
      moves,
      intent: moves[0],
    });
  }

  return enemies;
}
