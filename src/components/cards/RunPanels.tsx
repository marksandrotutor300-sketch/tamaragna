"use client";

import { ArrowRight, Coins, RotateCcw, Sparkles, Star, Upload } from "lucide-react";
import { Button, Panel, SectionTitle } from "@/components/ui/primitives";
import { CardFace } from "@/components/cards/CardFace";
import { getCard } from "@/lib/cards/content/cards";
import { getRelic, isEvolvedRelic, isSetRelic } from "@/lib/cards/content/relics";
import { allRunes } from "@/lib/cards/content/runes";
import { getRiftPath } from "@/lib/cards/content/paths";
import { getContract } from "@/lib/cards/content/contracts";
import { cn } from "@/lib/client/cn";
import type { CardRunView, CardRewardOption, PendingNode } from "@/lib/cards/types";

export function RewardPanel({
  pending,
  busy,
  onCard,
  onRelic,
  onSkip,
}: {
  pending: Extract<PendingNode, { kind: "reward" }>;
  busy: boolean;
  onCard: (id: string) => void;
  onRelic: (id: string) => void;
  onSkip: () => void;
}) {
  return (
    <Panel>
      <SectionTitle hint="choose one">Battle reward</SectionTitle>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {pending.options.map((option) => {
          const card = getCard(option.id);
          return card ? (
            <CardFace
              key={option.id}
              definition={card}
              onClick={() => onCard(option.id)}
              disabled={busy}
              compact
            />
          ) : null;
        })}
      </div>
      {pending.relic ? (
        <button
          type="button"
          onClick={() => onRelic(pending.relic!.id)}
          disabled={busy}
          className="mt-3 flex w-full items-center gap-3 rounded-xl border border-gold/40 bg-gold/5 p-3 text-left transition hover:border-gold/70"
        >
          <Star className="h-4 w-4 text-gold" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-gold">{pending.relic.name}</span>
            <span className="block text-[10px] text-muted">{pending.relic.description}</span>
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-gold" />
        </button>
      ) : null}
      <Button variant="ghost" size="sm" className="mt-3" onClick={onSkip} disabled={busy}>
        Skip reward
      </Button>
    </Panel>
  );
}

