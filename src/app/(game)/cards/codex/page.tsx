"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Search } from "lucide-react";
import { CardFace } from "@/components/cards/CardFace";
import { Button, Panel, SectionTitle } from "@/components/ui/primitives";
import { allCards } from "@/lib/cards/content/cards";
import { elementName } from "@/lib/game/elements";

export default function CardCodexPage() {
  const cards = useMemo(() => allCards().sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name)), []);
  const [query, setQuery] = useState("");
  const [element, setElement] = useState<number | "all">("all");
  const [type, setType] = useState<"all" | "attack" | "skill">("all");

  const filtered = cards.filter((card) => {
    if (query && !`${card.name} ${card.description}`.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }
    if (element !== "all" && card.element !== null && card.element !== element) return false;
    if (type !== "all" && card.type !== type) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">rift deck</div>
          <h1 className="flex items-center gap-2 font-display text-2xl">
            <BookOpen className="h-5 w-5 text-gold" /> Card codex
          </h1>
        </div>
        <Link href="/cards">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="h-3.5 w-3.5" /> Rift Deck
          </Button>
        </Link>
      </div>

      <Panel>
        <SectionTitle hint={`${filtered.length} cards`}>Filters</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-line/60 bg-black/20 px-2">
            <Search className="h-3.5 w-3.5 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cards"
              className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none"
            />
          </label>
          <select
            value={element}
            onChange={(event) =>
              setElement(event.target.value === "all" ? "all" : Number(event.target.value))
            }
            className="rounded-xl border border-line/60 bg-panel-2/70 px-2 py-2 text-xs"
          >
            <option value="all">All elements</option>
            {Array.from({ length: 10 }).map((_, index) => (
              <option key={index} value={index}>
                {elementName(index as 0)}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
            className="rounded-xl border border-line/60 bg-panel-2/70 px-2 py-2 text-xs"
          >
            <option value="all">All types</option>
            <option value="attack">Attacks</option>
            <option value="skill">Skills</option>
          </select>
        </div>
      </Panel>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((card) => (
          <div key={card.id} className="flex gap-2 rounded-2xl border border-line/50 bg-black/10 p-2">
            <CardFace definition={card} compact />
            <div className="min-w-0 py-1">
              <div className="text-xs">{card.name}</div>
              <div className="mt-1 text-[10px] leading-relaxed text-muted">{card.description}</div>
              <div className="mt-2 flex flex-wrap gap-1 text-[8px] uppercase tracking-[0.12em] text-muted">
                <span>{card.rarity}</span>
                <span>·</span>
                <span>{card.element === null ? "champion" : elementName(card.element)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
