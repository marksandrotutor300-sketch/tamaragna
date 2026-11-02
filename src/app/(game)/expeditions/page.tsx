"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Compass, Egg, Gem, Timer } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { api } from "@/lib/client/api";
import { useMe } from "@/hooks/useGame";

type Route = {
  id: string;
  name: string;
  description: string;
  minutes: number;
  coins: number;
  eggs: number;
  materials: number;
  minLevel: number;
};

type Expedition = {
  id: string;
  routeId: string;
  petIds: string[];
  rewards: { coins: number; eggs: number; materials: number };
  status: string;
  startedAt: string;
  endsAt: string;
};

export default function ExpeditionsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["expeditions"],
    queryFn: () => api.get<{ routes: Route[]; expeditions: Expedition[] }>("/api/expeditions"),
    refetchInterval: 15_000,
  });
  const [routeId, setRouteId] = useState("");
  const [petIds, setPetIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const route = data?.routes.find((entry) => entry.id === routeId);
  const storage = (me?.pets ?? []).filter(
    (pet) => pet.slot === null && !pet.marketListed && !pet.expeditionId,
  );
  const active = data?.expeditions.filter((entry) => entry.status === "active") ?? [];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["expeditions"] });
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  };

  const start = async () => {
    if (!route) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/expeditions", { routeId: route.id, petIds });
      setMessage(`${route.name} departed.`);
      setPetIds([]);
      await refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start expedition");
    } finally {
      setBusy(false);
    }
  };

  const claim = async (expedition: Expedition) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ rewards: { coins: number; eggs: number; materials: number } }>(
        `/api/expeditions/${expedition.id}/claim`,
      );
      setMessage(
        `Returned with ${result.rewards.coins} coins, ${result.rewards.materials} materials${result.rewards.eggs ? ` and ${result.rewards.eggs} egg` : ""}.`,
      );
      await refresh();
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Could not claim expedition");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">routes</div>
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <Compass className="h-5 w-5 text-violet" /> Expeditions
        </h1>
        <p className="mt-1 text-xs text-muted">
          Storage pets travel while you play. Higher levels and friendship increase the haul.
        </p>
      </div>

      <Panel>
        <SectionTitle hint={`${data?.routes.length ?? 0} routes`}>Send a party</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          {data?.routes.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setRouteId(entry.id)}
              className={`rounded-xl border p-3 text-left transition ${
                routeId === entry.id
                  ? "border-violet/50 bg-violet/10"
                  : "border-line/60 bg-black/20 hover:border-white/20"
              }`}
            >
              <div className="text-sm">{entry.name}</div>
              <div className="mt-1 text-[10px] text-muted">{entry.description}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted">
                <span className="inline-flex items-center gap-1">
                  <Timer className="h-3 w-3" /> {entry.minutes}m
                </span>
                <span className="inline-flex items-center gap-1">
                  <Coins className="h-3 w-3 text-gold" /> {entry.coins}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Gem className="h-3 w-3 text-teal" /> {entry.materials}
                </span>
                <span>Lv {entry.minLevel}+</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {storage.map((pet) => {
            const selected = petIds.includes(pet.id);
            const disabled = Boolean(route && pet.level < route.minLevel);
            return (
              <button
                key={pet.id}
                disabled={disabled}
                onClick={() =>
                  setPetIds((current) =>
                    selected
                      ? current.filter((id) => id !== pet.id)
                      : current.length >= 3
                        ? current
                        : [...current, pet.id],
                  )
                }
                className={`flex items-center gap-2 rounded-xl border p-2 text-left disabled:opacity-40 ${
                  selected ? "border-violet/50 bg-violet/10" : "border-line/60 bg-black/20"
                }`}
              >
                <PetSprite speciesId={pet.speciesId} size={34} animate={false} />
                <div className="min-w-0">
                  <div className="truncate text-xs">{pet.nickname}</div>
                  <div className="text-[10px] text-muted">Lv {pet.level}</div>
                </div>
              </button>
            );
          })}
        </div>
        {storage.length === 0 ? (
          <p className="mt-2 text-[10px] text-muted">Move pets to storage to send them.</p>
        ) : null}

        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={() => void start()} disabled={busy || !route || petIds.length === 0}>
            {busy ? "Departing..." : `Send ${petIds.length || "a party"}`}
          </Button>
          {route ? (
            <span className="text-[10px] text-muted">
              {route.name} · {route.minutes} minutes
            </span>
          ) : null}
        </div>
        {message ? <p className="mt-2 text-[10px] text-teal">{message}</p> : null}
        {error ? <p className="mt-2 text-[10px] text-rose">{error}</p> : null}
      </Panel>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-muted">
          <Spinner className="h-5 w-5" />
        </div>
      ) : active.length > 0 ? (
        <Panel>
          <SectionTitle hint="away">Active expeditions</SectionTitle>
          <div className="space-y-2">
            {active.map((expedition) => {
              const ended = new Date(expedition.endsAt).getTime() <= Date.now();
              const routeInfo = data?.routes.find((entry) => entry.id === expedition.routeId);
              return (
                <div key={expedition.id} className="rounded-xl border border-line/60 bg-black/20 p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{routeInfo?.name ?? expedition.routeId}</span>
                    <span className="text-[10px] text-muted">
                      {ended ? "ready" : `returns ${new Date(expedition.endsAt).toLocaleString()}`}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted">
                    <span>{expedition.petIds.length} pets</span>
                    <span className="inline-flex items-center gap-1">
                      <Coins className="h-3 w-3 text-gold" /> {expedition.rewards.coins}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Gem className="h-3 w-3 text-teal" /> {expedition.rewards.materials}
                    </span>
                    {expedition.rewards.eggs > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Egg className="h-3 w-3" /> {expedition.rewards.eggs}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    className="mt-2"
                    size="sm"
                    variant={ended ? "gold" : "ghost"}
                    disabled={!ended || busy}
                    onClick={() => void claim(expedition)}
                  >
                    {ended ? "Claim haul" : "Travelling"}
                  </Button>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
