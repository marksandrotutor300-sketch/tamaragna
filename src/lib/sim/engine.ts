import type { StatusKind } from "@/lib/game/types";
import { Rng } from "@/lib/rng";
import { chooseAiAction, type AiView } from "./ai";
import { checksum } from "./checksum";
import {
  effectiveAspdMs,
  rollBasicDamage,
  rollDamage,
  sumStatus,
  MAX_SHIELD,
} from "./damage";
import type {
  BattleConfig,
  BattleEvent,
  BattleInput,
  BattleResult,
  CombatantInit,
  FighterSnapshot,
  Side,
  SideSnapshot,
  StatusSnapshot,
} from "./types";

export const TICK_MS = 50;
export const MAX_DURATION_MS = 180_000;
export const SWAP_COOLDOWN_MS = 6_000;
export const GLOBAL_SKILL_LOCK_MS = 800;
const AI_INTERVAL_MS = 350;
const POISON_TICK_MS = 1_000;
const MAX_STATUSES = 6;

const SIDES: Side[] = ["a", "b"];
const other = (side: Side): Side => (side === "a" ? "b" : "a");

type StatusInstance = { kind: StatusKind; remainingMs: number; magnitude: number };

type Fighter = {
  init: CombatantInit;
  hp: number;
  atb: number;
  cooldowns: number[];
  statuses: StatusInstance[];
  cast: { slot: number; remainingMs: number; totalMs: number } | null;
  poisonAccumMs: number;
  alive: boolean;
};

type PendingAction =
  | { kind: "skill"; slot: number }
  | { kind: "swap"; index: number }
  | null;

type SideState = {
  fighters: Fighter[];
  active: number;
  swapCooldownMs: number;
  skillLockMs: number;
  pending: PendingAction;
  nextAiAt: number;
  ai: boolean;
};

function createFighter(init: CombatantInit): Fighter {
  if (init.skills.length !== 4) {
    throw new Error(`${init.name} must have exactly 4 skills`);
  }
  const hp = Math.max(0, Math.min(init.stats.hpMax, init.hp ?? init.stats.hpMax));
  return {
    init,
    hp,
    atb: 0,
    cooldowns: [0, 0, 0, 0],
    statuses: [],
    cast: null,
    poisonAccumMs: 0,
    alive: hp > 0,
  };
}

function createSide(team: CombatantInit[], ai: boolean): SideState {
  if (team.length === 0) throw new Error("A battle team cannot be empty");
  return {
    fighters: team.map(createFighter),
    active: Math.max(
      0,
      team.findIndex((init) => (init.hp ?? init.stats.hpMax) > 0),
    ),
    swapCooldownMs: 0,
    skillLockMs: 0,
    pending: null,
    nextAiAt: 900,
    ai,
  };
}

function isStunned(fighter: Fighter): boolean {
  return fighter.statuses.some((status) => status.kind === "stun");
}

export class BattleEngine {
  readonly seed: string;

  private readonly rng: Rng;
  private readonly maxMs: number;
  private readonly sides: Record<Side, SideState>;
  private readonly performance: Record<Side, number>;
  private readonly inputsByTick = new Map<number, BattleInput[]>();
  private readonly recorded: BattleInput[] = [];
  private readonly recordInputs: boolean;

  private pendingMs = 0;
  private timeMs = 0;
  private startEmitted = false;
  private ended = false;
  private outcome: BattleResult | null = null;

  constructor(config: BattleConfig) {
    this.seed = config.seed;
    this.rng = new Rng(config.seed);
    this.maxMs = config.maxMs ?? MAX_DURATION_MS;
    this.sides = {
      a: createSide(config.teamA, config.ai?.a ?? true),
      b: createSide(config.teamB, config.ai?.b ?? true),
    };

    // A small seeded luck swing per side. Without it, any consistent stat edge
    // wins every deterministic fight; this keeps upsets possible.
    this.performance = {
      a: 0.92 + this.rng.next() * 0.16,
      b: 0.92 + this.rng.next() * 0.16,
    };

    this.recordInputs = !config.inputs;
    if (config.inputs) {
      for (const input of config.inputs) this.scheduleInput(input);
    }
  }

  get finished(): boolean {
    return this.ended;
  }

  get currentTime(): number {
    return this.timeMs;
  }

  get result(): BattleResult | null {
    return this.outcome;
  }

  get inputLog(): BattleInput[] {
    return this.recorded;
  }

