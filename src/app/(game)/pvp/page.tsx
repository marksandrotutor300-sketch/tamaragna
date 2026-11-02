"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Eye,
  Gamepad2,
  Gift,
  RotateCcw,
  Shield,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import {
  useClaimSeason,
  useMe,
  useSeason,
  useUpdateProfile,
} from "@/hooks/useGame";
import { cn } from "@/lib/client/cn";

type History = {
  rating: number;
  battles: Array<{
    id: string;
    createdAt: string;
    status: string;
    winner: "a" | "b" | "draw" | null;
    durationMs: number | null;
  }>;
};

type MatchResponse = {
  battleId: string;
  opponent: { displayName: string; rating: number };
};

type Defense = {
  battleId: string;
  attackerName: string;
  attackerRating: number;
  outcome: "win" | "loss" | "draw";
  durationMs: number;
  createdAt: string;
  replayToken: string | null;
};

type DefenseResponse = { battles: Defense[] };

export default function ArenaPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const season = useSeason();
  const claimSeason = useClaimSeason();
  const rename = useUpdateProfile();
  const [auto, setAuto] = useState(true);
  const [draftName, setDraftName] = useState<string | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pvp-history"],
    queryFn: () => api.get<History>("/api/pvp/history"),
  });
  const defenses = useQuery({
    queryKey: ["pvp-defenses"],
    queryFn: () => api.get<DefenseResponse>("/api/pvp/defenses"),
  });

  const match = useMutation({
    mutationFn: () => api.post<MatchResponse>("/api/pvp/match", { auto }),
    onSuccess: (response) => {
      router.push(`/battle/${response.battleId}`);
    },
    onError: () => {
      void refetch();
    },
  });

  const revenge = useMutation({
    mutationFn: (battleId: string) =>
      api.post<{ battleId: string }>("/api/pvp/revenge", { battleId }),
    onSuccess: (response) => {
      router.push(`/battle/${response.battleId}`);
    },
  });

  if (isLoading || !data || !me) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">async duels</div>
          <h1 className="font-display text-2xl">Arena</h1>
          <p className="mt-1 text-xs text-muted">
            Fight other trainers&apos; saved teams. Your opponent plays their ghost team —
            no waiting for them to be online.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/pvp/live">
            <Button size="sm" variant="ghost">
              <Zap className="h-3.5 w-3.5" /> Live duel
            </Button>
          </Link>
          <Link href="/tournaments">
            <Button size="sm" variant="ghost">
              <Trophy className="h-3.5 w-3.5" /> Tournaments
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <Panel className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet/15 blur-3xl" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted">your rating</div>
            <div className="mt-1 font-display text-4xl text-gold">{data.rating}</div>
            <div className="mt-1 text-[11px] text-muted">
              Season {me.profile.season} ·{" "}
              {me.profile.placementMatches < (season.data?.placementsRequired ?? 5)
                ? `placement ${me.profile.placementMatches}/${season.data?.placementsRequired ?? 5}`
                : `${season.data?.tier.name ?? "unranked"} · wins move you up`}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted">name</span>
              <input
                value={draftName ?? me.profile.displayName}
                onChange={(event) => setDraftName(event.target.value)}
                maxLength={20}
                className="min-w-0 flex-1 rounded-lg border border-line/70 bg-black/30 px-2 py-1.5 text-xs outline-none focus:border-teal/50"
              />
              <button
                onClick={() => {
                  const name = (draftName ?? me.profile.displayName).trim();
                  if (name.length >= 2) rename.mutate(name);
                }}
                disabled={rename.isPending}
                className="rounded-lg border border-line/70 px-2.5 py-1.5 text-[11px] text-muted hover:border-teal/40 hover:text-teal disabled:opacity-40"
              >
                {rename.isPending ? "…" : "save"}
              </button>
            </div>

            <button
              onClick={() => setAuto((value) => !value)}
              className={cn(
                "mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs transition",
                auto
                  ? "border-teal/30 bg-teal/5 text-teal"
                  : "border-gold/30 bg-gold/5 text-gold",
              )}
            >
              <span className="flex items-center gap-2">
                {auto ? <Zap className="h-3.5 w-3.5" /> : <Gamepad2 className="h-3.5 w-3.5" />}
                {auto ? "Auto-battle" : "Manual control"}
              </span>
              <span className="text-[10px] text-muted">
                {auto ? "skills fire automatically" : "you tap the four skills"}
              </span>
            </button>

            <Button
              className="mt-3 w-full"
              onClick={() => match.mutate()}
              disabled={match.isPending}
            >
              <Swords className="h-4 w-4" />
              {match.isPending ? "Finding an opponent…" : "Find a duel"}
            </Button>
            {match.isError ? (
              <p className="mt-2 text-xs text-rose">{(match.error as Error).message}</p>
            ) : null}

            <div className="mt-4 space-y-1.5 text-[11px] text-muted">
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-teal" /> Your team is snapshotted when you
                enter the arena.
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-3 w-3 text-gold" /> Elo K=24 (K=40 during
                placements), matched within ±150 rating.
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionTitle hint={`${data.battles.length} recent`}>Duel history</SectionTitle>
          {data.battles.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">
              No duels yet. Find your first opponent.
            </p>
          ) : (
            <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
              {data.battles.map((battle) => {
                const won = battle.winner === "a";
                const draw = battle.winner === "draw";
                return (
                  <div
                    key={battle.id}
                    className="flex items-center gap-3 rounded-lg border border-line/50 bg-black/20 px-3 py-2"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        battle.status !== "complete"
                          ? "bg-muted"
                          : won
                            ? "bg-teal"
                            : draw
                              ? "bg-gold"
                              : "bg-rose"
                      }`}
                    />
                    <span className="flex-1 text-xs">
                      {battle.status !== "complete"
                        ? "Unfinished"
                        : won
                          ? "Victory"
                          : draw
                            ? "Draw"
                            : "Defeat"}
                    </span>
                    <span className="text-[10px] text-muted">
                      {new Date(battle.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <SectionTitle hint={`${defenses.data?.battles.length ?? 0} recent`}>
          Defense log
        </SectionTitle>
        {defenses.isLoading ? (
          <div className="flex h-24 items-center justify-center text-muted">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (defenses.data?.battles.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            No one has attacked your ghost team yet. Enter the arena to create a snapshot.
          </p>
        ) : (
          <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
            {defenses.data?.battles.map((battle) => (
              <div
                key={battle.battleId}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-line/50 bg-black/20 px-3 py-2"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    battle.outcome === "win"
                      ? "bg-teal"
                      : battle.outcome === "loss"
                        ? "bg-rose"
                        : "bg-gold"
                  }`}
                />
                <span className="min-w-0 flex-1 text-xs">
                  <span className="text-ink">{battle.attackerName}</span>{" "}
                  <span className="text-muted">
                    ({battle.attackerRating}) ·{" "}
                    {battle.outcome === "win"
                      ? "defended"
                      : battle.outcome === "loss"
                        ? "won"
                        : "draw"}
                  </span>
                </span>
                <span className="text-[10px] text-muted">
                  {new Date(battle.createdAt).toLocaleDateString()}
                </span>
                {battle.replayToken ? (
                  <Link href={`/replay/${battle.replayToken}`}>
                    <Button size="sm" variant="ghost">
                      <Eye className="h-3.5 w-3.5" /> Watch
                    </Button>
                  </Link>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => revenge.mutate(battle.battleId)}
                  disabled={revenge.isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Revenge
                </Button>
              </div>
            ))}
          </div>
        )}
        {revenge.error ? (
          <p className="mt-2 text-[10px] text-rose">{revenge.error.message}</p>
        ) : null}
      </Panel>

      <Panel>
        <SectionTitle hint={`Season ${season.data?.season ?? me.profile.season}`}>
          Season rewards
        </SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          <SeasonStat label="Tier" value={season.data?.tier.name ?? "—"} />
          <SeasonStat
            label="Placement"
            value={`${season.data?.placementMatches ?? me.profile.placementMatches}/${season.data?.placementsRequired ?? 5}`}
          />
          <SeasonStat
            label="Unclaimed"
            value={`${season.data?.unclaimed.coins ?? 0}c · ${season.data?.unclaimed.eggs ?? 0}e`}
          />
        </div>
        {(season.data?.unclaimed.coins ?? 0) > 0 ||
        (season.data?.unclaimed.eggs ?? 0) > 0 ? (
          <Button
            className="mt-3"
            size="sm"
            onClick={() => claimSeason.mutate()}
            disabled={claimSeason.isPending}
          >
            <Gift className="h-4 w-4" />
            {claimSeason.isPending ? "Claiming..." : "Claim season rewards"}
          </Button>
        ) : (
          <p className="mt-3 text-[10px] text-muted">
            No unclaimed rewards. Finish placements and climb to raise your tier.
          </p>
        )}
        {claimSeason.error ? (
          <p className="mt-2 text-[10px] text-rose">{claimSeason.error.message}</p>
        ) : null}
      </Panel>
    </div>
  );
}

function SeasonStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line/60 bg-black/20 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="font-display text-sm">{value}</div>
    </div>
  );
}
