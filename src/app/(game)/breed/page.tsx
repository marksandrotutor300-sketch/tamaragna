"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Dna, Egg, Sparkles, X } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { NatureBadge, StarPips } from "@/components/pet/Genetics";
import { RarityBadge, RarityFrame } from "@/components/pet/RarityFrame";
import { useBreed, useMe } from "@/hooks/useGame";
import { BREED_COST, BREED_MIN_LEVEL } from "@/lib/game/breeding";
import { natureById } from "@/lib/game/nature";
import { RARITY } from "@/lib/game/rarity";
import type { PetView } from "@/lib/game/views";

export default function BreedPage() {
  const { data, isLoading } = useMe();
  const breed = useBreed();
  const [parentA, setParentA] = useState("");
  const [parentB, setParentB] = useState("");
  const [result, setResult] = useState<PetView | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const eligible = data.pets.filter((pet) => pet.level >= BREED_MIN_LEVEL);
  const a = eligible.find((pet) => pet.id === parentA);
  const b = eligible.find((pet) => pet.id === parentB);
  const affordable =
    data.profile.eggs >= BREED_COST.eggs && data.profile.coins >= BREED_COST.coins;
  const ready = Boolean(a && b && a.id !== b.id && affordable);

  const submit = () => {
    setError(null);
    if (!a || !b) return;
    breed.mutate(
      { parentA: a.id, parentB: b.id },
      {
        onSuccess: (response) => setResult(response.pet),
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/team"
            className="mb-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted hover:text-ink"
          >
            <ArrowLeft className="h-3 w-3" /> team
          </Link>
          <h1 className="flex items-center gap-2 font-display text-2xl">
            <Dna className="h-5 w-5 text-violet" /> Breeding
          </h1>
          <p className="mt-1 max-w-xl text-xs text-muted">
            Parent A determines the species line. The child inherits IVs and nature from
            either parent, with a small mutation chance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-xl border border-line/70 bg-panel/60 px-3 py-2 text-xs">
            <Egg className="h-4 w-4 text-teal" /> {data.profile.eggs}
          </span>
          <span className="inline-flex items-center gap-1 rounded-xl border border-line/70 bg-panel/60 px-3 py-2 text-xs">
            <Sparkles className="h-4 w-4 text-gold" /> {data.profile.coins.toLocaleString()}
          </span>
        </div>
      </div>

      {data.pets.length < 2 ? (
        <Panel>
          <SectionTitle hint="two pets required">Not enough pets</SectionTitle>
          <p className="text-sm text-muted">
            You need at least two pets before you can breed. Hatch another egg first.
          </p>
          <Link href="/hatch" className="mt-3 inline-block">
            <Button variant="gold">Go to the hatchery</Button>
          </Link>
        </Panel>
      ) : eligible.length < 2 ? (
        <Panel>
          <SectionTitle hint={`${eligible.length} eligible`}>
            Level {BREED_MIN_LEVEL}+ required
          </SectionTitle>
          <p className="text-sm text-muted">
            Both parents must be level {BREED_MIN_LEVEL} or higher. Train them on the ranch
            or in practice battles, then come back.
          </p>
          <Link href="/ranch" className="mt-3 inline-block">
            <Button variant="ghost">Back to the ranch</Button>
          </Link>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <ParentPicker
            label="Parent A · species line"
            value={parentA}
            onChange={setParentA}
            pets={eligible}
            exclude={parentB}
            chosen={a}
          />
          <ParentPicker
            label="Parent B · genes"
            value={parentB}
            onChange={setParentB}
            pets={eligible}
            exclude={parentA}
            chosen={b}
          />
        </div>
      )}

      <Panel>
        <SectionTitle hint="what carries over">Inheritance</SectionTitle>
        <div className="grid gap-2 text-[11px] text-muted sm:grid-cols-2">
          <p>· Species comes from parent A.</p>
          <p>· Each IV is inherited from one parent (50/50).</p>
          <p>· 12% chance of a ±3 IV mutation.</p>
          <p>· Rarity: 55% better parent, 30% one lower, 15% one higher.</p>
          <p>· Nature: 45% A, 45% B, 10% random.</p>
          <p>· The child starts at level 1 with 1 star.</p>
        </div>
      </Panel>

      <div className="flex flex-col items-center gap-2 rounded-2xl border border-line/60 bg-black/20 px-4 py-6">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1 rounded-full border border-line/60 px-2 py-1">
            <Egg className="h-3.5 w-3.5 text-teal" /> {BREED_COST.eggs} eggs
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-line/60 px-2 py-1">
            <Sparkles className="h-3.5 w-3.5 text-gold" /> {BREED_COST.coins} coins
          </span>
        </div>
        <Button
          variant="gold"
          size="lg"
          onClick={submit}
          disabled={!ready || breed.isPending}
        >
          {breed.isPending ? "Breeding..." : "Breed"}
        </Button>
        {!affordable ? (
          <p className="text-[11px] text-rose">Not enough eggs or coins.</p>
        ) : null}
        {error ? <p className="text-[11px] text-rose">{error}</p> : null}
      </div>

      {result ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Breeding result"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <RarityFrame rarity={result.rarity} active className="reveal-pop w-full max-w-md p-5">
            <div className="flex items-start justify-between">
              <div className="text-[10px] uppercase tracking-[0.24em] text-muted">
                new offspring
              </div>
              <button
                onClick={() => setResult(null)}
                aria-label="Close"
                className="rounded-lg p-1 text-muted hover:bg-white/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 flex flex-col items-center">
              <PetSprite speciesId={result.speciesId} size={150} />
              <div className="mt-2 flex items-center gap-2">
                <h2 className="font-display text-2xl">{result.nickname}</h2>
                <RarityBadge rarity={result.rarity} />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <StarPips star={result.star} />
                <NatureBadge nature={result.nature} />
              </div>
              <div className="mt-1 text-xs text-muted">
                {result.species.name} · Lv 1 · IV total{" "}
                {Object.values(result.ivs).reduce((sum, value) => sum + value, 0)}/186
              </div>
              <p className="mt-1 text-center text-[10px] text-muted">
                {natureById(result.nature).description}
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => setResult(null)}>
                Breed again
              </Button>
              <Link href="/team" className="flex-1">
                <Button variant="ghost" className="w-full">
                  Back to team
                </Button>
              </Link>
            </div>
          </RarityFrame>
        </div>
      ) : null}
    </div>
  );
}