  /** Queue a skill for side A. Recorded for server verification. */
  pressSkill(index: number): void {
    this.queueInput({ t: this.timeMs, kind: "skill", index });
  }

  /** Queue a swap for side A. */
  swap(index: number): void {
    this.queueInput({ t: this.timeMs, kind: "swap", index });
  }

  /** Live matches control both sides; side A still records for replay. */
  pressSkillFor(side: Side, index: number): void {
    if (this.ended) return;
    if (index < 0 || index > 3) return;
    this.sides[side].pending = { kind: "skill", slot: index };
  }

  swapFor(side: Side, index: number): void {
    if (this.ended) return;
    if (index < 0 || index > 2) return;
    this.sides[side].pending = { kind: "swap", index };
  }

  private queueInput(input: BattleInput): void {
    if (this.ended) return;
    if (input.kind === "skill" && (input.index < 0 || input.index > 3)) return;
    if (input.kind === "swap" && (input.index < 0 || input.index > 2)) return;
    if (this.recordInputs) this.recorded.push(input);
    this.applyInputFor("a", input);
  }

  private applyInputFor(side: Side, input: BattleInput): void {
    if (input.kind === "skill") {
      this.sides[side].pending = { kind: "skill", slot: input.index };
    } else {
      this.sides[side].pending = { kind: "swap", index: input.index };
    }
  }

  private scheduleInput(input: BattleInput): void {
    const tick = Math.max(0, Math.round(input.t / TICK_MS) * TICK_MS);
    const list = this.inputsByTick.get(tick) ?? [];
    list.push({ ...input, t: tick });
    this.inputsByTick.set(tick, list);
  }

  step(deltaMs: number): BattleEvent[] {
    const events: BattleEvent[] = [];
    if (!this.startEmitted) {
      this.startEmitted = true;
      events.push({ t: 0, type: "start", seed: this.seed });
    }

    this.pendingMs += Math.max(0, deltaMs);
    while (this.pendingMs >= TICK_MS && !this.ended) {
      this.pendingMs -= TICK_MS;
      this.runTick(events);
    }

    return events;
  }

  private runTick(events: BattleEvent[]): void {
    const t = this.timeMs;
    if (this.ended) return;

    const scheduled = this.inputsByTick.get(t);
    if (scheduled) {
      for (const input of scheduled) {
        this.applyInputFor(input.side ?? "a", input);
      }
    }

    for (const side of SIDES) this.tickSide(side, events, t);
    for (const side of SIDES) this.resolvePending(side, events, t);
    for (const side of SIDES) this.maybeAct(side, events, t);
    for (const side of SIDES) this.tickAtb(side, events, t);

    this.timeMs += TICK_MS;

    if (!this.ended && this.timeMs >= this.maxMs) {
      const scoreA = this.hpFraction("a");
      const scoreB = this.hpFraction("b");
      const winner: Side | "draw" = scoreA > scoreB ? "a" : scoreB > scoreA ? "b" : "draw";
      this.finish(winner, "timeout", events, this.timeMs);
    }
  }

  // ---------------------------------------------------------------- per tick

  private tickSide(side: Side, events: BattleEvent[], t: number): void {
    const state = this.sides[side];
    state.swapCooldownMs = Math.max(0, state.swapCooldownMs - TICK_MS);
    state.skillLockMs = Math.max(0, state.skillLockMs - TICK_MS);

    for (const fighter of state.fighters) {
      for (let i = 0; i < fighter.cooldowns.length; i += 1) {
        fighter.cooldowns[i] = Math.max(0, fighter.cooldowns[i] - TICK_MS);
      }
    }

    const active = state.fighters[state.active];
    if (!active || !active.alive) return;

    for (const status of active.statuses) status.remainingMs -= TICK_MS;
    active.statuses = active.statuses.filter((status) => status.remainingMs > 0);

    const poison = active.statuses.find((status) => status.kind === "poison");
    if (poison) {
      active.poisonAccumMs += TICK_MS;
      while (active.poisonAccumMs >= POISON_TICK_MS) {
        active.poisonAccumMs -= POISON_TICK_MS;
        const damage = Math.max(1, Math.floor(active.init.stats.hpMax * poison.magnitude));
        const { applied, died } = this.applyHpLoss(side, state.active, damage);
        events.push({
          t,
          type: "poison",
          side,
          target: state.active,
          damage: applied,
          hpAfter: active.hp,
          maxHp: active.init.stats.hpMax,
        });
        if (died) {
          this.handleDeath(side, state.active, events, t);
          break;
        }
      }
    }

    const current = state.fighters[state.active];
    if (!current || !current.alive) return;

    if (current.cast) {
      current.cast.remainingMs -= TICK_MS;
      if (current.cast.remainingMs <= 0) {
        const slot = current.cast.slot;
        current.cast = null;
        this.executeSkill(side, slot, events, t);
      }
    }
  }

