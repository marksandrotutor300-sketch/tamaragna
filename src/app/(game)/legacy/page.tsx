"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dna, HeartHandshake, RotateCcw } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { api } from "@/lib/client/api";
import { LEGACY_BREED_COST, LEGACY_IV_BONUS } from "@/lib/game/legacy";
import { useMe } from "@/hooks/useGame";

type LegacyData = {
  legacyPoints: number;
  marks: Array<{
    id: string;
    speciesId: number;
    trait: string;
    sourceName: string;
    createdAt: string;
  }>;
  eligible: Array<{
    id: string;
    nickname: string;
    speciesId: number;
    level: number;
    star: number;
  }>;
};

export default function LegacyPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["legacy"],
    queryFn: () => api.get<LegacyData>("/api/legacy"),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retire = async (id: string, nickname: string) => {
    if (!window.confirm(`Retire ${nickname}? The pet leaves your ranch and becomes a legacy mark.`)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ trait: string; legacyPoints: number }>(
        `/api/pets/${id}/retire`,
      );
      setMessage(`${nickname} left ${result.trait}. Legacy points: ${result.legacyPoints}.`);
      await queryClient.invalidateQueries({ queryKey: ["legacy"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (retireError) {
      setError(retireError instanceof Error ? retireError.message : "Could not retire pet");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">lineage</div>
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <Dna className="h-5 w-5 text-rose" /> Legacy
        </h1>
        <p className="mt-1 text-xs text-muted">
          A level-50 pet can retire into a permanent mark. Spend {LEGACY_BREED_COST} legacy
          points when breeding to add +{LEGACY_IV_BONUS} to every inherited IV.
        </p>
        <p className="mt-1 text-[10px] text-gold">
          {me?.profile.legacyPoints ?? 0} legacy points available
        </p>
      </div>

      <Panel>
        <SectionTitle hint={`${data?.eligible.length ?? 0} eligible`}>Retire a pet</SectionTitle>
        {isLoading ? (
          <Spinner className="h-5 w-5" />
        ) : data?.eligible.length ? (
          <div className="space-y-2">
            {data.eligible.map((pet) => (
              <div
                key={pet.id}
                className="flex items-center gap-2 rounded-xl border border-line/60 bg-black/20 p-2"
              >
                <PetSprite speciesId={pet.speciesId} size={38} animate={false} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs">{pet.nickname}</div>
                  <div className="text-[10px] text-muted">Lv {pet.level} · {pet.star}★</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void retire(pet.id, pet.nickname)}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Retire
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted">No level-50 storage pets are ready.</p>
        )}
        {message ? <p className="mt-2 text-[10px] text-teal">{message}</p> : null}
        {error ? <p className="mt-2 text-[10px] text-rose">{error}</p> : null}
      </Panel>

      <Panel>
        <SectionTitle hint={`${data?.marks.length ?? 0} marks`}>Legacy marks</SectionTitle>
        {data?.marks.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {data.marks.map((mark) => (
              <div key={mark.id} className="rounded-xl border border-rose/20 bg-rose/5 p-2 text-xs">
                <div className="flex items-center gap-2 text-rose">
                  <HeartHandshake className="h-3.5 w-3.5" /> {mark.trait}
                </div>
                <div className="mt-1 text-[10px] text-muted">
                  {mark.sourceName} · species {mark.speciesId} ·{" "}
                  {new Date(mark.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted">No marks yet. Retire a level-50 pet to begin.</p>
        )}
      </Panel>
    </div>
  );
}
