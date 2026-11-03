"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Layers, Play, Swords, Trophy } from "lucide-react";
import { Button, EmptyState, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { CardFace } from "@/components/cards/CardFace";
import { useCardHub, useStartCardRun } from "@/hooks/useCards";
import { cn } from "@/lib/client/cn";

export default function CardsPage() {
  const router = useRouter();
  const { data, isLoading } = useCardHub();
  const start = useStartCardRun();

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const active = data.activeRun;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">side game</div>
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <Layers className="h-5 w-5 text-gold" /> Rift Deck
        </h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
          Three ranch pets become three champions. Build a deck from their equipped skills,
          cross a seeded three-act map, and draft cards and relics between fights.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <Panel className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative">
            <SectionTitle hint={data.best ? `best ${data.best.score.toLocaleString()}` : "no completed runs"}>
              Your expedition
            </SectionTitle>

            {active ? (
              <div className="rounded-xl border border-teal/30 bg-teal/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-teal">
                      run in progress
                    </div>
                    <div className="font-display text-2xl">Act {active.act}</div>
                    <div className="text-[11px] text-muted">
                      {active.completedNodeIds.length} rooms · {active.runGold} gold ·{" "}
                      {active.deckCards.length} cards
                    </div>
                  </div>
                  <Swords className="h-8 w-8 text-teal/50" />
                </div>
                <Button className="mt-3 w-full" onClick={() => router.push(`/cards/run/${active.id}`)}>
                  <Play className="h-4 w-4" /> Resume run
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-line/60 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
                    <Swords className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm">No active expedition</div>
                    <div className="text-[11px] text-muted">
                      {data.canStart
                        ? "Your three team pets are ready."
                        : `Field three team pets to start (${data.teamSize}/3).`}
                    </div>
                  </div>
                </div>
                {data.canStart ? (
                  <Button
                    className="mt-3 w-full"
                    onClick={() => start.mutate(undefined, {
                      onSuccess: (response) => router.push(`/cards/run/${response.run.id}`),
                    })}
                    disabled={start.isPending}
                  >
                    <Play className="h-4 w-4" />
                    {start.isPending ? "Opening the rift…" : "Start a three-act run"}
                  </Button>
                ) : (
                  <Link href="/team">
                    <Button className="mt-3 w-full" variant="ghost">
                      Go to team <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
                {start.isError ? (
                  <p className="mt-2 text-[10px] text-rose">{(start.error as Error).message}</p>
                ) : null}
              </div>
            )}

            {active && active.deckCards.length > 0 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {active.deckCards.slice(0, 5).map((card) => (
                  <div key={card.instanceId} className="shrink-0">
                    <CardFace definition={card.definition} compact />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <SectionTitle hint="three acts">How it works</SectionTitle>
          <ul className="space-y-2 text-[11px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <span className="text-gold">01</span> Three team pets become champions. Their four
              equipped skills form the 12-card starter deck.
            </li>
            <li className="flex gap-2">
              <span className="text-gold">02</span> Turn-based energy combat. Play cards, spend
              energy, end turn, then survive visible enemy intents.
            </li>
            <li className="flex gap-2">
              <span className="text-gold">03</span> Cross 10–12 floors per act. Pick cards, relics,
              rest, shop, and events; reach the act boss.
            </li>
            <li className="flex gap-2">
              <span className="text-gold">04</span> A wipe ends the run. Clear all three acts for
              the best score and capped main-economy rewards.
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/cards/codex">
              <Button size="sm" variant="ghost">
                <BookOpen className="h-3.5 w-3.5" /> Card codex
              </Button>
            </Link>
            <Link href="/team">
              <Button size="sm" variant="ghost">
                Team & loadouts <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </Panel>
      </div>

      {data.best ? (
        <Panel>
          <SectionTitle hint="personal best">Best run</SectionTitle>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-display text-lg text-teal">{data.best.score.toLocaleString()}</span>
            <span className="text-muted">Act {data.best.act}</span>
            <span className="text-muted">{data.best.completedNodeIds.length} rooms</span>
            <span className="text-muted">{formatDuration(data.best.elapsedMs)}</span>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <SectionTitle hint="this season">Rift leaderboard</SectionTitle>
        {data.leaderboard.length === 0 ? (
          <EmptyState title="No clears yet" body="Be the first to finish all three acts." />
        ) : (
          <div className="divide-y divide-line/40">
            {data.leaderboard.map((entry) => (
              <div key={`${entry.rank}-${entry.displayName}`} className="flex items-center gap-3 py-2 text-sm">
                <span
                  className={cn(
                    "w-7 text-center font-display",
                    entry.rank === 1 && "text-gold",
                    entry.rank > 1 && "text-muted",
                  )}
                >
                  {entry.rank === 1 ? <Trophy className="mx-auto h-4 w-4" /> : entry.rank}
                </span>
                <span className="min-w-0 flex-1 truncate">{entry.displayName}</span>
                <span className="text-[10px] text-muted">{entry.rooms} rooms</span>
                <span className="font-display text-sm text-teal">
                  {entry.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  return `${minutes}m`;
}
