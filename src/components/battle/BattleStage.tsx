"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Crown,
  FastForward,
  Pause,
  Play,
  Swords,
  Trophy,
} from "lucide-react";
import { Bar, Button } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { ShareReplayButton } from "@/components/battle/ShareReplayButton";
import { useBattleRunner } from "@/hooks/useBattleRunner";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { elementColor, elementName } from "@/lib/game/elements";
import type { BattleEvent, BattleInput, CombatantInit, Side } from "@/lib/sim/types";

type Payload = {
  teamA: CombatantInit[];
  teamB: CombatantInit[];
  ai: { a: boolean; b: boolean };
  maxMs?: number;
  wave?: number;
};

type Popup = {
  id: string;
  side: Side;
  value: string;
  tone: "damage" | "crit" | "heal" | "status";
  offset: number;
  top: number;
  createdAt: number;
};

type Submission =
  | { state: "idle" }
  | { state: "pending" }
  | {
      state: "done";
      survived: boolean;
      rewards: { coins: number; exp: number; eggs: number };
      levelUps: Array<{ petId: string; level: number }>;
    }
  | { state: "error"; message: string };

const STATUS_COLORS: Record<string, string> = {
  poison: "#a45bd0",
  stun: "#ffc94a",
  slow: "#4aa3ff",
  atkUp: "#ff7a7a",
  defUp: "#4aa3ff",
  shield: "#3ad7c0",
  haste: "#8fe36b",
  defDown: "#ff9f43",
};

