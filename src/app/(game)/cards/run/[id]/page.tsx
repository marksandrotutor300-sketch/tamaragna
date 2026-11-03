"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Coins, Layers, RotateCcw, Swords } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { CardFace } from "@/components/cards/CardFace";
import { RunMap } from "@/components/cards/RunMap";
import {
  EventPanel,
  RestPanel,
  RewardPanel,
  RunResult,
  ShopPanel,
} from "@/components/cards/RunPanels";
import { useAbandonCardRun, useCardEvent, useCardRun, useClaimCardReward, useEnterCardNode, useRestCardRun, useShopCardRun, useStartCardRun } from "@/hooks/useCards";
import { getEdict } from "@/lib/cards/content/edicts";
import { getRiftPath } from "@/lib/cards/content/paths";
import { cn } from "@/lib/client/cn";

export default function CardRunPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const router = useRouter();
  const { data, isLoading } = useCardRun(runId);
  const enter = useEnterCardNode(runId);
  const claim = useClaimCardReward(runId);
  const rest = useRestCardRun(runId);
  const shop = useShopCardRun(runId);
  const event = useCardEvent(runId);
  const abandon = useAbandonCardRun(runId);
  const start = useStartCardRun();

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const run = data.run;
  const busy =
    enter.isPending || claim.isPending || rest.isPending || shop.isPending || event.isPending;

  if (run.status === "won" || run.status === "lost" || run.status === "abandoned") {
    if (run.pending?.kind === "reward") {
      return (
        <div className="space-y-4">
          <Header runId={runId} act={run.act} />
          <RewardPanel
            pending={run.pending}
            busy={claim.isPending}
            onCard={(id) => claim.mutate({ choice: "card", id })}
            onRelic={(id) => claim.mutate({ choice: "relic", id })}
            onSkip={() => claim.mutate({ choice: "skip" })}
          />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <Header runId={runId} act={run.act} />
        <RunResult
          run={run}
          busy={start.isPending}
          onRestart={() =>
            start.mutate(undefined, {
              onSuccess: (response) => router.push(`/cards/run/${response.run.id}`),
            })
          }
        />
      </div>
    );
  }

  const pending = run.pending;

  return (
    <div className="space-y-4">
      <Header runId={runId} act={run.act} />

      <div className="grid gap-3 sm:grid-cols-4">
        <Hud icon={<Layers className="h-3.5 w-3.5 text-teal" />} label="Act" value={`${run.act}/3`} />
        <Hud icon={<Coins className="h-3.5 w-3.5 text-gold" />} label="Run gold" value={run.runGold} />
        <Hud icon={<Swords className="h-3.5 w-3.5 text-violet" />} label="Rooms" value={run.completedNodeIds.length} />
        <Hud icon={<RotateCcw className="h-3.5 w-3.5 text-muted" />} label="Score" value={run.score.toLocaleString()} />
      </div>

      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-1 text-gold">
          A{run.ascension}
        </span>
        <span className="rounded-full border border-teal/30 bg-teal/10 px-2 py-1 text-teal">
          {getRiftPath(run.path).name}
        </span>
        {run.edicts.map((id) => {
          const edict = getEdict(id);
          return edict ? (
            <span
              key={id}
              title={edict.description}
              className="rounded-full border border-violet/30 bg-violet/10 px-2 py-1 text-violet"
            >
              {edict.name}
            </span>
          ) : null;
        })}
      </div>

      {run.relicDefinitions.length > 0 ? (
        <Panel>
          <SectionTitle hint={`${run.relicDefinitions.length} relics`}>Relics</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {run.relicDefinitions.map((relic) => (
              <span
                key={relic.id}
                title={relic.description}
                className="rounded-full border border-gold/30 bg-gold/10 px-2 py-1 text-[10px] text-gold"
              >
                {relic.name}
              </span>
            ))}
          </div>
        </Panel>
      ) : null}

      {pending?.kind === "reward" ? (
        <RewardPanel
          pending={pending}
          busy={claim.isPending}
          onCard={(id) => claim.mutate({ choice: "card", id })}
          onRelic={(id) => claim.mutate({ choice: "relic", id })}
          onSkip={() => claim.mutate({ choice: "skip" })}
        />
      ) : null}

      {pending?.kind === "rest" ? (
        <RestPanel
          run={run}
          busy={rest.isPending}
          onHeal={() => rest.mutate({ choice: "heal" })}
          onUpgrade={(instanceId) => rest.mutate({ choice: "upgrade", instanceId })}
          onSignature={(instanceId) => rest.mutate({ choice: "signature", instanceId })}
        />
      ) : null}

      {pending?.kind === "shop" ? (
        <ShopPanel
          pending={pending}
          run={run}
          busy={shop.isPending}
          onBuy={(kind, id) => shop.mutate({ action: "buy", kind, id })}
          onRemove={(instanceId) => shop.mutate({ action: "remove", instanceId })}
          onEvolve={(relicId) => shop.mutate({ action: "evolve", relicId })}
          onLeave={() => shop.mutate({ action: "leave" })}
        />
      ) : null}

      {pending?.kind === "event" ? (
        <EventPanel
          pending={pending}
          busy={event.isPending}
          onChoose={(choiceId) => event.mutate(choiceId)}
        />
      ) : null}

      <Panel>
        <SectionTitle hint={pending ? "resolve the current node" : "choose your path"}>
          The rift map
        </SectionTitle>
        <RunMap
          map={run.map}
          run={run}
          available={pending ? [] : run.availableNodes}
          busy={busy || Boolean(pending)}
          onSelect={(nodeId) =>
            enter.mutate(nodeId, {
              onSuccess: (response) => {
                if (response.battle) {
                  router.push(`/cards/battle/${response.battle.id}`);
                }
              },
            })
          }
        />
      </Panel>

      <Panel>
        <SectionTitle hint={`${run.deckCards.length}/40 cards`}>Deck</SectionTitle>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {run.deckCards.map((card) => (
            <CardFace key={card.instanceId} definition={card.definition} compact />
          ))}
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (window.confirm("Abandon this run? No main rewards will be granted.")) {
              abandon.mutate();
            }
          }}
          disabled={abandon.isPending}
        >
          Abandon run
        </Button>
        {enter.isError ? <span className="text-[10px] text-rose">{(enter.error as Error).message}</span> : null}
        {claim.isError ? <span className="text-[10px] text-rose">{(claim.error as Error).message}</span> : null}
        {rest.isError ? <span className="text-[10px] text-rose">{(rest.error as Error).message}</span> : null}
        {shop.isError ? <span className="text-[10px] text-rose">{(shop.error as Error).message}</span> : null}
        {event.isError ? <span className="text-[10px] text-rose">{(event.error as Error).message}</span> : null}
      </div>
    </div>
  );
}

function Header({ runId, act }: { runId: string; act: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">rift deck · act {act}</div>
        <h1 className="font-display text-2xl">The expedition</h1>
      </div>
      <div className="flex gap-2">
        <Link href="/cards">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="h-3.5 w-3.5" /> Rift Deck
          </Button>
        </Link>
        <span className="hidden rounded-lg border border-line/50 px-2 py-1 text-[9px] text-muted sm:block">
          run {runId.slice(0, 8)}
        </span>
      </div>
    </div>
  );
}

function Hud({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-line/60 bg-panel/40 px-3 py-2")}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-muted">
        {icon} {label}
      </div>
      <div className="mt-0.5 font-display text-sm">{value}</div>
    </div>
  );
}
