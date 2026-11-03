"use client";

import { BedDouble, Crosshair, Crown, Gift, ShoppingBag, Skull, Sparkles, Swords } from "lucide-react";
import { nodeLabel } from "@/lib/cards/map";
import { cn } from "@/lib/client/cn";
import type { CardMap, CardNode, CardRunView } from "@/lib/cards/types";

const ICONS = {
  battle: Swords,
  elite: Skull,
  hunt: Crosshair,
  event: Sparkles,
  rest: BedDouble,
  shop: ShoppingBag,
  treasure: Gift,
  boss: Crown,
};

export function RunMap({
  map,
  run,
  available,
  onSelect,
  busy,
}: {
  map: CardMap;
  run: Pick<CardRunView, "act" | "nodeId" | "completedNodeIds" | "status">;
  available: CardNode[];
  onSelect: (nodeId: string) => void;
  busy?: boolean;
}) {
  const availableIds = new Set(available.map((node) => node.id));
  const completed = new Set(run.completedNodeIds);

  return (
    <div className="space-y-4">
      {map.acts.map((act) => {
        const floors = [...new Set(act.nodes.map((node) => node.floor))].sort((a, b) => a - b);
        const active = run.act === act.act;
        return (
          <section
            key={act.act}
            className={cn(
              "rounded-2xl border p-3",
              active ? "border-teal/40 bg-teal/5" : "border-line/50 bg-black/10 opacity-75",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                Act {act.act}
              </div>
              <div className="font-display text-sm">{act.name}</div>
              {active ? (
                <span className="rounded-full border border-teal/40 px-2 py-0.5 text-[9px] text-teal">
                  current
                </span>
              ) : null}
            </div>

            <div className="mt-3 space-y-1.5">
              {floors.map((floor) => {
                const nodes = act.nodes.filter((node) => node.floor === floor);
                return (
                  <div key={floor} className="flex min-h-9 items-center gap-1.5">
                    <span className="w-6 shrink-0 text-right text-[8px] tabular-nums text-muted/60">
                      {floor}
                    </span>
                    <div className="flex flex-1 gap-1.5">
                      {nodes.map((node) => {
                        const Icon = ICONS[node.type];
                        const isAvailable = availableIds.has(node.id);
                        const isCompleted = completed.has(node.id);
                        const isCurrent = run.nodeId === node.id;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            disabled={!isAvailable || busy}
                            onClick={() => onSelect(node.id)}
                            title={`${nodeLabel(node.type)} · floor ${floor}`}
                            className={cn(
                              "flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border text-[9px] transition",
                              isCompleted && "border-line/30 bg-black/20 text-muted/50",
                              isCurrent && "border-gold/50 bg-gold/10 text-gold",
                              isAvailable &&
                                "border-teal/50 bg-teal/10 text-teal hover:border-teal hover:bg-teal/20",
                              !isAvailable &&
                                !isCompleted &&
                                !isCurrent &&
                                "border-line/30 bg-black/10 text-muted/40",
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{nodeLabel(node.type)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