export function BattleStage({
  battleId,
  seed,
  payload,
  mode,
  boss,
  runId,
  inputs,
  readOnly = false,
}: {
  battleId: string;
  seed: string;
  payload: Payload;
  mode: string;
  boss?: boolean;
  runId?: string;
  inputs?: BattleInput[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const runner = useBattleRunner({
    seed,
    teamA: payload.teamA,
    teamB: payload.teamB,
    ai: payload.ai,
    maxMs: payload.maxMs,
    inputs,
  });

  const [actions, setActions] = useState<Record<string, { action: "attack" | "hurt"; until: number }>>({});
  const [popups, setPopups] = useState<Popup[]>([]);
  const [submission, setSubmission] = useState<Submission>({ state: "idle" });
  const [showOverlay, setShowOverlay] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const submitted = useRef(false);

  const snapshot = runner.snapshot;

  const petIdAt = useCallback(
    (side: Side, index: number) =>
      (side === "a" ? payload.teamA : payload.teamB)[index]?.petId ?? "",
    [payload],
  );

  const nameAt = useCallback(
    (side: Side, index: number) =>
      (side === "a" ? payload.teamA : payload.teamB)[index]?.name ?? "?",
    [payload],
  );

  // Translate simulation events into sprite animations and floating numbers.
  useEffect(() => {
    if (runner.lastBatch.length === 0) return;
    const now = Date.now();
    const nextActions: Record<string, { action: "attack" | "hurt"; until: number }> = {};
    const nextPopups: Popup[] = [];

    const addPopup = (
      side: Side,
      value: string,
      tone: Popup["tone"],
      offset = 0,
    ) => {
      nextPopups.push({
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        side,
        value,
        tone,
        offset,
        top: 30 + Math.random() * 20,
        createdAt: now,
      });
    };

    for (const event of runner.lastBatch) {
      switch (event.type) {
        case "attack": {
          const attacker = petIdAt(event.side, event.actor);
          const targetSide: Side = event.side === "a" ? "b" : "a";
          const target = petIdAt(targetSide, event.target);
          if (attacker) nextActions[attacker] = { action: "attack", until: now + 420 };
          if (target) nextActions[target] = { action: "hurt", until: now + 360 };
          addPopup(targetSide, `-${event.damage}`, event.crit ? "crit" : "damage");
          break;
        }
        case "skill": {
          const actor = petIdAt(event.side, event.actor);
          if (actor) nextActions[actor] = { action: "attack", until: now + 520 };
          break;
        }
        case "damage": {
          const target = petIdAt(event.targetSide, event.target);
          if (target) nextActions[target] = { action: "hurt", until: now + 380 };
          addPopup(event.targetSide, `-${event.total}`, "damage");
          break;
        }
        case "heal": {
          const actor = petIdAt(event.side, event.actor);
          if (actor) nextActions[actor] = { action: "attack", until: now + 300 };
          addPopup(event.side, `+${event.amount}`, "heal");
          break;
        }
        case "status": {
          addPopup(event.side, event.kind, "status", 18);
          break;
        }
        case "poison": {
          const target = petIdAt(event.side, event.target);
          if (target) nextActions[target] = { action: "hurt", until: now + 260 };
          addPopup(event.side, `-${event.damage}`, "status");
          break;
        }
        default:
          break;
      }
    }

    if (Object.keys(nextActions).length > 0) {
      setActions((previous) => ({ ...previous, ...nextActions }));
    }
    if (nextPopups.length > 0) {
      setPopups((previous) =>
        [...previous, ...nextPopups].filter((popup) => now - popup.createdAt < 1200).slice(-18),
      );
    }
  }, [runner.lastBatch, petIdAt]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPopups((previous) => previous.filter((popup) => Date.now() - popup.createdAt < 1200));
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

  const submit = useCallback(async () => {
    if (!runner.result || submitted.current) return;
    submitted.current = true;
    setSubmission({ state: "pending" });

    try {
      const response = await api.post<{
        survived: boolean;
        rewards: { coins: number; exp: number; eggs: number };
        levelUps: Array<{ petId: string; level: number }>;
      }>(`/api/battle/${battleId}/submit`, {
        inputLog: runner.getInputLog(),
        resultHash: runner.result.checksum,
      });
      setSubmission({
        state: "done",
        survived: response.survived,
        rewards: response.rewards,
        levelUps: response.levelUps,
      });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      submitted.current = false;
      setSubmission({
        state: "error",
        message: error instanceof Error ? error.message : "Could not submit the battle",
      });
    }
  }, [battleId, queryClient, runner]);

  useEffect(() => {
    if (!runner.finished || readOnly) return;
    void submit();
    const timer = window.setTimeout(() => setShowOverlay(true), 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner.finished, readOnly]);

  const nextWave = () => {
    if (!runId) return;
    setNavigating(true);
    router.push("/tower");
  };

  if (!snapshot) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <span className="animate-pulse">Preparing the arena…</span>
      </div>
    );
  }

  const playerActive = snapshot.a.fighters[snapshot.a.active];
  const enemyActive = snapshot.b.fighters[snapshot.b.active];
  const playerInit = payload.teamA[snapshot.a.active];
  const enemyInit = payload.teamB[snapshot.b.active];
  const map = payload.teamB[0]?.spawnMap;

  const animationFor = (petId: string, alive: boolean) => {
    if (!alive) return "dead" as const;
    const entry = actions[petId];
    if (entry && entry.until > Date.now()) return entry.action;
    return "idle" as const;
  };

  const totalHp = (side: "a" | "b") =>
    snapshot[side].fighters.reduce((sum, fighter) => sum + fighter.hp, 0);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-line/70 bg-panel/70 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-muted">
            {mode === "tower"
              ? `Wave ${payload.wave ?? 1}`
              : mode === "pvp"
                ? "Duel"
                : mode === "replay"
                  ? "Replay"
                  : "Practice"}
          </div>
          {readOnly && runner.finished ? (
            <div className="rounded-lg border border-teal/40 bg-teal/10 px-2 py-1 text-[10px] text-teal">
              replay complete
            </div>
          ) : null}
          {boss ? (
            <div className="flex items-center gap-1 rounded-lg border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] text-gold">
              <Crown className="h-3 w-3" /> MVP
            </div>
          ) : null}
          {!payload.ai.a ? (
            <div className="rounded-lg border border-violet/40 bg-violet/10 px-2 py-1 text-[10px] text-violet">
              manual
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => runner.setSpeed(runner.speed === 1 ? 2 : 1)}
            className="flex items-center gap-1 rounded-lg border border-line/70 bg-panel/70 px-2 py-1 text-[11px] text-muted hover:text-ink"
          >
            <FastForward className="h-3 w-3" /> {runner.speed}x
          </button>
          <button
            onClick={() => runner.setPaused(!runner.paused)}
            className="rounded-lg border border-line/70 bg-panel/70 p-1.5 text-muted hover:text-ink"
            aria-label={runner.paused ? "Resume" : "Pause"}
          >
            {runner.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden rounded-2xl border border-line/60 bg-black/30">
        {map ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(/api/map/${map})` }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/80" />

        {/* enemy */}
        <div className="absolute inset-x-0 top-0 flex flex-col items-end px-4 pt-4">
          <CombatantHeader
            name={enemyInit?.name ?? "Enemy"}
            level={enemyActive?.speciesId ? enemyInit?.level ?? 1 : 1}
            element={enemyInit?.element ?? 0}
            hp={enemyActive?.hp ?? 0}
            maxHp={enemyActive?.maxHp ?? 1}
            atb={enemyActive?.atb ?? 0}
            statuses={enemyActive?.statuses ?? []}
            align="right"
            affix={enemyInit?.affix}
          />
          <div className="relative mt-2 flex h-44 w-44 items-end justify-center">
            {enemyActive ? (
              <PetSprite
                speciesId={enemyActive.speciesId}
                size={150}
                priority
                animation={animationFor(enemyActive.petId, enemyActive.alive)}
                action={spriteAction(animationFor(enemyActive.petId, enemyActive.alive))}
                style={{ "--lunge": "-30px" } as React.CSSProperties}
              />
            ) : null}
            <Popups popups={popups.filter((popup) => popup.side === "b")} />
          </div>
        </div>

        {/* player */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-start px-4 pb-3">
          <div className="relative flex h-44 w-44 items-end justify-center">
            {playerActive ? (
              <PetSprite
                speciesId={playerActive.speciesId}
                size={150}
                priority
                animation={animationFor(playerActive.petId, playerActive.alive)}
                action={spriteAction(animationFor(playerActive.petId, playerActive.alive))}
              />
            ) : null}
            <Popups popups={popups.filter((popup) => popup.side === "a")} />
          </div>
          <div className="mt-2 w-full">
            <CombatantHeader
              name={playerInit?.name ?? "You"}
              level={playerInit?.level ?? 1}
              element={playerInit?.element ?? 0}
              hp={playerActive?.hp ?? 0}
              maxHp={playerActive?.maxHp ?? 1}
              atb={playerActive?.atb ?? 0}
              statuses={playerActive?.statuses ?? []}
              align="left"
            />
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-muted/70">
            <Swords className="h-4 w-4" />
            {Math.round(runner.timeMs / 1000)}s
          </div>
        </div>

        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-6 text-[10px] text-muted">
          <span>{Math.round((totalHp("a") / Math.max(1, payload.teamA.reduce((sum, pet) => sum + pet.stats.hpMax, 0))) * 100)}% team</span>
          <span>
            {Math.round((totalHp("b") / Math.max(1, payload.teamB.reduce((sum, pet) => sum + pet.stats.hpMax, 0))) * 100)}% team
          </span>
        </div>
      </div>

      {/* bench */}
      <div className="mt-3 grid grid-cols-3 gap-2 px-1">
        {Array.from({ length: 3 }).map((_, index) => {
          const pet = payload.teamA[index];
          const fighter = snapshot.a.fighters[index];
          if (!pet) {
            return (
              <div
                key={`empty-${index}`}
                className="rounded-xl border border-dashed border-line/40 bg-black/10 px-2 py-1.5"
                aria-hidden
              />
            );
          }

          const active = snapshot.a.active === index;
          const canSwap =
            !readOnly &&
            !active &&
            fighter?.alive &&
            snapshot.a.swapCooldownMs === 0 &&
            !runner.finished;
          return (
            <button
              key={pet.petId}
              onClick={() => canSwap && runner.swap(index)}
              disabled={!canSwap}
              className={cn(
                "relative flex items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition",
                active
                  ? "border-teal/50 bg-teal/10"
                  : "border-line/60 bg-panel/50",
                canSwap && "hover:border-teal/40",
                !fighter?.alive && "opacity-40",
              )}
            >
              <PetSprite speciesId={pet.speciesId} size={34} animate={false} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px]">{pet.name}</div>
                <Bar
                  value={fighter?.hp ?? 0}
                  max={fighter?.maxHp ?? 1}
                  color={active ? "#3ad7c0" : "#5c7189"}
                  height={3}
                  className="mt-1"
                />
              </div>
              {active ? (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-teal shadow-[0_0_6px_#3ad7c0]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {snapshot.a.swapCooldownMs > 0 ? (
        <div className="mt-1 px-1 text-right text-[10px] text-muted">
          swap ready in {(snapshot.a.swapCooldownMs / 1000).toFixed(1)}s
        </div>
      ) : (
        <div className="mt-1 px-1 text-right text-[10px] text-muted">swap ready</div>
      )}

      {/* skills */}
      <div className="mt-2 grid grid-cols-4 gap-2 px-1 pb-2">
        {playerInit?.skills.map((skill, index) => {
          const cooldown = playerActive?.cooldowns[index] ?? 0;
          const ready = cooldown <= 0;
          return (
            <button
              key={skill.id}
              onClick={() => runner.pressSkill(index)}
              disabled={runner.finished || runner.paused || readOnly}
              className={cn(
                "relative overflow-hidden rounded-xl border px-1 py-2 text-center transition",
                ready
                  ? "border-line/70 bg-panel/60 hover:border-teal/50"
                  : "border-line/40 bg-panel/30",
                "disabled:opacity-50",
              )}
            >
              {/* skill icon comes from the RO icon proxy */}
              <img
                src={`/api/icon/skill/${skill.id}`}
                alt=""
                width={26}
                height={26}
                className={cn("mx-auto rounded-md border border-black/40", !ready && "opacity-40")}
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
              />
              <div className="mt-1 truncate text-[9px] leading-tight text-muted">
                {skill.displayName}
              </div>
              <div
                className="absolute inset-x-0 bottom-0 bg-black/65 text-[10px] text-ink"
                style={{
                  height: ready ? 0 : `${Math.min(100, (cooldown / skill.cooldownMs) * 100)}%`,
                  transition: "height 120ms linear",
                }}
              >
                {ready ? null : (
                  <span className="absolute inset-x-0 bottom-1 tabular-nums">
                    {(cooldown / 1000).toFixed(1)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* log */}
      <button
        onClick={() => setShowLog((value) => !value)}
        className="mx-auto mb-2 flex items-center gap-1 text-[10px] text-muted hover:text-ink"
      >
        battle log <ChevronDown className={cn("h-3 w-3 transition", showLog && "rotate-180")} />
      </button>
      {showLog ? (
        <div className="mb-4 max-h-40 overflow-y-auto rounded-xl border border-line/60 bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-muted">
          {runner.events.slice(-30).map((event, index) => (
            <div key={`${event.t}-${index}`}>
              <span className="text-muted/60">{(event.t / 1000).toFixed(1)}s</span>{" "}
              {describeEvent(event, payload)}
            </div>
          ))}
        </div>
      ) : null}

      {showOverlay && !readOnly ? (
        <ResultOverlay
          battleId={battleId}
          result={runner.result}
          submission={submission}
          mode={mode}
          runId={runId}
          navigating={navigating}
          onNextWave={nextWave}
          onRetry={() => {
            submitted.current = false;
            void submit();
          }}
          onClose={() => router.push(mode === "tower" ? "/tower" : mode === "pvp" ? "/pvp" : "/ranch")}
        />
      ) : null}
    </div>
  );
}

function spriteAction(animation: "idle" | "attack" | "hurt" | "dead") {
  return animation === "dead" ? "dead" : animation === "attack" ? "attack" : animation === "hurt" ? "hurt" : "idle";
}

function CombatantHeader({
  name,
  level,
  element,
  hp,
  maxHp,
  atb,
  statuses,
  align,
  affix,
}: {
  name: string;
  level: number;
  element: number;
  hp: number;
  maxHp: number;
  atb: number;
  statuses: Array<{ kind: string; remainingMs: number }>;
  align: "left" | "right";
  affix?: string;
}) {
  const color = elementColor(element as 0);
  return (
    <div className={cn("w-full max-w-[240px]", align === "right" && "ml-auto text-right")}>
      <div
        className={cn(
          "flex items-center gap-2 text-[11px]",
          align === "right" && "justify-end",
        )}
      >
        <span className="font-display text-sm text-ink">{name}</span>
        <span className="text-muted">Lv {level}</span>
        <span
          className="rounded-full border px-1.5 py-0.5 text-[9px]"
          style={{ color, borderColor: `${color}55`, background: `${color}12` }}
        >
          {elementName(element as 0)}
        </span>
        {affix ? (
          <span className="rounded-full border border-rose/40 bg-rose/10 px-1.5 py-0.5 text-[9px] text-rose">
            {affix}
          </span>
        ) : null}
      </div>
      <div className="mt-1">
        <Bar
          value={hp}
          max={maxHp}
          color={hp / maxHp > 0.5 ? "#3ad7c0" : hp / maxHp > 0.2 ? "#ffc94a" : "#ff7a7a"}
          height={8}
        />
        <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-muted">
          <span>{Math.max(0, Math.ceil(hp)).toLocaleString()}</span>
          <span>{maxHp.toLocaleString()}</span>
        </div>
        <Bar value={atb} max={1} color="#8b9cb3" height={2} className="mt-1" />
      </div>
      {statuses.length > 0 ? (
        <div className={cn("mt-1 flex flex-wrap gap-1", align === "right" && "justify-end")}>
          {statuses.map((status) => (
            <span
              key={status.kind}
              className="rounded-full border px-1.5 py-0.5 text-[9px]"
              style={{
                color: STATUS_COLORS[status.kind] ?? "#8b9cb3",
                borderColor: `${STATUS_COLORS[status.kind] ?? "#8b9cb3"}44`,
                background: `${STATUS_COLORS[status.kind] ?? "#8b9cb3"}12`,
              }}
            >
              {status.kind} {(status.remainingMs / 1000).toFixed(0)}s
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Popups({ popups }: { popups: Popup[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {popups.map((popup) => (
        <span
          key={popup.id}
          className={cn(
            "damage-pop absolute font-display text-lg",
            popup.tone === "crit" && "text-xl text-gold",
            popup.tone === "damage" && "text-rose",
            popup.tone === "heal" && "text-teal",
            popup.tone === "status" && "text-[11px] text-violet",
          )}
          style={{
            left: `calc(50% + ${popup.offset}px)`,
            top: `${popup.top}%`,
          }}
        >
          {popup.value}
        </span>
      ))}
    </div>
  );
}

function describeEvent(event: BattleEvent, payload: Payload): string {
  const name = (side: Side, index: number) =>
    (side === "a" ? payload.teamA : payload.teamB)[index]?.name ?? "?";

  switch (event.type) {
    case "attack":
      return `${name(event.side, event.actor)} hits ${name(event.side === "a" ? "b" : "a", event.target)} for ${event.damage}${event.crit ? " (crit)" : ""}`;
    case "skill":
      return `${name(event.side, event.actor)} casts ${event.name}`;
    case "damage":
      return `${event.total} damage over ${event.hits.length} hit${event.hits.length > 1 ? "s" : ""}`;
    case "heal":
      return `${name(event.side, event.actor)} heals ${event.amount}`;
    case "status":
      return `${name(event.side, event.target)} gains ${event.kind}`;
    case "faint":
      return `${name(event.side, event.target)} faints`;
    case "swap":
      return `${event.side === "a" ? "You" : "Opponent"} swaps in ${name(event.side, event.to)}`;
    case "poison":
      return `${name(event.side, event.target)} takes ${event.damage} poison damage`;
    case "end":
      return event.winner === "a" ? "Victory" : event.winner === "b" ? "Defeat" : "Draw";
    default:
      return "";
  }
}

function ResultOverlay({
  battleId,
  result,
  submission,
  mode,
  runId,
  navigating,
  onNextWave,
  onRetry,
  onClose,
}: {
  battleId: string;
  result: ReturnType<typeof useBattleRunner>["result"];
  submission: Submission;
  mode: string;
  runId?: string;
  navigating: boolean;
  onNextWave: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const won = result?.winner === "a";
  const draw = result?.winner === "draw";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="panel w-full max-w-sm p-5 text-center reveal-pop">
        <div
          className={cn(
            "mx-auto flex h-14 w-14 items-center justify-center rounded-full border",
            won
              ? "border-teal/40 bg-teal/10 text-teal"
              : draw
                ? "border-gold/40 bg-gold/10 text-gold"
                : "border-rose/40 bg-rose/10 text-rose",
          )}
        >
          <Trophy className="h-6 w-6" />
        </div>

        <h2 className="mt-3 font-display text-2xl">
          {won ? "Victory" : draw ? "Draw" : "Defeat"}
        </h2>
        {result ? (
          <p className="mt-1 text-xs text-muted">
            {result.reason === "timeout" ? "Time ran out" : "Team wiped"} ·{" "}
            {(result.durationMs / 1000).toFixed(1)}s
          </p>
        ) : null}

        {submission.state === "pending" ? (
          <p className="mt-4 text-xs text-muted animate-pulse">Verifying battle…</p>
        ) : null}

        {submission.state === "done" ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Reward label="Coins" value={`+${submission.rewards.coins}`} />
            <Reward label="EXP" value={`+${submission.rewards.exp}`} />
            <Reward label="Eggs" value={`+${submission.rewards.eggs}`} />
          </div>
        ) : null}

        {submission.state === "done" && submission.levelUps.length > 0 ? (
          <p className="mt-2 text-[11px] text-gold">
            Level up! {submission.levelUps.map((entry) => `Lv ${entry.level}`).join(", ")}
          </p>
        ) : null}

        {submission.state === "done" ? (
          <div className="mt-3">
            <ShareReplayButton battleId={battleId} />
          </div>
        ) : null}

        {submission.state === "error" ? (
          <div className="mt-4 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
            {submission.message}
            <button onClick={onRetry} className="ml-2 underline">
              retry
            </button>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {mode === "tower" && runId && won && submission.state === "done" ? (
            <Button onClick={onNextWave} disabled={navigating}>
              {navigating ? "Loading..." : "Continue climb"}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            {mode === "tower" ? "Back to tower" : mode === "pvp" ? "Back to arena" : "Back to ranch"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Reward({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line/60 bg-black/20 px-2 py-2">
      <div className="text-[9px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="font-display text-sm text-gold">{value}</div>
    </div>
  );
}