  private resolvePending(side: Side, events: BattleEvent[], t: number): void {
    const state = this.sides[side];
    if (!state.pending || this.ended) return;

    const active = state.fighters[state.active];
    if (!active || !active.alive || active.cast || isStunned(active)) return;
    if (state.skillLockMs > 0) return;

    if (state.pending.kind === "swap") {
      if (state.swapCooldownMs > 0) return;
      const target = state.pending.index;
      state.pending = null;
      this.performSwap(side, target, events, t, false);
      return;
    }

    const slot = state.pending.slot;
    if (active.cooldowns[slot] > 0) return;
    state.pending = null;
    this.beginSkill(side, slot, events, t);
  }

  private maybeAct(side: Side, events: BattleEvent[], t: number): void {
    const state = this.sides[side];
    if (!state.ai || this.ended) return;
    if (t < state.nextAiAt) return;

    const active = state.fighters[state.active];
    if (!active || !active.alive || active.cast || isStunned(active)) return;

    state.nextAiAt = t + AI_INTERVAL_MS;
    const action = chooseAiAction(this.aiView(side), this.aiView(other(side)));
    if (!action) return;

    if (action.kind === "swap") {
      if (state.swapCooldownMs > 0) return;
      this.performSwap(side, action.index, events, t, false);
      return;
    }

    if (state.skillLockMs > 0 || active.cooldowns[action.slot] > 0) return;
    this.beginSkill(side, action.slot, events, t);
  }

  private tickAtb(side: Side, events: BattleEvent[], t: number): void {
    const state = this.sides[side];
    const active = state.fighters[state.active];
    if (!active || !active.alive || active.cast || isStunned(active)) return;

    const aspd = effectiveAspdMs(active.init, active.statuses);
    active.atb += TICK_MS / aspd;
    if (active.atb < 1) return;

    active.atb = 0;
    const targetSide = other(side);
    const targetState = this.sides[targetSide];
    const targetIndex = targetState.active;
    const target = targetState.fighters[targetIndex];
    if (!target || !target.alive) return;

    const { damage, crit } = rollBasicDamage(
      this.rng,
      active.init,
      active.statuses,
      target.init,
      target.statuses,
      this.performance[side],
    );
    const { applied, died } = this.applyHpLoss(targetSide, targetIndex, damage);

    events.push({
      t,
      type: "attack",
      side,
      actor: state.active,
      target: targetIndex,
      damage: applied,
      crit,
      element: active.init.element,
      hpAfter: target.hp,
      maxHp: target.init.stats.hpMax,
    });

    if (died) this.handleDeath(targetSide, targetIndex, events, t);
  }

  // ----------------------------------------------------------------- actions

  private beginSkill(side: Side, slot: number, events: BattleEvent[], t: number): void {
    const state = this.sides[side];
    const active = state.fighters[state.active];
    if (!active || !active.alive) return;

    const skill = active.init.skills[slot];
    if (!skill) return;

    active.cooldowns[slot] = skill.cooldownMs;

    if (skill.castMs > 0) {
      active.cast = { slot, remainingMs: skill.castMs, totalMs: skill.castMs };
      events.push({
        t,
        type: "cast",
        side,
        actor: state.active,
        slot,
        skillId: skill.id,
        name: skill.displayName,
        iconId: skill.iconId,
        castMs: skill.castMs,
      });
      return;
    }

    this.executeSkill(side, slot, events, t);
  }

