"use client";

import { cn } from "@/lib/client/cn";
import { RARITY } from "@/lib/game/rarity";
import type { Rarity } from "@/lib/game/types";

export function RarityFrame({
  rarity,
  children,
  className,
  active = false,
}: {
  rarity: Rarity;
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}) {
  const info = RARITY[rarity];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border transition",
        active ? "border-white/25" : "border-line/70",
        className,
      )}
      style={{
        background: `radial-gradient(120% 90% at 50% 0%, ${info.glow} 0%, rgba(10,14,20,0.9) 62%)`,
        boxShadow: active ? `0 0 34px -10px ${info.glow}` : undefined,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${info.color}, transparent)` }}
      />
      {children}
    </div>
  );
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const info = RARITY[rarity];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: info.color, background: `${info.color}18`, border: `1px solid ${info.color}44` }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: info.color, boxShadow: `0 0 8px ${info.color}` }}
      />
      {info.name}
    </span>
  );
}
