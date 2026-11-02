"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Play, Swords } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { api } from "@/lib/client/api";
import { useMe } from "@/hooks/useGame";

type Ghost = {
  id: string;
  name: string;
  source: string;
  difficulty: number;
  wins: number;
  losses: number;
  team: Array<{ speciesId: number; name: string; level: number }>;
};

type SparResult = {
  winner: string;
  battleId: string;
  coins: number;
  ghost: { name: string; wins: number; losses: number };
};

export default function DojoPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["dojo"],
    queryFn: () => api.get<{ ghosts: Ghost[] }>("/api/dojo/ghosts"),
  });
  const [name, setName] = useState("");
  const [source, setSource] = useState<"team" | "lastOpponent">("team");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SparResult | null>(null);

  const train = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/dojo/ghosts", { name: name.trim(), source });
      setMessage(`${name.trim()} entered the dojo.`);
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["dojo"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (trainError) {
      setError(trainError instanceof Error ? trainError.message : "Could not train ghost");
    } finally {
      setBusy(false);
    }
  };

  const spar = async (ghost: Ghost) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.post<SparResult>(`/api/dojo/ghosts/${ghost.id}/spar`);
      setResult(response);
      setMessage(
        response.winner === "a"
          ? `You defeated ${ghost.name}. +${response.coins} coins.`
          : `${ghost.name} won. +${response.coins} coins.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["dojo"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (sparError) {
      setError(sparError instanceof Error ? sparError.message : "Could not spar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">practice</div>
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <Brain className="h-5 w-5 text-teal" /> Ghost dojo
        </h1>
        <p className="mt-1 text-xs text-muted">
          Train a ghost from your current team or the last opponent&apos;s team, then spar.
          Ghosts remember their record.
        </p>
      </div>

      <Panel>
        <SectionTitle hint="100 coins">Train a ghost</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ghost name"
            className="rounded-lg border border-line bg-black/30 px-2 py-2 text-xs outline-none focus:border-teal/50"
          />
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as "team" | "lastOpponent")}
            className="rounded-lg border border-line bg-black/30 px-2 py-2 text-xs outline-none"
          >
            <option value="team">Current team</option>
            <option value="lastOpponent">Last opponent</option>
          </select>
          <Button
            size="sm"
            onClick={() => void train()}
            disabled={busy || name.trim().length < 2 || (me?.profile.coins ?? 0) < 100}
          >
            <Brain className="h-3.5 w-3.5" /> Train
          </Button>
        </div>
        {message ? <p className="mt-2 text-[10px] text-teal">{message}</p> : null}
        {error ? <p className="mt-2 text-[10px] text-rose">{error}</p> : null}
      </Panel>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted">
          <Spinner className="h-5 w-5" />
        </div>
      ) : data?.ghosts.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {data.ghosts.map((ghost) => (
            <Panel key={ghost.id}>
              <div className="flex items-center gap-2">
                {ghost.team[0] ? (
                  <PetSprite speciesId={ghost.team[0].speciesId} size={44} animate={false} />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{ghost.name}</div>
                  <div className="text-[10px] text-muted">
                    {ghost.source === "lastOpponent" ? "learned opponent" : "team copy"} ·{" "}
                    {ghost.wins}W/{ghost.losses}L
                  </div>
                </div>
              </div>
              <Button
                className="mt-2 w-full"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void spar(ghost)}
              >
                <Swords className="h-3.5 w-3.5" /> Spar
              </Button>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel className="py-8 text-center text-xs text-muted">
          The dojo is empty. Train a ghost from your team.
        </Panel>
      )}

      {result ? (
        <Panel className="text-center">
          <div className="font-display text-xl">
            {result.winner === "a" ? "Victory" : "Defeat"}
          </div>
          <p className="mt-1 text-[10px] text-muted">
            {result.ghost.name} · {result.ghost.wins}W/{result.ghost.losses}L · {result.coins}{" "}
            coins
          </p>
          <Link href={`/battle/${result.battleId}`} className="mt-2 inline-block">
            <Button size="sm" variant="ghost">
              <Play className="h-3.5 w-3.5" /> Open battle
            </Button>
          </Link>
        </Panel>
      ) : null}
    </div>
  );
}
