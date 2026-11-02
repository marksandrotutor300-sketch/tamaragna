"use client";

import { useState } from "react";
import Link from "next/link";
import { Egg, Sparkles, X } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { NatureBadge, StarPips } from "@/components/pet/Genetics";
import { RarityBadge, RarityFrame } from "@/components/pet/RarityFrame";
import { IvPips } from "@/components/pet/StatRadar";
import { useFeatured, useHatch, useMe } from "@/hooks/useGame";
import { EGG_COSTS } from "@/lib/game/eggs";
import { ELEMENT_COLORS, ELEMENT_NAMES } from "@/lib/game/elements";
import { natureById } from "@/lib/game/nature";
import { RARITY } from "@/lib/game/rarity";
import type { PetView } from "@/lib/game/views";
import { cn } from "@/lib/client/cn";

export default function HatchPage() {
  const { data, isLoading } = useMe();
  const hatch = useHatch();
  const featured = useFeatured();
  const [kind, setKind] = useState<"wild" | "focused">("wild");
  const [element, setElement] = useState(3);
  const [reveal, setReveal] = useState<PetView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hatching, setHatching] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const cost = EGG_COSTS[kind];
  const affordable = data.profile.eggs >= cost;

  const submit = () => {
    setError(null);
    setHatching(true);
    window.setTimeout(() => {
      hatch.mutate(
        { kind, focusElement: kind === "focused" ? element : undefined },
        {
          onSuccess: (result) => {
            setHatching(false);
            setReveal(result.pet);
          },
          onError: (mutationError) => {
            setHatching(false);
            setError(mutationError.message);
          },
        },
      );
    }, 700);
  };

  const recent = [...data.pets].slice(-8).reverse();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">hatchery</div>
          <h1 className="font-display text-2xl">Crack an egg</h1>
          <p className="mt-1 text-xs text-muted">
            Rarer species appear less often, and every hatch rolls its own rarity and
            individual values.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line/70 bg-panel/60 px-3 py-2">
          <Egg className="h-4 w-4 text-teal" />
          <span className="font-display text-lg">{data.profile.eggs}</span>
          <span className="text-[10px] text-muted">eggs</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <EggOption
          active={kind === "wild"}
          onClick={() => setKind("wild")}
          title="Wild Egg"
          cost={EGG_COSTS.wild}
          body="A random monster from the whole bestiary. Species tier biases the rarity roll but anything can hatch."
        />
        <EggOption
          active={kind === "focused"}
          onClick={() => setKind("focused")}
          title="Focused Egg"
          cost={EGG_COSTS.focused}
          body="Pick an element and only that family can hatch. Costs an extra egg."
        />
      </div>

      {kind === "focused" ? (
        <Panel>
          <SectionTitle hint="choose a family">Element focus</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {ELEMENT_NAMES.map((name, index) => (
              <button
                key={name}
                onClick={() => setElement(index)}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs transition",
                  element === index
                    ? "border-white/30 bg-white/5"
                    : "border-line/60 text-muted hover:border-white/20",
                )}
                style={
                  element === index
                    ? { color: ELEMENT_COLORS[index], borderColor: `${ELEMENT_COLORS[index]}77` }
                    : { color: ELEMENT_COLORS[index] }
                }
              >
                {name}
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      {featured.data ? (
        <Panel>
          <SectionTitle hint={`${featured.data.boost}× wild odds`}>Featured today</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {featured.data.species.map((species) => {
              const rarity = RARITY[species.tier as 1 | 2 | 3 | 4 | 5];
              return (
                <Link
                  key={species.id}
                  href={`/bestiary/${species.id}`}
                  className="flex flex-col items-center rounded-xl border border-line/60 bg-black/20 p-2 text-center transition hover:border-white/20"
                >
                  <PetSprite speciesId={species.id} size={52} animate={false} />
                  <div className="mt-1 w-full truncate text-xs">{species.name}</div>
                  <div className="text-[10px]" style={{ color: rarity.color }}>
                    {rarity.name} · {ELEMENT_NAMES[species.element]}
                  </div>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-muted">
            Three species have 3× weight in Wild Eggs today. Resets at midnight UTC.
          </p>
        </Panel>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-line/60 bg-black/20 px-4 py-8">
        <Egg
          className={cn("h-14 w-14 text-gold", hatching && "egg-shake")}
          strokeWidth={1.2}
        />
        <Button
          variant="gold"
          size="lg"
          onClick={submit}
          disabled={!affordable || hatch.isPending || hatching}
        >
          {hatch.isPending || hatching ? "Hatching..." : `Hatch — ${cost} egg${cost > 1 ? "s" : ""}`}
        </Button>
        {!affordable ? (
          <p className="text-xs text-muted">
            Not enough eggs. Clear tower waves (every 10th) to earn more.
          </p>
        ) : null}
      </div>

      <div>
        <SectionTitle hint={`${data.pets.length} pets`}>Recent hatches</SectionTitle>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line/60 px-4 py-8 text-center text-sm text-muted">
            No pets yet. Your first egg is on the house.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {recent.map((pet) => (
              <Link
                key={pet.id}
                href="/team"
                className="flex items-center gap-2 rounded-xl border border-line/60 bg-panel/40 p-2 transition hover:border-white/20"
              >
                <PetSprite speciesId={pet.speciesId} size={40} animate={false} />
                <div className="min-w-0">
                  <div className="truncate text-xs">{pet.nickname}</div>
                  <div className="text-[10px]" style={{ color: RARITY[pet.rarity].color }}>
                    {RARITY[pet.rarity].name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {reveal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Hatch result"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <RarityFrame rarity={reveal.rarity} active className="reveal-pop w-full max-w-md p-5">
            <div className="flex items-start justify-between">
              <div className="text-[10px] uppercase tracking-[0.24em] text-muted">
                you hatched
              </div>
              <button
                onClick={() => setReveal(null)}
                aria-label="Close"
                className="rounded-lg p-1 text-muted hover:bg-white/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 flex flex-col items-center">
              <div
                className="pointer-events-none absolute h-40 w-40 rounded-full blur-3xl"
                style={{ background: RARITY[reveal.rarity].glow }}
              />
              <PetSprite speciesId={reveal.speciesId} size={150} className="relative" />
              <div className="mt-2 flex items-center gap-2">
                <h2 className="font-display text-2xl">{reveal.nickname}</h2>
                <RarityBadge rarity={reveal.rarity} />
              </div>
              <div className="text-xs text-muted">
                {reveal.species.name} · Lv 1 ·{" "}
                {ELEMENT_NAMES[reveal.species.element]} {reveal.species.elementLevel}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <StarPips star={reveal.star} />
                <NatureBadge nature={reveal.nature} />
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-gold">
                <Sparkles className="h-3 w-3" />
                IV total {Object.values(reveal.ivs).reduce((a, b) => a + b, 0)}/186
              </div>
              <div className="mt-1 text-center text-[10px] text-muted">
                {natureById(reveal.nature).description}
              </div>
            </div>

            <div className="mt-4">
              <IvPips ivs={reveal.ivs} />
            </div>

            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => setReveal(null)}>
                Keep hatching
              </Button>
              <Link href="/ranch" className="flex-1">
                <Button variant="ghost" className="w-full">
                  Go to ranch
                </Button>
              </Link>
            </div>
          </RarityFrame>
        </div>
      ) : null}
    </div>
  );
}

function EggOption({
  active,
  onClick,
  title,
  cost,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  cost: number;
  body: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition",
        active
          ? "border-gold/50 bg-gold/5 shadow-[0_0_40px_-18px_rgba(255,201,74,.7)]"
          : "border-line/60 bg-panel/40 hover:border-white/20",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-lg">{title}</span>
        <span className="rounded-full border border-line/60 px-2 py-0.5 text-[10px] text-muted">
          {cost} egg{cost > 1 ? "s" : ""}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
    </button>
  );
}
