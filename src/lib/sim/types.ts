import type { CombatStats } from "@/lib/game/stats";
import type { ResolvedSkill } from "@/lib/game/skills";
import type { ElementId, Rarity, StatusKind } from "@/lib/game/types";

export type Side = "a" | "b";

export type CombatantInit = {
  petId: string;
  speciesId: number;
  name: string;
  nickname?: string;
  element: ElementId;
  elementLevel: number;
  level: number;
  rarity?: Rarity;
  stats: CombatStats;
  skills: ResolvedSkill[];
  /** carried-over HP for tower waves */
  hp?: number;
  /** first Ragnarok spawn map, used as the arena backdrop */
  spawnMap?: string;
  /** elite wave label, e.g. "Fierce · Tough" */
  affix?: string;
  /** carried into telemetry/replays; not used by the simulation */
  nature?: string;
  star?: number;
  evolutionStage?: number;
  mastery?: Record<number, number>;
};

export type BattleInput =
  | { t: number; kind: "skill"; index: number; side?: Side }
  | { t: number; kind: "swap"; index: number; side?: Side };

export type HitResult = { damage: number; crit: boolean };

export type BattleEvent =
  | { t: number; type: "start"; seed: string }
  | {
      t: number;
      type: "attack";
      side: Side;
      actor: number;
      target: number;
      damage: number;
      crit: boolean;
      element: ElementId;
      hpAfter: number;
      maxHp: number;
    }
  | {
      t: number;
      type: "cast";
      side: Side;
      actor: number;
      slot: number;
      skillId: number;
      name: string;
      iconId: number;
      castMs: number;
    }
  | {
      t: number;
      type: "castEnd";
      side: Side;
      actor: number;
      slot: number;
      interrupted: boolean;
    }
  | {
      t: number;
      type: "skill";
      side: Side;
      actor: number;
      slot: number;
      skillId: number;
      name: string;
      iconId: number;
      element: ElementId;
    }
  | {
      t: number;
      type: "damage";
      side: Side;
      targetSide: Side;
      target: number;
      skillId: number | null;
      hits: HitResult[];
      total: number;
      hpAfter: number;
      maxHp: number;
      element: ElementId;
    }
  | {
      t: number;
      type: "heal";
      side: Side;
      actor: number;
      amount: number;
      hpAfter: number;
      maxHp: number;
    }
  | {
      t: number;
      type: "status";
      side: Side;
      target: number;
      kind: StatusKind;
      magnitude: number;
      durationMs: number;
      skillId: number | null;
    }
  | {
      t: number;
      type: "poison";
      side: Side;
      target: number;
      damage: number;
      hpAfter: number;
      maxHp: number;
    }
  | { t: number; type: "faint"; side: Side; target: number }
  | { t: number; type: "swap"; side: Side; from: number; to: number }
  | {
      t: number;
      type: "end";
      winner: Side | "draw";
      reason: "wipe" | "timeout";
      durationMs: number;
    };

export type StatusSnapshot = {
  kind: StatusKind;
  remainingMs: number;
  magnitude: number;
};

export type FighterSnapshot = {
  petId: string;
  name: string;
  speciesId: number;
  index: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  atb: number;
  statuses: StatusSnapshot[];
  cooldowns: number[];
  casting: { slot: number; remainingMs: number; totalMs: number } | null;
};

export type SideSnapshot = {
  active: number;
  swapCooldownMs: number;
  fighters: FighterSnapshot[];
};

export type BattleResult = {
  winner: Side | "draw";
  reason: "wipe" | "timeout";
  durationMs: number;
  sides: { a: SideSnapshot; b: SideSnapshot };
  checksum: string;
};

export type BattleConfig = {
  seed: string;
  teamA: CombatantInit[];
  teamB: CombatantInit[];
  maxMs?: number;
  /** which sides use skill AI; manual sides rely on recorded inputs */
  ai?: { a: boolean; b: boolean };
  /** preloaded input log, used by the server replay */
  inputs?: BattleInput[];
};
