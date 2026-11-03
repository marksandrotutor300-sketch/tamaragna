"use client";

import { cn } from "@/lib/client/cn";
import { elementColor, elementName } from "@/lib/game/elements";
import type { CardDefinition } from "@/lib/cards/types";
import type { CardRuneId } from "@/lib/cards/types";
import { getRune } from "@/lib/cards/content/runes";

const RARITY: Record<string, string> = {
  starter: "border-line/80",
  common: "border-[#9aa8b7]/60",
  uncommon: "border-teal/60",
  rare: "border-gold/70",
  epic: "border-violet/80",
};

export function CardFace({
  definition,
  championElement = 0,
  selected = false,
  disabled = false,
  onClick,
  compact = false,
  rune,
}: {
  definition: CardDefinition;
  championElement?: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  compact?: boolean;
  rune?: CardRuneId;
}) {
  const element = (definition.element ?? championElement) as 0;
  const color = elementColor(element);
  const signature = definition.name.endsWith("++");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${definition.name} — ${definition.description}`}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-xl border bg-panel-2/80 text-left transition",
        compact ? "h-24 w-28 p-2" : "h-48 w-36 p-2.5",
        RARITY[definition.rarity] ?? "border-line/70",
        selected && "ring-2 ring-gold/80 -translate-y-1",
        disabled && "opacity-45",
        onClick && "hover:-translate-y-1 hover:border-teal/70",
      )}
    >
      <div
        className="absolute inset-0 opacity-25"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${color}55, transparent 68%)`,
        }}
      />
      <div className="relative flex items-start justify-between gap-1">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums"
          style={{ color, borderColor: `${color}77`, background: `${color}18` }}
        >
          {definition.cost}
        </span>
        <span className="rounded-full border border-line/60 bg-black/30 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em] text-muted">
          {definition.type}
        </span>
      </div>

      <div className="relative mt-1 flex h-12 items-center justify-center">
        {definition.iconId ? (
          <img
            src={`/api/icon/skill/${definition.iconId}`}
            alt=""
            width={34}
            height={34}
            className="rounded-lg border border-black/40"
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
          />
        ) : (
          <span className="font-display text-2xl" style={{ color }}>
            {definition.name.slice(0, 1)}
          </span>
        )}
      </div>

      <div className={cn("relative font-display leading-tight", compact ? "text-[10px]" : "text-xs")}>
        {definition.name}
      </div>
      {!compact ? (
        <p className="relative mt-1 line-clamp-4 text-[9px] leading-snug text-muted">
          {definition.description}
        </p>
      ) : null}
      <div className="absolute inset-x-2 bottom-1.5 flex items-center justify-between text-[8px] text-muted">
        <span style={{ color }}>{elementName(element)}</span>
        <span className="uppercase tracking-[0.12em]">
          {signature ? "signature" : definition.rarity}
        </span>
      </div>
      {signature ? (
        <span className="absolute right-1.5 top-7 rounded-full border border-gold/50 bg-gold/15 px-1.5 py-0.5 text-[7px] uppercase tracking-[0.12em] text-gold">
          sig
        </span>
      ) : null}
      {rune ? (
        <span
          title={getRune(rune)?.description}
          className="absolute left-1.5 top-7 rounded-full border border-violet/50 bg-violet/15 px-1.5 py-0.5 text-[7px] uppercase tracking-[0.12em] text-violet"
        >
          {rune}
        </span>
      ) : null}
    </button>
  );
}
