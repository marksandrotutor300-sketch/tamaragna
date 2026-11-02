"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Swords, Users } from "lucide-react";
import { Button, Panel, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";

type QueueResponse = {
  matched: boolean;
  waiting?: boolean;
  matchId?: string;
  seat?: "a" | "b";
  ticket?: string;
  message?: string;
};

export default function LiveQueuePage() {
  const router = useRouter();
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const enter = (response: QueueResponse) => {
    if (!response.matchId || !response.ticket || !response.seat) return false;
    stopPolling();
    router.push(
      `/pvp/live/${response.matchId}?ticket=${encodeURIComponent(response.ticket)}&seat=${response.seat}`,
    );
    return true;
  };

  const poll = async () => {
    try {
      const response = await api.get<QueueResponse>("/api/pvp/live/queue");
      if (enter(response)) return;
      setWaiting(Boolean(response.waiting));
      if (!response.waiting) {
        stopPolling();
      }
    } catch (pollError) {
      setError(pollError instanceof Error ? pollError.message : "Queue polling failed");
      stopPolling();
      setWaiting(false);
    }
  };

  const find = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<QueueResponse>("/api/pvp/live/queue");
      if (enter(response)) return;
      setWaiting(true);
      timerRef.current = window.setInterval(() => void poll(), 1200);
    } catch (queueError) {
      setError(queueError instanceof Error ? queueError.message : "Could not join the queue");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    stopPolling();
    setWaiting(false);
    try {
      await api.del("/api/pvp/live/queue");
    } catch {
      // Ignore cancellation errors.
    }
  };

  useEffect(() => {
    void poll();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/pvp"
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" /> arena
      </Link>

      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">real-time</div>
        <h1 className="font-display text-2xl">Live duel</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          A server-authoritative match. Both trainers send skills in real time; reconnect
          by refreshing. The match runs for up to three minutes.
        </p>
      </div>

      <Panel className="text-center">
        {waiting ? (
          <div className="py-8">
            <Spinner className="mx-auto h-7 w-7" />
            <div className="mt-3 text-sm">Searching for an opponent…</div>
            <div className="mt-1 text-[10px] text-muted">
              Keep this tab open. A matched opponent opens automatically.
            </div>
            <Button className="mt-4" size="sm" variant="ghost" onClick={cancel}>
              Cancel queue
            </Button>
          </div>
        ) : (
          <div className="py-8">
            <Swords className="mx-auto h-8 w-8 text-teal" />
            <div className="mt-3 text-sm">Ready when you are.</div>
            <div className="mt-1 text-[10px] text-muted">
              Your current team and their mastered skills are used.
            </div>
            <Button className="mt-4" onClick={find} disabled={busy}>
              <Swords className="h-4 w-4" />
              {busy ? "Joining…" : "Find a live duel"}
            </Button>
          </div>
        )}
        {error ? <p className="mt-2 text-xs text-rose">{error}</p> : null}
      </Panel>

      <Link href="/tournaments" className="block">
        <Panel className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" /> Tournaments
          </span>
          <span className="text-[10px] text-muted">brackets & live matches</span>
        </Panel>
      </Link>
    </div>
  );
}
