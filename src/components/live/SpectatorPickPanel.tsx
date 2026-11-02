"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { Button, Panel } from "@/components/ui/primitives";

export function SpectatorPickPanel({
  matchId,
  players,
}: {
  matchId: string;
  players: {
    a: { profileId: string; displayName: string };
    b: { profileId: string; displayName: string };
  };
}) {
  const [counts, setCounts] = useState({ a: 0, b: 0, total: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const response = await fetch(`/api/pvp/live/${matchId}/pick`);
      if (response.ok) {
        setCounts((await response.json()) as typeof counts);
      }
    } catch {
      // The arena still works if the crowd endpoint is unavailable.
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const pick = async (pickId: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/pvp/live/${matchId}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not record pick");
      setMessage("Pick locked in. +10 spectator points if correct.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not record pick");
    } finally {
      setBusy(false);
    }
  };

  const percentA = counts.total > 0 ? Math.round((counts.a / counts.total) * 100) : 0;
  const percentB = counts.total > 0 ? Math.round((counts.b / counts.total) * 100) : 0;

  return (
    <Panel>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted">
        <Eye className="h-3.5 w-3.5 text-gold" /> spectator picks
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["a", "b"] as const).map((side) => (
          <Button
            key={side}
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void pick(players[side].profileId)}
            className="justify-between"
          >
            <span className="truncate">{players[side].displayName}</span>
            <span className="text-[10px] text-muted">
              {side === "a" ? percentA : percentB}%
            </span>
          </Button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted">
        {counts.total} picks · correct picks earn 10 spectator points.
      </p>
      {message ? <p className="mt-1 text-[10px] text-teal">{message}</p> : null}
    </Panel>
  );
}
