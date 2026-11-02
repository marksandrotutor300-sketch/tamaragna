import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles, Trophy } from "lucide-react";
import { PetSprite } from "@/components/pet/PetSprite";
import { VisitRanchButton } from "@/components/ranch/VisitRanchButton";
import { Panel } from "@/components/ui/primitives";
import { isFeatureEnabled } from "@/lib/features";
import { RARITY } from "@/lib/game/rarity";
import { getTrainerCard } from "@/lib/game/trainer-cards";
import type { Rarity } from "@/lib/game/types";

export const dynamic = "force-dynamic";

const getCard = cache(getTrainerCard);

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const card = await getCard(slug);
  if (!card) return { title: "Trainer not found", robots: { index: false } };

  return {
    title: `${card.displayName} — trainer card`,
    description: `${card.displayName} · ${card.rating} rating · season ${card.season} · TamaRagna`,
    openGraph: {
      title: `${card.displayName} — trainer card`,
      description: `${card.rating} rating · season ${card.season}`,
      images: [`/trainer/${slug}/opengraph-image`],
    },
  };
}

export default async function TrainerPage({ params }: Props) {
  if (!isFeatureEnabled("share")) notFound();

  const { slug } = await params;
  const card = await getCard(slug);
  if (!card) notFound();

  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2 font-display text-base">
          <Sparkles className="h-4 w-4 text-gold" />
          TamaRagna
        </Link>
        <Link
          href="/bestiary"
          className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-ink"
        >
          bestiary
        </Link>
      </header>

      <div className="mx-auto max-w-2xl px-4 pb-10">
        <Panel className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
              public trainer card
            </div>
            <h1 className="mt-1 font-display text-3xl">{card.displayName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1 rounded-lg border border-gold/30 bg-gold/10 px-2 py-1 text-gold">
                <Trophy className="h-3 w-3" /> {card.rating} rating
              </span>
              <span>Season {card.season}</span>
              <span className="rounded-lg border border-line/60 px-2 py-1" style={{ color: card.habitat.accent }}>
                {card.habitat.name}
              </span>
              <span>{card.visits} visits</span>
            </div>
            <div className="mt-3">
              <VisitRanchButton slug={slug} />
            </div>
          </div>

          <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
            {card.pets.length === 0 ? (
              <p className="text-xs text-muted sm:col-span-3">
                This trainer has not hatched a pet yet.
              </p>
            ) : (
              card.pets.map((pet) => (
                <div
                  key={`${pet.speciesId}-${pet.nickname}`}
                  className="rounded-xl border border-line/60 bg-black/20 p-3"
                >
                  <PetSprite speciesId={pet.speciesId} size={82} animate={false} />
                  <div className="mt-1 truncate text-sm">{pet.nickname}</div>
                  <div className="text-[10px] text-muted">
                    Lv {pet.level} · {pet.star}★ · {RARITY[pet.rarity as Rarity]?.name ?? "?"}
                  </div>
                  <div className="mt-1 text-[10px] text-gold">
                    {pet.power.toLocaleString()} power
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <p className="mt-4 text-center text-[10px] text-muted/70">
          Trainer cards are opt-in and share only the display name, rating, season and top
          pets.
        </p>
      </div>
    </main>
  );
}
