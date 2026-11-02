"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Eye, Play, Plus, Trophy } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { useMe } from "@/hooks/useGame";

type RankedData = {
  leaders: Array<{
    id: string;
    displayName: string;
    rating: number;
    season: number;
    spectatorPoints: number;
    publicSlug: string | null;
  }>;
  cups: Array<{
    id: string;
    name: string;
    season: number;
    startsAt: string;
    status: string;
    entrants: number;
    tournamentId: string;
    tournament: { size: number; status: string };
  }>;
};

export default function RankedPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["ranked"],
    queryFn: () => api.get<RankedData>("/api/ranked"),
    refetchInterval: 10_000,
  });
  const [adminToken, setAdminToken] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["ranked"] });
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  };

  const createCup = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ranked/cups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ name: name.trim(), size: 8 }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not create cup");
      setMessage("Ranked cup scheduled.");
      setName("");
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create cup");
    } finally {
      setBusy(false);
    }
  };

  const join = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/ranked/cups/${id}/join`);
      setMessage("Joined the cup.");
      await refresh();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join cup");
    } finally {
      setBusy(false);
    }
  };

  const start = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/ranked/cups/${id}/start`);
      setMessage("Bracket generated.");
      await refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start cup");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">season {me?.profile.season ?? 1}</div>
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <Trophy className="h-5 w-5 text-gold" /> Ranked circuit
        </h1>
        <p className="mt-1 text-xs text-muted">
          Ladder, scheduled cups and spectator predictions. Cup brackets use the live
          tournament rooms.
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-gold">
          <Eye className="h-3 w-3" /> {me?.profile.spectatorPoints ?? 0} spectator points
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <Panel>
          <SectionTitle hint="top 20">Ladder</SectionTitle>
          <div className="space-y-1">
            {data?.leaders.map((leader, index) => (
              <div
                key={leader.id}
                className="flex items-center justify-between rounded-lg border border-line/50 bg-black/20 px-2 py-1.5 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 text-[10px] text-muted">{index + 1}</span>
                  {leader.publicSlug ? (
                    <Link href={`/trainer/${leader.publicSlug}`} className="truncate hover:text-teal">
                      {leader.displayName}
                    </Link>
                  ) : (
                    <span className="truncate">{leader.displayName}</span>
                  )}
                </span>
                <span className="flex items-center gap-2 text-[10px] text-muted">
                  {leader.spectatorPoints > 0 ? (
                    <span className="text-gold">{leader.spectatorPoints}p</span>
                  ) : null}
                  {leader.rating}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-3">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted">
              <Spinner className="h-5 w-5" />
            </div>
          ) : (
            data?.cups.map((cup) => (
              <Panel key={cup.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm">{cup.name}</div>
                    <div className="text-[10px] text-muted">
                      {cup.entrants}/{cup.tournament.size} entrants · {cup.status} ·{" "}
                      {new Date(cup.startsAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {cup.tournament.status === "draft" ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => void join(cup.id)} disabled={busy}>
                          Join
                        </Button>
                        {cup.entrants >= cup.tournament.size ? (
                          <Button size="sm" onClick={() => void start(cup.id)} disabled={busy}>
                            <Play className="h-3.5 w-3.5" /> Start
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <Link href={`/tournaments/${cup.tournamentId}`}>
                        <Button size="sm" variant="ghost">
                          Bracket <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Panel>
            ))
          )}
          {data?.cups.length === 0 ? (
            <Panel className="py-8 text-center text-xs text-muted">No cups scheduled yet.</Panel>
          ) : null}

          <Panel>
            <SectionTitle hint="admin token">Schedule a cup</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Cup name"
                className="rounded-lg border border-line bg-black/30 px-2 py-2 text-xs outline-none focus:border-gold/50"
              />
              <input
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                type="password"
                placeholder="ADMIN_TOKEN"
                className="rounded-lg border border-line bg-black/30 px-2 py-2 text-xs outline-none focus:border-gold/50"
              />
              <Button size="sm" onClick={() => void createCup()} disabled={busy || !name.trim() || !adminToken}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {message ? <p className="mt-2 text-[10px] text-teal">{message}</p> : null}
            {error ? <p className="mt-2 text-[10px] text-rose">{error}</p> : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
