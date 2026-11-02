"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Wifi, WifiOff } from "lucide-react";
import { Bar, Button, Panel } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { ShareReplayButton } from "@/components/battle/ShareReplayButton";
import { SpectatorPickPanel } from "@/components/live/SpectatorPickPanel";
import { api } from "@/lib/client/api";
import type { LiveSnapshot } from "@/lib/live/rooms";
import type { Side } from "@/lib/sim/types";
import { cn } from "@/lib/client/cn";

export function LiveArena({
  matchId,
  ticket,
  seat,
}: {
  matchId: string;
  ticket: string;
  seat: "a" | "b" | "spectator";
}) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource(
      `/api/pvp/live/${matchId}/stream?ticket=${encodeURIComponent(ticket)}`,
    );
    sourceRef.current = source;
    source.onopen = () => setConnected(true);
    source.onmessage = (event) => {
      try {
        setSnapshot(JSON.parse(event.data) as LiveSnapshot);
        setConnected(true);
      } catch {
        // Ignore malformed frames.
      }
    };
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, [matchId, ticket]);

  const mySide: Side = seat === "b" ? "b" : "a";
  const otherSide: Side = mySide === "a" ? "b" : "a";
  const spectator = seat === "spectator";
  const mine = snapshot?.[mySide];
  const other = snapshot?.[otherSide];
  const active = mine?.fighters[mine.active];
  const activeSkills = useMemo(
    () => (snapshot ? snapshot.skills[mySide][mine?.active ?? 0] ?? [] : []),
    [snapshot, mySide, mine?.active],
  );

  const send = async (kind: "skill" | "swap", index: number) => {
    if (spectator || snapshot?.status !== "active") return;
    setError(null);
    try {
      await api.post(`/api/pvp/live/${matchId}/input`, {
        ticket,
        kind,
        index,
      });
    } catch (inputError) {
      setError(inputError instanceof Error ? inputError.message : "Input failed");
    }
  };

  if (!snapshot) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted">
        <span className="animate-pulse">
          {spectator ? "Connecting to the delayed spectator feed…" : "Connecting to the arena…"}
        </span>
        {error ? <span className="text-xs text-rose">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/pvp"
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" /> arena
        </Link>
        <div className="flex items-center gap-2 text-[10px] text-muted">
          {connected ? <Wifi className="h-3 w-3 text-teal" /> : <WifiOff className="h-3 w-3 text-rose" />}
          {spectator ? "spectator · 5s delay" : connected ? "live" : "reconnecting"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["a", "b"] as const).map((side) => (
          <Panel key={side} className={cn(side === mySide && !spectator && "border-teal/40")}>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted">
              <span>{side === "a" ? snapshot.players.a.displayName : snapshot.players.b.displayName}</span>
              <span>{side === "a" ? snapshot.players.a.rating : snapshot.players.b.rating}</span>
            </div>
            <div className="mt-2 space-y-1">
              {snapshot[side].fighters.map((fighter, index) => (
                <div
                  key={fighter.petId}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                    snapshot[side].active === index
                      ? "border-teal/40 bg-teal/5"
                      : "border-line/50 bg-black/20",
                    !fighter.alive && "opacity-40",
                  )}
                >
                  <PetSprite speciesId={fighter.speciesId} size={30} animate={false} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px]">{fighter.name}</div>
                    <Bar
                      value={fighter.hp}
                      max={fighter.maxHp}
                      color={side === mySide ? "#3ad7c0" : "#ff7a7a"}
                      height={3}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="relative">
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span>{Math.round((snapshot.t ?? 0) / 1000)}s</span>
          <span className="uppercase tracking-[0.18em]">{snapshot.status}</span>
        </div>
        <div className="mt-3 flex min-h-[180px] items-end justify-center gap-6">
          {active ? (
            <PetSprite
              speciesId={active.speciesId}
              size={170}
              animate={snapshot.status === "active"}
            />
          ) : null}
          {other?.fighters[other.active] ? (
            <PetSprite
              speciesId={other.fighters[other.active].speciesId}
              size={120}
              animate={snapshot.status === "active"}
            />
          ) : null}
        </div>
        {active ? (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-muted">
              <span>{active.name}</span>
              <span>
                {Math.ceil(active.hp)} / {active.maxHp}
              </span>
            </div>
            <Bar
              value={active.hp}
              max={active.maxHp}
              color="#3ad7c0"
              height={6}
              className="mt-1"
            />
          </div>
        ) : null}
      </Panel>

      {snapshot.status === "active" ? (
        <div className="grid grid-cols-4 gap-2">
          {activeSkills.map((skill, index) => {
            const cooldown = active?.cooldowns[index] ?? 0;
            return (
              <button
                key={skill.id}
                onClick={() => void send("skill", index)}
                disabled={spectator || cooldown > 0}
                className="rounded-xl border border-line/70 bg-panel/60 px-1 py-2 text-center disabled:opacity-40"
              >
                <img
                  src={`/api/icon/skill/${skill.iconId}`}
                  alt=""
                  width={26}
                  height={26}
                  className="mx-auto rounded-md"
                />
                <div className="mt-1 truncate text-[9px] text-muted">
                  {skill.displayName}
                </div>
                {cooldown > 0 ? (
                  <div className="text-[9px] text-gold">
                    {(cooldown / 1000).toFixed(1)}s
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {mine && mine.fighters.length > 1 && !spectator ? (
        <div className="flex gap-2">
          {mine.fighters.map((fighter, index) =>
            index === mine.active || !fighter.alive ? null : (
              <Button
                key={fighter.petId}
                size="sm"
                variant="ghost"
                onClick={() => void send("swap", index)}
                disabled={mine.swapCooldownMs > 0}
              >
                Swap {fighter.name}
              </Button>
            ),
          )}
        </div>
      ) : null}

      {spectator && snapshot.status === "active" ? (
        <SpectatorPickPanel matchId={matchId} players={snapshot.players} />
      ) : null}

      {error ? <p className="text-xs text-rose">{error}</p> : null}

      {snapshot.result ? (
        <Panel className="text-center">
          <div className="font-display text-xl">
            {snapshot.result.winner === "draw"
              ? "Draw"
              : spectator
                ? `${snapshot.result.winner === "a" ? snapshot.players.a.displayName : snapshot.players.b.displayName} wins`
                : snapshot.result.winner === mySide
                  ? "Victory"
                  : "Defeat"}
          </div>
          <p className="mt-1 text-[10px] text-muted">
            {(snapshot.result.durationMs / 1000).toFixed(1)}s ·{" "}
            {snapshot.result.reason === "timeout" ? "time ran out" : "team wipe"}
          </p>
          {!spectator && seat === "a" ? (
            <div className="mt-3">
              <ShareReplayButton battleId={snapshot.battleId} />
            </div>
          ) : null}
          <Link href="/pvp" className="mt-3 inline-block">
            <Button size="sm" variant="ghost">
              Back to arena
            </Button>
          </Link>
        </Panel>
      ) : null}
    </div>
  );
}