export function RestPanel({
  run,
  busy,
  onHeal,
  onUpgrade,
  onSignature,
  onAscend,
}: {
  run: CardRunView;
  busy: boolean;
  onHeal: () => void;
  onUpgrade: (instanceId: string) => void;
  onSignature: (instanceId: string) => void;
  onAscend: (petId: string) => void;
}) {
  const hasAscended = run.champions.some((champion) => champion.ascended);
  const duplicateCards = run.deckCards.filter(
    (card) =>
      !card.signature &&
      run.deckCards.filter((entry) => entry.cardId === card.cardId).length > 1,
  );
  return (
    <Panel>
      <SectionTitle hint="choose one">Rest site</SectionTitle>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onHeal} disabled={busy}>
          <Sparkles className="h-3.5 w-3.5" /> Heal 30%
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const first = run.deckCards.find((card) => !card.upgraded && !card.signature);
            if (first) onUpgrade(first.instanceId);
          }}
          disabled={busy || !run.deckCards.some((card) => !card.upgraded && !card.signature)}
        >
          <Upload className="h-3.5 w-3.5" /> Upgrade first unupgraded
        </Button>
        {!hasAscended ? (
          <Button
            size="sm"
            variant="gold"
            onClick={() => {
              const first = run.champions.find((champion) => champion.hp > 0);
              if (first) onAscend(first.petId);
            }}
            disabled={busy || !run.champions.some((champion) => champion.hp > 0)}
          >
            <Star className="h-3.5 w-3.5" /> Ascend first champion
          </Button>
        ) : null}
      </div>
      {!hasAscended ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {run.champions
            .filter((champion) => champion.hp > 0)
            .map((champion) => (
              <button
                key={champion.petId}
                type="button"
                onClick={() => onAscend(champion.petId)}
                disabled={busy}
                className="rounded-lg border border-gold/30 bg-gold/10 px-2 py-1 text-[9px] text-gold disabled:opacity-40"
              >
                Ascend {champion.name}
              </button>
            ))}
        </div>
      ) : (
        <p className="mt-2 text-[9px] text-gold">A champion has already ascended this run.</p>
      )}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {run.deckCards
          .filter((card) => !card.upgraded && !card.signature)
          .map((card) => (
            <CardFace
              key={card.instanceId}
              definition={card.definition}
              onClick={() => onUpgrade(card.instanceId)}
              disabled={busy}
              compact
            />
          ))}
      </div>
      {duplicateCards.length > 0 ? (
        <div className="mt-3 rounded-xl border border-gold/30 bg-gold/5 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-gold">
            Signature forge
          </div>
          <p className="mt-1 text-[10px] text-muted">
            Consume a duplicate copy to turn one card into a stronger Signature.
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {[...new Map(duplicateCards.map((card) => [card.cardId, card])).values()].map((card) => (
              <CardFace
                key={card.instanceId}
                definition={card.definition}
                onClick={() => onSignature(card.instanceId)}
                disabled={busy}
                compact
              />
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

export function ShopPanel({
  pending,
  run,
  busy,
  onBuy,
  onRemove,
  onEvolve,
  onInscribe,
  onLeave,
}: {
  pending: Extract<PendingNode, { kind: "shop" }>;
  run: CardRunView;
  busy: boolean;
  onBuy: (kind: "card" | "relic", id: string) => void;
  onRemove: (instanceId: string) => void;
  onEvolve: (relicId: string) => void;
  onInscribe: (instanceId: string, runeId: string) => void;
  onLeave: () => void;
}) {
  const removeTarget = pending.removalCost;
  const path = getRiftPath(run.path);
  const discount = Math.min(
    0.5,
    path.shopDiscount +
      run.relics.reduce(
        (sum, id) => sum + (getRelic(id)?.effect.shopDiscount ?? 0),
        0,
      ),
  );
  const evolveCost = Math.round(100 * (1 - discount));
  const evolvable = run.relics.filter((id) => !isEvolvedRelic(id) && !isSetRelic(id));
  return (
    <Panel>
      <SectionTitle hint={`${run.runGold} gold`}>Rift market</SectionTitle>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {pending.cards.map((option) => {
          const card = getCard(option.id);
          return card ? (
            <div key={option.id} className="shrink-0">
              <CardFace
                definition={card}
                onClick={() => onBuy("card", option.id)}
                disabled={busy || run.runGold < (option.price ?? 60)}
                compact
              />
              <div className="mt-1 text-center text-[9px] text-gold">{option.price ?? 60}g</div>
            </div>
          ) : null;
        })}
      </div>
      {pending.relic ? (
        <button
          type="button"
          onClick={() => onBuy("relic", pending.relic!.id)}
          disabled={busy || run.runGold < (pending.relic.price ?? 120)}
          className="mt-3 flex w-full items-center gap-3 rounded-xl border border-gold/40 bg-gold/5 p-3 text-left disabled:opacity-40"
        >
          <Star className="h-4 w-4 text-gold" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-gold">{pending.relic.name}</span>
            <span className="block text-[10px] text-muted">{pending.relic.description}</span>
          </span>
          <span className="text-[10px] text-gold">{pending.relic.price ?? 120}g</span>
        </button>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-muted">Remove a card for {removeTarget}g:</span>
        {run.runGold >= removeTarget ? (
          <select
            defaultValue=""
            disabled={busy}
            onChange={(event) => {
              if (event.target.value) onRemove(event.target.value);
            }}
            className="max-w-52 rounded-lg border border-rose/30 bg-panel-2/70 px-2 py-1 text-[10px] text-rose"
          >
            <option value="">Choose a card…</option>
            {run.deckCards.map((card) => (
              <option key={card.instanceId} value={card.instanceId}>
                {card.definition.name}
              </option>
            ))}
          </select>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onLeave} disabled={busy}>
          Leave
        </Button>
      </div>
      {evolvable.length > 0 ? (
        <div className="mt-3 rounded-xl border border-gold/30 bg-gold/5 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-gold">
            Signature relic forge · {evolveCost}g
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {evolvable.map((id) => {
              const relic = getRelic(id);
              return relic ? (
                <button
                  key={id}
                  type="button"
                  onClick={() => onEvolve(id)}
                  disabled={busy || run.runGold < evolveCost}
                  className="rounded-full border border-gold/30 bg-black/20 px-2 py-1 text-[9px] text-gold transition hover:border-gold/70 disabled:opacity-40"
                  title={relic.description}
                >
                  {relic.name} +
                </button>
              ) : null;
            })}
          </div>
        </div>
      ) : null}
      <div className="mt-3 rounded-xl border border-violet/30 bg-violet/5 p-3">
        <div className="text-[10px] uppercase tracking-[0.14em] text-violet">
          Rune inscriber · 60g
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            id="rune-card"
            defaultValue=""
            disabled={busy}
            className="max-w-44 rounded-lg border border-line/60 bg-panel-2/70 px-2 py-1 text-[10px]"
          >
            <option value="">Choose card…</option>
            {run.deckCards
              .filter((card) => !card.rune)
              .map((card) => (
                <option key={card.instanceId} value={card.instanceId}>
                  {card.definition.name}
                </option>
              ))}
          </select>
          <select
            id="rune-type"
            defaultValue="ember"
            disabled={busy}
            className="max-w-40 rounded-lg border border-line/60 bg-panel-2/70 px-2 py-1 text-[10px]"
          >
            {allRunes().map((rune) => (
              <option key={rune.id} value={rune.id}>
                {rune.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || run.runGold < 60}
            onClick={() => {
              const card = document.querySelector<HTMLSelectElement>("#rune-card");
              const rune = document.querySelector<HTMLSelectElement>("#rune-type");
              if (card?.value && rune?.value) onInscribe(card.value, rune.value);
            }}
          >
            Inscribe
          </Button>
        </div>
      </div>
    </Panel>
  );
}

export function ContractsPanel({
  run,
  busy,
  onClaim,
}: {
  run: CardRunView;
  busy: boolean;
  onClaim: (contractId: string) => void;
}) {
  if (!run.contracts.length) return null;
  return (
    <Panel>
      <SectionTitle hint="optional">Rift contracts</SectionTitle>
      <div className="space-y-2">
        {run.contracts.map((contract) => {
          const definition = getContract(contract.id);
          if (!definition) return null;
          return (
            <div
              key={contract.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2",
                contract.claimed
                  ? "border-line/40 bg-black/20 opacity-60"
                  : contract.completed
                    ? "border-teal/40 bg-teal/5"
                    : contract.failed
                      ? "border-rose/30 bg-rose/5"
                      : "border-line/60 bg-black/20",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs">{definition.name}</span>
                  <span className="text-[9px] text-gold">+{contract.rewardGold}g</span>
                </div>
                <div className="text-[10px] text-muted">{definition.description}</div>
                <div className="mt-1 text-[9px] text-muted">
                  {contract.failed
                    ? "failed"
                    : `${Math.min(contract.progress, definition.target)}/${definition.target}`}
                </div>
              </div>
              {contract.completed && !contract.claimed ? (
                <Button size="sm" variant="gold" onClick={() => onClaim(contract.id)} disabled={busy}>
                  Claim
                </Button>
              ) : contract.claimed ? (
                <span className="text-[9px] text-teal">claimed</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function EventPanel({
  pending,
  busy,
  onChoose,
}: {
  pending: Extract<PendingNode, { kind: "event" }>;
  busy: boolean;
  onChoose: (choiceId: string) => void;
}) {
  return (
    <Panel>
      <SectionTitle hint="choose one">{pending.title}</SectionTitle>
      <p className="text-xs leading-relaxed text-muted">{pending.body}</p>
      <div className="mt-3 space-y-2">
        {pending.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChoose(option.id)}
            disabled={busy}
            className={cn(
              "w-full rounded-xl border border-line/60 bg-black/20 px-3 py-2 text-left transition",
              "hover:border-teal/50 hover:bg-teal/5 disabled:opacity-40",
            )}
          >
            <div className="text-xs text-ink">{option.label}</div>
            <div className="text-[10px] text-muted">{option.description}</div>
          </button>
        ))}
      </div>
    </Panel>
  );
}

export function RunResult({
  run,
  onRestart,
  busy,
}: {
  run: CardRunView;
  onRestart: () => void;
  busy: boolean;
}) {
  const won = run.status === "won";
  return (
    <Panel className="text-center">
      <div
        className={cn(
          "mx-auto flex h-16 w-16 items-center justify-center rounded-full border",
          won ? "border-gold/40 bg-gold/10 text-gold" : "border-rose/40 bg-rose/10 text-rose",
        )}
      >
        <Coins className="h-7 w-7" />
      </div>
      <h2 className="mt-3 font-display text-2xl">{won ? "Rift conquered" : "Run ended"}</h2>
      <p className="mt-1 text-xs text-muted">
        Score {run.score.toLocaleString()} · {run.completedNodeIds.length} rooms · Act {run.act}
      </p>
      <div className="mt-3 flex justify-center gap-2">
        <Button variant="ghost" onClick={onRestart} disabled={busy}>
          <RotateCcw className="h-4 w-4" /> New run
        </Button>
      </div>
    </Panel>
  );
}
