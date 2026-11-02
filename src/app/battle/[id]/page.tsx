"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy } from "lucide-react";
import { BattleStage } from "@/components/battle/BattleStage";
import { ShareReplayButton } from "@/components/battle/ShareReplayButton";
import { Button, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import type { BattleResult, CombatantInit } from "@/lib/sim/types";

type BattleResponse = {
  battleId: string;
  mode: "practice" | "tower" | "pvp";
  seed: string;
  payload: {
    teamA: CombatantInit[];
    teamB: CombatantInit[];
    ai: { a: boolean; b: boolean };
    maxMs?: number;
    wave?: number;
  };
  status: string;
  result: BattleResult | null;
  resultHash: string | null;
};

export default function BattlePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-muted">
          <Spinner className="h-6 w-6" />
        </div>
      }
    >
      <BattlePageInner />
    </Suspense>
  );
}

function BattlePageInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const runId = search.get("runId") ?? undefined;
  const boss = search.get("boss") === "1";

  const { data, isLoading, error } = useQuery({
    queryKey: ["battle", params.id],
    queryFn: () => api.get<BattleResponse>(`/api/battle/${params.id}`),
    enabled: Boolean(params.id),
    refetchOnMount: "always",
  });

  if (isLoading || !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        {error ? "Battle not found." : <Spinner className="h-6 w-6" />}
      </div>
    );
  }

  if (data.status === "complete" || !data.payload?.teamA?.length) {
    return <CompletedBattle data={data} />;
  }

  return (
    <BattleStage
      battleId={data.battleId}
      seed={data.seed}
      payload={data.payload}
      mode={data.mode}
      boss={boss}
      runId={runId}
    />
  );
}

function CompletedBattle({ data }: { data: BattleResponse }) {
  const result = data.result;
  const won = result?.winner === "a";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full border ${
          won
            ? "border-teal/40 bg-teal/10 text-teal"
            : "border-rose/40 bg-rose/10 text-rose"
        }`}
      >
        <Trophy className="h-7 w-7" />
      </div>
      <h1 className="font-display text-2xl">
        {result ? (won ? "Victory" : result.winner === "draw" ? "Draw" : "Defeat") : "Battle finished"}
      </h1>
      {result ? (
        <p className="text-xs text-muted">
          {result.reason === "timeout" ? "Time ran out" : "Team wiped"} ·{" "}
          {(result.durationMs / 1000).toFixed(1)}s
        </p>
      ) : null}
      <p className="text-xs text-muted">This battle has already been resolved.</p>
      {result ? <ShareReplayButton battleId={data.battleId} /> : null}
      <Link href={data.mode === "tower" ? "/tower" : data.mode === "pvp" ? "/pvp" : "/ranch"}>
        <Button variant="ghost">
          <ArrowLeft className="h-4 w-4" />
          {data.mode === "tower" ? "Back to tower" : data.mode === "pvp" ? "Back to arena" : "Back to ranch"}
        </Button>
      </Link>
    </div>
  );
}
