"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Battery, Shield, Swords, Zap } from "lucide-react";
import { Bar, Button, Panel } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { CardFace } from "@/components/cards/CardFace";
import { useCardAction, useCardBattle } from "@/hooks/useCards";
import { cardForInstance } from "@/lib/cards/content/cards";
import { getEdict } from "@/lib/cards/content/edicts";
import { elementColor, elementName } from "@/lib/game/elements";
import { cn } from "@/lib/client/cn";
import type { CardBattleState, CardChampion, CardDefinition, CardEnemy } from "@/lib/cards/types";

export default function CardBattlePage() {
  const params = useParams<{ id: string }>();
  const battleId = params.id;
  const { data, isLoading } = useCardBattle(battleId);
  const battle = data?.battle;
  const action = useCardAction(battleId, battle?.runId ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading || !battle) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <span className="animate-pulse">Opening the rift…</span>
      </div>
    );
  }

  const state = battle.state;
  const selected = state.hand.find((card) => card.instanceId === selectedId);
  const selectedCard = selected ? cardForInstance(selected.cardId, selected.upgraded, selected.signature) : undefined;
  const targetMode: "enemy" | "ally" | null =
    selectedCard?.target === "enemy" || selectedCard?.target === "randomEnemy"
      ? "enemy"
      : selectedCard?.target === "ally"
        ? "ally"
        : null;

  const play = (instanceId: string, targetId?: string) => {
    if (!selected && !instanceId) return;
    action.mutate(
      {
        version: battle.version,
        action: { kind: "playCard", instanceId, targetId },
      },
      { onSuccess: () => setSelectedId(null) },
    );
  };

  const chooseCard = (instanceId: string) => {
    const instance = state.hand.find((card) => card.instanceId === instanceId);
    if (!instance) return;
    const definition = cardForInstance(instance.cardId, instance.upgraded, instance.signature);
    if (!definition) return;
    const owner = state.champions.find((champion) => champion.petId === instance.ownerPetId);
    if (!owner || owner.hp <= 0) return;
    if (definition.target === "enemy" || definition.target === "ally") {
      setSelectedId(instanceId);
      return;
    }
    play(instanceId);
  };

  const onEnemy = (enemy: CardEnemy) => {
    if (targetMode !== "enemy" || !selected) return;
    play(selected.instanceId, enemy.id);
  };

  const onChampion = (champion: CardChampion) => {
    if (targetMode !== "ally" || !selected) return;
    play(selected.instanceId, champion.petId);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-3 pb-4 pt-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={`/cards/run/${battle.runId}`}>
            <Button size="sm" variant="ghost">
              <ArrowLeft className="h-3.5 w-3.5" /> Run
            </Button>
          </Link>
          <span className="rounded-lg border border-line/60 bg-panel/60 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted">
            Rift Deck · turn {state.turn}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-lg border border-teal/30 bg-teal/10 px-2 py-1 text-[11px] text-teal">
            <Battery className="h-3.5 w-3.5" /> {state.energy}/{state.maxEnergy}
          </span>
          <span className="text-[10px] text-muted">
            draw {state.drawPile.length} · discard {state.discardPile.length}
          </span>
        </div>
      </header>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_260px]">
        <div className="space-y-3">
          <Panel className="bg-black/25">
            <div className="flex items-end justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.16em] text-rose">
                enemies
              </span>
              <span className="text-[10px] text-muted">
                {targetMode === "enemy" ? "choose an enemy target" : "visible intents"}
              </span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {state.enemies.map((enemy) => (
                <button
                  key={enemy.id}
                  type="button"
                  onClick={() => onEnemy(enemy)}
                  disabled={targetMode !== "enemy" || enemy.hp <= 0 || action.isPending}
                  className={cn(
                    "relative rounded-xl border p-2 text-left transition",
                    enemy.hp <= 0
                      ? "border-line/30 opacity-35"
                      : "border-rose/25 bg-rose/5 hover:border-rose/60",
                    targetMode === "enemy" && enemy.hp > 0 && "cursor-crosshair ring-1 ring-rose/30",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <PetSprite speciesId={enemy.speciesId} size={48} animate={false} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs">{enemy.name}</div>
                      <div className="text-[9px] text-muted">
                        {elementName(enemy.element)} · {intentText(enemy.intent)}
                      </div>
                      <Bar
                        value={enemy.hp}
                        max={enemy.maxHp}
                        color="#ff7a7a"
                        height={4}
                        className="mt-1"
                      />
                      <div className="mt-0.5 flex justify-between text-[9px] text-muted">
                        <span>{Math.max(0, enemy.hp)}</span>
                        <span>{enemy.maxHp}</span>
                      </div>
                    </div>
                  </div>
                  {enemy.block > 0 ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-[9px] text-teal">
                      <Shield className="h-3 w-3" /> {enemy.block}
                    </span>
                  ) : null}
                  <StatusRow statuses={enemy.statuses} />
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="bg-black/20">
            <div className="flex items-end justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.16em] text-teal">champions</span>
              <span className="text-[10px] text-muted">
                {targetMode === "ally" ? "choose an ally target" : "pet skills become cards"}
              </span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {state.champions.map((champion) => (
                <button
                  key={champion.petId}
                  type="button"
                  onClick={() => onChampion(champion)}
                  disabled={targetMode !== "ally" || champion.hp <= 0 || action.isPending}
                  className={cn(
                    "rounded-xl border p-2 text-left transition",
                    champion.hp <= 0
                      ? "border-line/30 opacity-40"
                      : "border-teal/25 bg-teal/5",
                    targetMode === "ally" && champion.hp > 0 && "ring-1 ring-teal/40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <PetSprite speciesId={champion.speciesId} size={42} animate={false} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs">{champion.name}</div>
                      <div className="text-[9px]" style={{ color: elementColor(champion.element) }}>
                        {elementName(champion.element)}
                      </div>
                      <Bar value={champion.hp} max={champion.maxHp} height={4} className="mt-1" />
                      <div className="mt-0.5 flex justify-between text-[9px] text-muted">
                        <span>{Math.max(0, champion.hp)}</span>
                        <span>{champion.maxHp}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[9px] text-teal">
                    <Shield className="h-3 w-3" /> {champion.block}
                  </div>
                  <StatusRow statuses={champion.statuses} />
                </button>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.16em] text-gold">hand</span>
              <span className="text-[10px] text-muted">
                {selectedCard
                  ? `${selectedCard.name} · ${selectedCard.cost} energy`
                  : "tap a card to play"}
              </span>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
              {state.hand.map((instance) => {
                const definition = cardForInstance(instance.cardId, instance.upgraded, instance.signature);
                if (!definition) return null;
                const owner = state.champions.find(
                  (champion) => champion.petId === instance.ownerPetId,
                );
                const disabled =
                  action.isPending ||
                  state.phase !== "player" ||
                  state.energy < definition.cost ||
                  !owner ||
                  owner.hp <= 0 ||
                  owner.statuses.some((status) => status.kind === "stun");
                return (
                  <CardFace
                    key={instance.instanceId}
                    definition={definition}
                    championElement={owner?.element ?? 0}
                    selected={selectedId === instance.instanceId}
                    disabled={disabled}
                    onClick={() => chooseCard(instance.instanceId)}
                    rune={instance.rune}
                  />
                );
              })}
              {state.hand.length === 0 ? (
                <div className="flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-line/50 text-xs text-muted">
                  Hand empty.
                </div>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] text-muted">
                <Zap className="h-3.5 w-3.5 text-gold" />
                {selectedCard?.description ?? "Play cards, then end your turn."}
              </div>
              <Button
                size="sm"
                onClick={() =>
                  action.mutate({ version: battle.version, action: { kind: "endTurn" } })
                }
                disabled={action.isPending || state.phase !== "player"}
              >
                <Swords className="h-3.5 w-3.5" /> End turn
              </Button>
            </div>
            {action.isError ? (
              <p className="mt-2 text-[10px] text-rose">{(action.error as Error).message}</p>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted">Edicts</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {state.edicts.length > 0 ? (
                state.edicts.map((id) => {
                  const edict = getEdict(id);
                  return edict ? (
                    <span
                      key={id}
                      title={edict.description}
                      className="rounded-full border border-violet/30 bg-violet/10 px-2 py-0.5 text-[9px] text-violet"
                    >
                      {edict.name}
                    </span>
                  ) : null;
                })
              ) : (
                <span className="text-[10px] text-muted">No run edicts.</span>
              )}
            </div>
          </Panel>
          <Panel>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted">Relics</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {state.relics.length > 0 ? (
                state.relics.map((relic) => (
                  <span
                    key={relic}
                    className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[9px] text-gold"
                  >
                    {relic}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-muted">No relics yet.</span>
              )}
            </div>
          </Panel>
          <Panel>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted">Battle log</div>
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto font-mono text-[9px] leading-relaxed text-muted">
              {state.events.slice(-18).map((event, index) => (
                <div key={`${event.type}-${index}`}>
                  <span className="text-muted/50">{event.type}</span> {event.text}
                </div>
              ))}
            </div>
          </Panel>
          <Link href={`/cards/run/${battle.runId}`}>
            <Button variant="ghost" size="sm" className="w-full">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to run
            </Button>
          </Link>
        </div>
      </div>

      {battle.status !== "pending" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-sm p-5 text-center">
            <h2 className="font-display text-2xl">
              {battle.status === "complete" ? "Battle won" : "Battle lost"}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {battle.status === "complete"
                ? "The rift opens. Claim your reward and choose the next path."
                : "The squad is down. The run ends here."}
            </p>
            <Link href={`/cards/run/${battle.runId}`}>
              <Button className="mt-4 w-full">Return to run</Button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusRow({ statuses }: { statuses: CardBattleState["champions"][number]["statuses"] }) {
  if (!statuses.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {statuses.map((status) => (
        <span
          key={`${status.kind}-${status.remaining}`}
          className="rounded-full border border-line/60 px-1.5 py-0.5 text-[8px] text-muted"
        >
          {status.kind} {status.remaining}
        </span>
      ))}
    </div>
  );
}

function intentText(intent: CardEnemy["intent"]) {
  switch (intent.kind) {
    case "attack":
      return `attack ${intent.power}%${intent.hits && intent.hits > 1 ? `×${intent.hits}` : ""}`;
    case "block":
      return `block ${intent.amount}`;
    case "buff":
      return `buff ${intent.status}`;
    case "debuff":
      return `debuff ${intent.status}`;
  }
}