function ParentPicker({
  label,
  value,
  onChange,
  pets,
  exclude,
  chosen,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  pets: PetView[];
  exclude: string;
  chosen: PetView | undefined;
}) {
  return (
    <Panel>
      <SectionTitle hint={chosen ? `Lv ${chosen.level}` : "choose"}>{label}</SectionTitle>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-line bg-black/40 px-3 py-2 text-sm outline-none focus:border-teal/60"
      >
        <option value="">Choose a pet</option>
        {pets.map((pet) => (
          <option key={pet.id} value={pet.id} disabled={pet.id === exclude}>
            {pet.nickname} · {pet.species.name} · Lv {pet.level} · {RARITY[pet.rarity].name}
          </option>
        ))}
      </select>

      {chosen ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-line/60 bg-black/20 p-3">
          <PetSprite speciesId={chosen.speciesId} size={54} animate={false} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm">{chosen.nickname}</span>
              <RarityBadge rarity={chosen.rarity} />
              <StarPips star={chosen.star} />
            </div>
            <div className="mt-1 text-[10px] text-muted">
              {chosen.species.name} · {chosen.species.elementLevel} ·{" "}
              {chosen.species.raceName}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
              <NatureBadge nature={chosen.nature} />
              <span>IV {Object.values(chosen.ivs).reduce((sum, value) => sum + value, 0)}/186</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-line/60 px-3 py-4 text-center text-[11px] text-muted">
          Pick a level {BREED_MIN_LEVEL}+ pet.
        </p>
      )}
    </Panel>
  );
}
