"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Castle, Crown, Gamepad2, Play, RotateCcw, Swords, Zap } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";

type Leaderboard = {
  activeRun: {
    id: string;
    wave: number;
    nextWave: number;
    highestWave: number;
    elapsedMs: number;
  } | null;
  best: { highestWave: number; elapsedMs: number } | null;
  leaderboard: Array<{
    rank: number;
    displayName: string;
    highestWave: number;
    elapsedMs: number;
  }>;
};

type StartResponse = {
  run: { id: string; wave: number; highestWave: number };
  battle: { battleId: string; boss: boolean } | null;
};

type DraftResponse = {
  pending: boolean;
  wave: number;
  options: Array<{ id: string; name: string; description: string }>;
  blessings: Array<{ wave: number; id: string; name: string }>;
};

export default function TowerPage() {
  const router = useRouter();
  const [auto, setAuto] = useState(true);
  const [selectedBlessing, setSelectedBlessing] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["tower-leaderboard"],
    queryFn: () => api.get<Leaderboard>("/api/tower/leaderboard"),
  });
  const activeRun = data?.activeRun ?? null;
  const draft = useQuery({
    queryKey: ["tower-draft", activeRun?.id, activeRun?.wave],
    queryFn: () => api.get<DraftResponse>(`/api/tower/${activeRun!.id}/draft`),
    enabled: Boolean(activeRun),
  });

  useEffect(() => {
    setSelectedBlessing(null);
  }, [activeRun?.id, activeRun?.wave]);

  const start = useMutation({
    mutationFn: () => api.post<StartResponse>("/api/tower/start", { auto }),
    onSuccess: (response) => {
      if (response.battle) {
        router.push(
          `/battle/${response.battle.battleId}?runId=${response.run.id}${response.battle.boss ? "&boss=1" : ""}`,
        );
      }
    },
  });

  const abandon = useMutation({
    mutationFn: (runId: string) => api.post(`/api/tower/${runId}/abandon`),
    onSuccess: () => window.location.reload(),
  });

  const resume = useMutation({
    mutationFn: (input: { runId: string; blessingId?: string }) =>
      api.post<{ run: { id: string }; battle: { battleId: string; boss: boolean } | null }>(
        `/api/tower/${input.runId}/next`,
        { auto, blessingId: input.blessingId },
      ),
    onSuccess: (response) => {
      if (response.battle) {
        router.push(
          `/battle/${response.battle.battleId}?runId=${response.run.id}${response.battle.boss ? "&boss=1" : ""}`,
        );
      }
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">endless</div>
        <h1 className="font-display text-2xl">Endless Tower</h1>
        <p className="mt-1 text-xs text-muted">
          Climb as far as your team can go. Every 10th wave is an MVP. Health carries
          between waves with a small heal.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative">
            <SectionTitle hint={data.best ? `best wave ${data.best.highestWave}` : "no runs yet"}>
              Your climb
            </SectionTitle>

            <button
              onClick={() => setAuto((value) => !value)}
              className={cn(
                "mb-3 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs transition",
                auto
                  ? "border-teal/30 bg-teal/5 text-teal"
                  : "border-gold/30 bg-gold/5 text-gold",
              )}
            >
              <span className="flex items-center gap-2">
                {auto ? <Zap className="h-3.5 w-3.5" /> : <Gamepad2 className="h-3.5 w-3.5" />}
                {auto ? "Auto-battle" : "Manual control"}
              </span>
              <span className="text-[10px] text-muted">
                {auto ? "skills fire automatically" : "you tap the four skills"}
              </span>
            </button>

            {data.activeRun ? (
              <div className="rounded-xl border border-teal/30 bg-teal/5 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-teal">
                      run in progress
                    </div>
                    <div className="font-display text-2xl">
                      Wave {data.activeRun.nextWave}
                    </div>
                    <div className="text-[11px] text-muted">
                      cleared {data.activeRun.wave} · highest{" "}
                      {data.activeRun.highestWave} ·{" "}
                      {Math.round(data.activeRun.elapsedMs / 1000)}s elapsed
                    </div>
                  </div>
                  <Castle className="h-8 w-8 text-teal/50" />
                </div>

                {draft.data?.blessings.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {draft.data.blessings.map((blessing) => (
                      <span
                        key={`${blessing.wave}-${blessing.id}`}
                        className="rounded-full border border-violet/30 bg-violet/10 px-2 py-0.5 text-[9px] text-violet"
                      >
                        {blessing.name} · W{blessing.wave}
                      </span>
                    ))}
                  </div>
                ) : null}

                {draft.data && !draft.data.pending && draft.data.options.length > 0 ? (
                  <div className="mt-3">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-gold">
                      Choose a blessing for wave {draft.data.wave}
                    </div>
                    <div className="mt-1 space-y-1.5">
                      {draft.data.options.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setSelectedBlessing(option.id)}
                          className={cn(
                            "w-full rounded-lg border px-2.5 py-2 text-left transition",
                            selectedBlessing === option.id
                              ? "border-gold/50 bg-gold/10"
                              : "border-line/60 bg-black/20 hover:border-white/20",
                          )}
                        >
                          <div className="text-xs text-ink">{option.name}</div>
                          <div className="text-[10px] text-muted">{option.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() =>
                      resume.mutate({
                        runId: data.activeRun!.id,
                        blessingId: selectedBlessing ?? undefined,
                      })
                    }
                    disabled={
                      resume.isPending ||
                      draft.isLoading ||
                      Boolean(
                        draft.data &&
                          !draft.data.pending &&
                          draft.data.options.length > 0 &&
                          !selectedBlessing,
                      )
                    }
                  >
                    <Play className="h-4 w-4" />
                    {resume.isPending
                      ? "Loading…"
                      : draft.data && !draft.data.pending && draft.data.options.length > 0
                        ? `Enter wave ${draft.data.wave}`
                        : "Resume climb"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => abandon.mutate(data.activeRun!.id)}
                    disabled={abandon.isPending}
                  >
                    <RotateCcw className="h-4 w-4" />
                    End
                  </Button>
                </div>
                {draft.isError ? (
                  <p className="mt-2 text-[10px] text-rose">Could not load the draft.</p>
                ) : null}
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-line/60 bg-black/20 p-4 text-center">
                  <Castle className="mx-auto h-10 w-10 text-muted/60" />
                  <div className="mt-2 text-sm">No active run</div>
                  <div className="text-[11px] text-muted">
                    Your team enters at full health.
                  </div>
                </div>
                <Button
                  className="mt-3 w-full"
                  onClick={() => start.mutate()}
                  disabled={start.isPending}
                >
                  <Swords className="h-4 w-4" />
                  {start.isPending ? "Opening the tower…" : "Start climb"}
                </Button>
              </>
            )}

            {start.isError ? (
              <p className="mt-2 text-xs text-rose">{(start.error as Error).message}</p>
            ) : null}
            {resume.isError ? (
              <p className="mt-2 text-xs text-rose">{(resume.error as Error).message}</p>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <SectionTitle hint="auto-battle">How it works</SectionTitle>
          <ul className="space-y-2 text-xs leading-relaxed text-muted">
            <li className="flex gap-2">
              <span className="text-gold">01</span> Waves scale in level, stats and team
              size. Wave 10, 20, 30… are MVPs.
            </li>
            <li className="flex gap-2">
              <span className="text-gold">02</span> Your team keeps its remaining HP
              between waves and heals 25% at the start of each one.
            </li>
            <li className="flex gap-2">
              <span className="text-gold">03</span> Every fifth wave is elite and every
              tenth is an MVP; elites carry affixes like Fierce or Tough. After each
              clear, pick one of three blessings for the next wave.
            </li>
            <li className="flex gap-2">
              <span className="text-gold">04</span> A wipe ends the run. Rewards are paid
              per cleared wave; eggs drop at 10, 25, 50, 100 and 200.
            </li>
            <li className="flex gap-2">
              <span className="text-gold">05</span> Every run is seeded server-side and
              replayed to verify the result.
            </li>
          </ul>
        </Panel>
      </div>

      <Panel>
        <SectionTitle hint="this season">Leaderboard</SectionTitle>
        {data.leaderboard.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            Nobody has finished a run yet. Be the first name on the board.
          </p>
        ) : (
          <div className="divide-y divide-line/40">
            {data.leaderboard.map((entry) => (
              <div
                key={`${entry.rank}-${entry.displayName}`}
                className="flex items-center gap-3 py-2 text-sm"
              >
                <span
                  className={cn(
                    "w-7 text-center font-display",
                    entry.rank === 1 && "text-gold",
                    entry.rank === 2 && "text-ink",
                    entry.rank === 3 && "text-[#c98b5e]",
                    entry.rank > 3 && "text-muted",
                  )}
                >
                  {entry.rank === 1 ? <Crown className="mx-auto h-4 w-4" /> : entry.rank}
                </span>
                <span className="min-w-0 flex-1 truncate">{entry.displayName}</span>
                <span className="text-xs text-muted">
                  {Math.round(entry.elapsedMs / 1000)}s
                </span>
                <span className="font-display text-sm text-teal">
                  wave {entry.highestWave}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
