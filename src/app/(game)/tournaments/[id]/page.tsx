"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Trophy } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { useMe } from "@/hooks/useGame";

type Detail = {
  tournament: {
    id: string;
    name: string;
    size: number;
    status: string;
    season: number;
  };
  entries: Array<{ profileId: string; displayName: string; rating: number }>;
  matches: Array<{
    id: string;
    round: number;
    slot: number;
    playerA: string | null;
    playerB: string | null;
    playerAName: string | null;
    playerBName: string | null;
    liveMatchId: string | null;
    winner: string | null;
    winnerName: string | null;
    status: string;
  }>;
};

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tournament", params.id],
    queryFn: () => api.get<Detail>(`/api/tournaments/${params.id}`),
    refetchInterval: 3_000,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joined = useMemo(
    () => Boolean(data?.entries.some((entry) => entry.profileId === me?.profile.id)),
    [data, me],
  );

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/tournaments/${params.id}/join`);
      await queryClient.invalidateQueries({ queryKey: ["tournament", params.id] });
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join");
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/tournaments/${params.id}/start`);
      await queryClient.invalidateQueries({ queryKey: ["tournament", params.id] });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start");
    } finally {
      setBusy(false);
    }
  };

  const enter = async (matchId: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{
        matchId: string;
        seat: "a" | "b";
        ticket: string;
      }>(`/api/tournaments/${params.id}/matches/${matchId}/start`);
      router.push(
        `/pvp/live/${result.matchId}?ticket=${encodeURIComponent(result.ticket)}&seat=${result.seat}`,
      );
    } catch (enterError) {
      setError(enterError instanceof Error ? enterError.message : "Could not start match");
      await refetch();
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const rounds = new Map<number, Detail["matches"]>();
  for (const match of data.matches) {
    const list = rounds.get(match.round) ?? [];
    list.push(match);
    rounds.set(match.round, list);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/tournaments"
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" /> tournaments
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl">
            <Trophy className="h-5 w-5 text-gold" /> {data.tournament.name}
          </h1>
          <p className="text-[10px] text-muted">
            {data.entries.length}/{data.tournament.size} joined · {data.tournament.status} ·
            season {data.tournament.season}
          </p>
        </div>
        <div className="flex gap-2">
          {!joined && data.tournament.status === "draft" ? (
            <Button size="sm" onClick={() => void join()} disabled={busy}>
              Join bracket
            </Button>
          ) : null}
          {joined &&
          data.tournament.status === "draft" &&
          data.entries.length >= data.tournament.size ? (
            <Button size="sm" variant="ghost" onClick={() => void start()} disabled={busy}>
              Start bracket
            </Button>
          ) : null}
          <Link href="/pvp/live">
            <Button size="sm" variant="ghost">
              Live queue
            </Button>
          </Link>
        </div>
      </div>

      {error ? <p className="text-xs text-rose">{error}</p> : null}

      <Panel>
        <SectionTitle hint={`${data.entries.length} trainers`}>Entrants</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {data.entries.map((entry) => (
            <span
              key={entry.profileId}
              className="rounded-full border border-line/60 bg-black/20 px-2 py-0.5 text-[10px] text-muted"
            >
              {entry.displayName} · {entry.rating}
            </span>
          ))}
        </div>
      </Panel>

      {[...rounds.entries()].map(([round, matches]) => (
        <Panel key={round}>
          <SectionTitle hint={`${matches.length} matches`}>Round {round}</SectionTitle>
          <div className="space-y-2">
            {matches.map((match) => {
              const canEnter =
                joined &&
                match.status !== "complete" &&
                (match.playerA === me?.profile.id || match.playerB === me?.profile.id);
              return (
                <div
                  key={match.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-line/50 bg-black/20 px-3 py-2 text-xs"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-ink">{match.playerAName ?? "TBD"}</span>
                    <span className="mx-1 text-muted">vs</span>
                    <span className="text-ink">{match.playerBName ?? "TBD"}</span>
                  </span>
                  {match.winnerName ? (
                    <span className="text-[10px] text-teal">
                      {match.winnerName} advances
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted">{match.status}</span>
                  )}
                  {canEnter ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void enter(match.id)}
                      disabled={busy}
                    >
                      <Play className="h-3.5 w-3.5" /> Enter match
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
}
