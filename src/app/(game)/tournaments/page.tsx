"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, Trophy, Users } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";

type Tournament = {
  id: string;
  name: string;
  season: number;
  format: string;
  status: string;
  startsAt: string;
  size: number;
};

export default function TournamentsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => api.get<{ tournaments: Tournament[] }>("/api/tournaments"),
  });
  const [adminToken, setAdminToken] = useState("");
  const [name, setName] = useState("");
  const [size, setSize] = useState<4 | 8>(8);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ name: name.trim(), size }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not create tournament");
      setName("");
      setMessage("Tournament created.");
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Could not create tournament",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">brackets</div>
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <Trophy className="h-5 w-5 text-gold" /> Tournaments
        </h1>
        <p className="mt-1 text-xs text-muted">
          Single elimination. Join a draft bracket, then start a live match from the bracket
          page when both players are present.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted">
          <Spinner className="h-6 w-6" />
        </div>
      ) : data?.tournaments.length ? (
        <div className="space-y-2">
          {data.tournaments.map((tournament) => (
            <Link key={tournament.id} href={`/tournaments/${tournament.id}`}>
              <Panel className="flex items-center justify-between transition hover:border-teal/40">
                <div>
                  <div className="text-sm">{tournament.name}</div>
                  <div className="text-[10px] text-muted">
                    {tournament.size} players · {tournament.format} ·{" "}
                    {tournament.status}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Panel>
            </Link>
          ))}
        </div>
      ) : (
        <Panel className="py-8 text-center text-xs text-muted">
          <Users className="mx-auto mb-2 h-6 w-6" />
          No tournaments yet. An admin can create one below.
        </Panel>
      )}

      <Panel>
        <SectionTitle hint="admin token">Create tournament</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-[1fr_110px_1fr_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tournament name"
            className="rounded-lg border border-line bg-black/30 px-2 py-2 text-xs outline-none focus:border-teal/50"
          />
          <select
            value={size}
            onChange={(event) => setSize(Number(event.target.value) as 4 | 8)}
            className="rounded-lg border border-line bg-black/30 px-2 py-2 text-xs outline-none"
          >
            <option value={4}>4 players</option>
            <option value={8}>8 players</option>
          </select>
          <input
            value={adminToken}
            onChange={(event) => setAdminToken(event.target.value)}
            placeholder="ADMIN_TOKEN"
            type="password"
            className="rounded-lg border border-line bg-black/30 px-2 py-2 text-xs outline-none focus:border-teal/50"
          />
          <Button
            size="sm"
            onClick={() => void create()}
            disabled={busy || !name.trim() || !adminToken}
          >
            <Plus className="h-3.5 w-3.5" /> Create
          </Button>
        </div>
        {message ? <p className="mt-2 text-[10px] text-teal">{message}</p> : null}
        {error ? <p className="mt-2 text-[10px] text-rose">{error}</p> : null}
      </Panel>
    </div>
  );
}