  private executeSkill(side: Side, slot: number, events: BattleEvent[], t: number): void {
    const state = this.sides[side];
    const actorIndex = state.active;
    const active = state.fighters[actorIndex];
    if (!active || !active.alive) return;

    const skill = active.init.skills[slot];
    if (!skill) return;

    state.skillLockMs = GLOBAL_SKILL_LOCK_MS;
    events.push({
      t,
      type: "skill",
      side,
      actor: actorIndex,
      slot,
      skillId: skill.id,
      name: skill.displayName,
      iconId: skill.iconId,
      element: skill.element,
    });

    if (skill.kind === "heal") {
      const basis =
        skill.healBasis === "maxHp" ? active.init.stats.hpMax : active.init.stats.matk;
      const amount = Math.max(1, Math.floor((basis * skill.power) / 100));
      const before = active.hp;
      active.hp = Math.min(active.init.stats.hpMax, active.hp + amount);
      events.push({
        t,
        type: "heal",
        side,
        actor: actorIndex,
        amount: active.hp - before,
        hpAfter: active.hp,
        maxHp: active.init.stats.hpMax,
      });
      return;
    }

    if (skill.target === "self") {
      if (skill.status) {
        this.applyStatus(side, actorIndex, skill.status, skill.id, events, t);
      }
      return;
    }

    const targetSide = other(side);
    const targetState = this.sides[targetSide];
    const targets =
      skill.target === "allEnemies"
        ? targetState.fighters
            .map((fighter, index) => ({ fighter, index }))
            .filter((entry) => entry.fighter.alive)
        : [{ fighter: targetState.fighters[targetState.active], index: targetState.active }].filter(
            (entry) => entry.fighter?.alive,
          );

    for (const entry of targets) {
      if (this.ended) return;

      const { hits, total } = rollDamage({
        rng: this.rng,
        attacker: active.init,
        attackerStatuses: active.statuses,
        defender: entry.fighter.init,
        defenderStatuses: entry.fighter.statuses,
        element: skill.element,
        power: skill.power,
        hits: skill.hits,
        magical: skill.kind === "magical",
        performance: this.performance[side],
      });

      const { applied, died } = this.applyHpLoss(targetSide, entry.index, total);

      events.push({
        t,
        type: "damage",
        side,
        targetSide,
        target: entry.index,
        skillId: skill.id,
        hits,
        total: applied,
        hpAfter: entry.fighter.hp,
        maxHp: entry.fighter.init.stats.hpMax,
        element: skill.element,
      });

      if (died) {
        this.handleDeath(targetSide, entry.index, events, t);
      }

      if (skill.status && entry.fighter.alive) {
        const resist = entry.fighter.init.stats.statusResist ?? 0;
        if (this.rng.next() < skill.status.chance * (1 - resist)) {
          this.applyStatus(targetSide, entry.index, skill.status, skill.id, events, t);
        }
      }
    }
  }

  private performSwap(
    side: Side,
    index: number,
    events: BattleEvent[],
    t: number,
    forced: boolean,
  ): void {
    const state = this.sides[side];
    if (index === state.active && !forced) return;

    const target = state.fighters[index];
    if (!target || !target.alive) return;
    if (!forced && state.swapCooldownMs > 0) return;

    const from = state.active;
    state.active = index;
    state.swapCooldownMs = SWAP_COOLDOWN_MS;
    state.pending = null;
    target.atb = 0;
    target.cast = null;
    target.poisonAccumMs = 0;

    events.push({ t, type: "swap", side, from, to: index });
  }

  private applyStatus(
    side: Side,
    index: number,
    effect: { kind: StatusKind; chance: number; durationMs: number; magnitude: number },
    skillId: number | null,
    events: BattleEvent[],
    t: number,
  ): void {
    const fighter = this.sides[side].fighters[index];
    if (!fighter || !fighter.alive) return;

    const existing = fighter.statuses.find((status) => status.kind === effect.kind);
    if (existing) {
      existing.remainingMs = Math.max(existing.remainingMs, effect.durationMs);
      existing.magnitude = Math.max(existing.magnitude, effect.magnitude);
    } else {
      if (fighter.statuses.length >= MAX_STATUSES) fighter.statuses.shift();
      fighter.statuses.push({
        kind: effect.kind,
        remainingMs: effect.durationMs,
        magnitude: effect.kind === "shield" ? Math.min(MAX_SHIELD, effect.magnitude) : effect.magnitude,
      });
    }

    if (effect.kind === "stun" && fighter.cast) {
      events.push({
        t,
        type: "castEnd",
        side,
        actor: index,
        slot: fighter.cast.slot,
        interrupted: true,
      });
      fighter.cast = null;
    }

    events.push({
      t,
      type: "status",
      side,
      target: index,
      kind: effect.kind,
      magnitude: effect.magnitude,
      durationMs: effect.durationMs,
      skillId,
    });
  }

  // ----------------------------------------------------------------- outcomes

  private applyHpLoss(
    side: Side,
    index: number,
    amount: number,
  ): { applied: number; died: boolean } {
    const fighter = this.sides[side].fighters[index];
    if (!fighter || !fighter.alive) return { applied: 0, died: false };

    const applied = Math.min(fighter.hp, Math.max(0, Math.floor(amount)));
    fighter.hp -= applied;

    if (fighter.hp <= 0) {
      fighter.hp = 0;
      fighter.alive = false;
      fighter.cast = null;
      fighter.statuses = [];
      return { applied, died: true };
    }

    return { applied, died: false };
  }

