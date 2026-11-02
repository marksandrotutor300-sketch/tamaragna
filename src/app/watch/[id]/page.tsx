"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { Spinner } from "@/components/ui/primitives";
import { LiveArena } from "@/components/live/LiveArena";

export default function WatchPage() {
  const params = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pvp/live/${params.id}/spectate`, { method: "POST" })
      .then(async (response) => {
        const body = (await response.json()) as { ticket?: string; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Match unavailable");
        if (!cancelled) setTicket(body.ticket ?? null);
      })
      .catch((spectateError) => {
        if (!cancelled) {
          setError(
            spectateError instanceof Error
              ? spectateError.message
              : "Could not watch this match",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-base"
        >
          <Eye className="h-4 w-4 text-teal" />
          TamaRagna spectator
        </Link>
        <Link
          href="/pvp"
          className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-ink"
        >
          arena
        </Link>
      </header>
      <div className="mx-auto max-w-3xl px-4 pb-4 text-center">
        <h1 className="font-display text-xl">Live spectator</h1>
        <p className="mt-1 text-[10px] text-muted">
          The feed is delayed five seconds so players cannot use spectators to cheat.
        </p>
      </div>

      {error ? (
        <div className="mx-auto max-w-md py-16 text-center text-sm text-rose">
          {error}
        </div>
      ) : ticket ? (
        <LiveArena matchId={params.id} ticket={ticket} seat="spectator" />
      ) : (
        <div className="flex h-64 items-center justify-center text-muted">
          <Spinner className="h-6 w-6" />
        </div>
      )}
    </main>
  );
}
