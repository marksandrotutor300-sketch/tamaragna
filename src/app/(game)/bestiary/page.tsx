"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles } from "lucide-react";
import { Button, Pill, Spinner } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { useMe } from "@/hooks/useGame";
import { api } from "@/lib/client/api";
import { ELEMENT_COLORS, ELEMENT_NAMES } from "@/lib/game/elements";
import { RARITY } from "@/lib/game/rarity";
import type { Rarity } from "@/lib/game/types";
import { cn } from "@/lib/client/cn";

type Summary = {
  id: number;
  name: string;
  tier: Rarity;
  element: number;
  raceName: string;
  sizeName: string;
  level: number;
  mvp: boolean;
  boss: boolean;
  hasSpawn: boolean;
};

type Response = {
  total: number;
  page: number;
  pages: number;
  species: Summary[];
};

export default function BestiaryPage() {
  const { data: me } = useMe();
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState(0);
  const [element, setElement] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["bestiary", query, tier, element, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (query.trim()) params.set("q", query.trim());
      if (tier > 0) params.set("tier", String(tier));
      if (element !== null) params.set("element", String(element));
      return api.get<Response>(`/api/bestiary?${params.toString()}`);
    },
  });

  const owned = new Set((me?.pets ?? []).map((pet) => pet.speciesId));

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">codex</div>
        <h1 className="font-display text-2xl">Bestiary</h1>
        <p className="mt-1 text-xs text-muted">
          Every monster you can hatch, with its real Ragnarok element, race and skill kit.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or ID"
            className="w-full rounded-xl border border-line/70 bg-panel/60 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-teal/50"
          />
        </div>
        <select
          value={tier}
          onChange={(event) => {
            setTier(Number(event.target.value));
            setPage(1);
          }}
          className="rounded-xl border border-line/70 bg-panel/60 px-3 py-2.5 text-sm outline-none focus:border-teal/50"
        >
          <option value={0}>All tiers</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {RARITY[value as Rarity].name}
            </option>
          ))}
        </select>
        <select
          value={element ?? ""}
          onChange={(event) => {
            setElement(event.target.value === "" ? null : Number(event.target.value));
            setPage(1);
          }}
          className="rounded-xl border border-line/70 bg-panel/60 px-3 py-2.5 text-sm outline-none focus:border-teal/50"
        >
          <option value="">All elements</option>
          {ELEMENT_NAMES.map((name, index) => (
            <option key={name} value={index}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {isLoading || !data ? (
        <div className="flex h-64 items-center justify-center text-muted">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{data.total.toLocaleString()} species</span>
            <span>
              page {data.page} / {data.pages}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {data.species.map((species) => (
              <Link
                key={species.id}
                href={`/bestiary/${species.id}`}
                className="group relative overflow-hidden rounded-xl border border-line/60 bg-panel/40 p-2 transition hover:border-white/20"
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-16 opacity-40"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, ${ELEMENT_COLORS[species.element]}33, transparent 70%)`,
                  }}
                />
                <div className="relative flex items-center gap-2">
                  <PetSprite
                    speciesId={species.id}
                    size={48}
                    animate={false}
                    className="transition group-hover:scale-105"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-xs">{species.name}</span>
                      {owned.has(species.id) ? (
                        <Sparkles className="h-3 w-3 shrink-0 text-gold" />
                      ) : null}
                    </div>
                    <div className="text-[10px] text-muted">
                      #{species.id} · Lv {species.level}
                    </div>
                  </div>
                </div>
                <div className="relative mt-2 flex flex-wrap gap-1">
                  <Pill color={RARITY[species.tier].color}>{RARITY[species.tier].name}</Pill>
                  <Pill color={ELEMENT_COLORS[species.element]}>
                    {ELEMENT_NAMES[species.element]}
                  </Pill>
                  {species.mvp ? <Pill color="#ffc94a">MVP</Pill> : null}
                </div>
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted">
              {page} / {data.pages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= data.pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