  private handleDeath(side: Side, index: number, events: BattleEvent[], t: number): void {
    events.push({ t, type: "faint", side, target: index });

    const state = this.sides[side];
    const anyAlive = state.fighters.some((fighter) => fighter.alive);
    if (!anyAlive) {
      this.finish(other(side), "wipe", events, t);
      return;
    }

    if (state.active === index) {
      const next = state.fighters.findIndex((fighter) => fighter.alive);
      if (next >= 0) {
        this.performSwap(side, next, events, t, true);
      }
    }
  }

  private hpFraction(side: Side): number {
    const state = this.sides[side];
    let current = 0;
    let max = 0;
    for (const fighter of state.fighters) {
      current += fighter.hp;
      max += fighter.init.stats.hpMax;
    }
    return max > 0 ? current / max : 0;
  }

  private finish(
    winner: Side | "draw",
    reason: "wipe" | "timeout",
    events: BattleEvent[],
    t: number,
  ): void {
    if (this.ended) return;
    this.ended = true;

    events.push({ t, type: "end", winner, reason, durationMs: t });

    const sides = { a: this.snapshotSide("a"), b: this.snapshotSide("b") };
    const canonicalInputs = (
      this.recorded.length > 0 ? this.recorded : this.flattenInputs()
    ).map((input) => ({
      t: input.t,
      kind: input.kind,
      index: input.index,
      side: input.side ?? "a",
    }));
    const canonical = [
      this.seed,
      JSON.stringify(canonicalInputs),
      JSON.stringify(sides.a),
      JSON.stringify(sides.b),
      winner,
      reason,
      String(t),
    ].join("|");

    this.outcome = {
      winner,
      reason,
      durationMs: t,
      sides,
      checksum: checksum(canonical),
    };
  }

  private flattenInputs(): BattleInput[] {
    const all: BattleInput[] = [];
    for (const [tick, list] of [...this.inputsByTick.entries()].sort((a, b) => a[0] - b[0])) {
      for (const input of list) all.push({ ...input, t: tick });
    }
    return all;
  }

  private snapshotSide(side: Side): SideSnapshot {
    const state = this.sides[side];
    const fighters: FighterSnapshot[] = state.fighters.map((fighter, index) => ({
      petId: fighter.init.petId,
      name: fighter.init.name,
      speciesId: fighter.init.speciesId,
      index,
      hp: fighter.hp,
      maxHp: fighter.init.stats.hpMax,
      alive: fighter.alive,
      atb: Number(fighter.atb.toFixed(4)),
      statuses: fighter.statuses.map(
        (status): StatusSnapshot => ({
          kind: status.kind,
          remainingMs: Math.round(status.remainingMs),
          magnitude: status.magnitude,
        }),
      ),
      cooldowns: fighter.cooldowns.map((value) => Math.round(value)),
      casting: fighter.cast
        ? {
            slot: fighter.cast.slot,
            remainingMs: Math.round(fighter.cast.remainingMs),
            totalMs: fighter.cast.totalMs,
          }
        : null,
    }));

    return {
      active: state.active,
      swapCooldownMs: Math.round(state.swapCooldownMs),
      fighters,
    };
  }

  private aiView(side: Side): AiView {
    const state = this.sides[side];
    return {
      active: state.active,
      swapCooldownMs: state.swapCooldownMs,
      skillLockMs: state.skillLockMs,
      fighters: state.fighters.map((fighter) => ({
        init: fighter.init,
        hp: fighter.hp,
        maxHp: fighter.init.stats.hpMax,
        alive: fighter.alive,
        cooldowns: fighter.cooldowns,
        statuses: fighter.statuses,
        casting: fighter.cast !== null,
      })),
    };
  }

  /** Live snapshot for the UI, without ending the battle. */
  snapshot(): { a: SideSnapshot; b: SideSnapshot } {
    return { a: this.snapshotSide("a"), b: this.snapshotSide("b") };
  }

  /** Remaining shield strength, exported for the HUD. */
  shieldOf(side: Side): number {
    const state = this.sides[side];
    const active = state.fighters[state.active];
    return active ? Math.min(MAX_SHIELD, sumStatus(active.statuses, ["shield"])) : 0;
  }
}
