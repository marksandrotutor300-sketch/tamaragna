import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ReplayViewer } from "@/components/battle/ReplayViewer";
import { isFeatureEnabled } from "@/lib/features";
import { getReplayByToken } from "@/lib/game/replays";

export const dynamic = "force-dynamic";

const getReplay = cache(getReplayByToken);

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const replay = await getReplay(token);
  if (!replay) return { title: "Replay not found", robots: { index: false } };

  const title = `${replay.sharedBy}'s duel replay`;
  const winner =
    replay.result.winner === "a"
      ? replay.payload.teamA[0]?.name
      : replay.result.winner === "b"
        ? replay.payload.teamB[0]?.name
        : "Draw";

  return {
    title,
    description: `${winner} · ${(replay.result.durationMs / 1000).toFixed(1)}s · TamaRagna replay`,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description: `${winner} · ${(replay.result.durationMs / 1000).toFixed(1)}s`,
      images: [`/replay/${token}/opengraph-image`],
    },
  };
}

export default async function ReplayPage({ params }: Props) {
  if (!isFeatureEnabled("share")) notFound();

  const { token } = await params;
  const replay = await getReplay(token);
  if (!replay) notFound();

  const winner =
    replay.result.winner === "a"
      ? replay.payload.teamA[0]?.name ?? "Team A"
      : replay.result.winner === "b"
        ? replay.payload.teamB[0]?.name ?? "Team B"
        : "Draw";

  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-base"
        >
          <Sparkles className="h-4 w-4 text-gold" />
          TamaRagna
        </Link>
        <Link
          href="/bestiary"
          className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-ink"
        >
          bestiary
        </Link>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-2 text-center">
        <div className="text-[10px] uppercase tracking-[0.24em] text-muted">
          shared replay
        </div>
        <h1 className="mt-1 font-display text-xl">
          {replay.sharedBy}&apos;s {winner} replay
        </h1>
        <p className="mt-1 text-[11px] text-muted">
          {replay.mode} · {(replay.result.durationMs / 1000).toFixed(1)}s ·{" "}
          {new Date(replay.createdAt).toLocaleDateString()}
        </p>
      </div>

      <ReplayViewer
        seed={replay.seed}
        payload={replay.payload}
        inputLog={replay.inputLog}
      />
    </main>
  );
}
