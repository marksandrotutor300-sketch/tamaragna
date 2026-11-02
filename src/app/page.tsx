import Link from "next/link";
import { Sparkles, ArrowRight, BookOpen } from "lucide-react";
import { PetSprite } from "@/components/pet/PetSprite";
import { RARITY } from "@/lib/game/rarity";

const SHOWCASE = [
  { id: 1002, name: "Poring", rarity: 1 as const },
  { id: 1038, name: "Osiris", rarity: 5 as const },
  { id: 1096, name: "Angeling", rarity: 4 as const },
];

export default function LandingPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 scanline opacity-40" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <span className="font-display text-lg tracking-tight">TamaRagna</span>
        </div>
        <Link
          href="/bestiary"
          className="flex items-center gap-2 rounded-xl border border-line/70 px-3 py-2 text-xs text-muted transition hover:border-teal/40 hover:text-ink"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Bestiary
        </Link>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 pb-10 pt-4 text-center">
        <div className="mb-6 flex items-end justify-center gap-4 sm:gap-8">
          {SHOWCASE.map((entry, index) => (
            <div
              key={entry.id}
              className="relative"
              style={{ animationDelay: `${index * 0.4}s` }}
            >
              <div
                className="absolute inset-0 rounded-full blur-2xl"
                style={{
                  background: RARITY[entry.rarity].glow,
                  transform: "scale(0.9)",
                }}
              />
              <PetSprite
                speciesId={entry.id}
                size={index === 1 ? 132 : 96}
                className="relative"
                animate
                priority
              />
            </div>
          ))}
        </div>

        <h1 className="font-display text-4xl leading-none tracking-tight sm:text-6xl">
          Raise a <span className="text-gold">monster</span>,
          <br />
          climb the <span className="text-teal">tower</span>.
        </h1>

        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          Hatch Ragnarok mobs, feed them, train them, and take them into an endless
          tower. Every pet rolls its own rarity and individual stats — a Poring can
          grow up to be a legend.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/ranch"
            className="group inline-flex items-center gap-2 rounded-2xl bg-teal px-7 py-3.5 font-medium text-[#04211d] shadow-[0_18px_50px_-18px_rgba(58,215,192,.9)] transition hover:bg-teal/90"
          >
            Enter the ranch
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/bestiary"
            className="inline-flex items-center gap-2 rounded-2xl border border-line/80 px-7 py-3.5 text-sm text-muted transition hover:border-gold/40 hover:text-ink"
          >
            Browse all 2,675 mobs
          </Link>
        </div>

        <Link
          href="/transfer"
          className="mt-4 text-[11px] text-muted underline decoration-line/60 underline-offset-4 transition hover:text-ink"
        >
          Have a transfer code?
        </Link>

        <div className="mt-12 grid w-full max-w-2xl grid-cols-3 gap-3 text-left">
          {[
            ["6 skills", "Real Ragnarok kits; equip four of six"],
            ["5 rarities", "Individual values roll per pet, not per species"],
            ["2 modes", "Endless tower and async pet duels"],
          ].map(([title, body]) => (
            <div key={title} className="panel-flat px-3 py-3">
              <div className="font-display text-sm text-gold">{title}</div>
              <div className="mt-1 text-[11px] leading-snug text-muted">{body}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 px-6 pb-6 text-center text-[10px] leading-relaxed text-muted/70">
        Non-commercial fan project. Ragnarok Online assets are © Gravity Co., Ltd. &amp;
        Lee Myoungjin (studio DTDS). No game assets are redistributed — sprites are loaded
        at runtime from public community sources.
      </footer>
    </main>
  );
}
