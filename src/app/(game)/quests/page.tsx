"use client";

import { CalendarDays, Check, Flame, Gift } from "lucide-react";
import { Bar, Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { useClaimQuest, useMe, useQuests } from "@/hooks/useGame";
import type { QuestView } from "@/lib/game/quests";
import { cn } from "@/lib/client/cn";

export default function QuestsPage() {
  const { data, isLoading } = useQuests();
  const { data: me } = useMe();
  const claim = useClaimQuest();

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const claimQuest = (quest: QuestView) => {
    claim.mutate({ kind: quest.kind, id: quest.id });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">daily & weekly</div>
          <h1 className="flex items-center gap-2 font-display text-2xl">
            <CalendarDays className="h-5 w-5 text-teal" /> Quests
          </h1>
          <p className="mt-1 text-xs text-muted">
            Daily objectives reset at midnight UTC. Weekly objectives reset on Monday UTC.
          </p>
        </div>
        {me ? (
          <div className="text-right text-[11px] text-muted">
            <div>{me.profile.coins.toLocaleString()} coins</div>
            <div>{me.profile.eggs} eggs</div>
          </div>
        ) : null}
      </div>

      <Panel className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-violet">
              <Flame className="h-3.5 w-3.5" /> login streak
            </div>
            <div className="mt-1 font-display text-3xl">
              {data.login.streak} day{data.login.streak === 1 ? "" : "s"}
            </div>
            <div className="text-[11px] text-muted">
              {data.login.claimable
                ? `Claim day ${data.login.nextStreak}: ${data.login.coins} coins${data.login.eggs ? ` + ${data.login.eggs} egg` : ""}.`
                : "Already claimed today. Come back tomorrow."}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted">today</div>
            <div className="text-xs">
              {data.login.coins}c{data.login.eggs ? ` · ${data.login.eggs} egg` : ""}
            </div>
          </div>
        </div>
        <Button
          variant="gold"
          size="sm"
          className="mt-3 w-full sm:w-auto"
          onClick={() => claim.mutate({ kind: "login" })}
          disabled={!data.login.claimable || claim.isPending}
        >
          <Gift className="h-4 w-4" />
          {claim.isPending ? "Claiming..." : data.login.claimable ? "Claim login reward" : "Claimed today"}
        </Button>
      </Panel>

      <QuestSection
        title="Daily"
        hint="resets midnight UTC"
        quests={data.daily}
        onClaim={claimQuest}
        pending={claim.isPending}
      />
      <QuestSection
        title="Weekly"
        hint="resets Monday UTC"
        quests={data.weekly}
        onClaim={claimQuest}
        pending={claim.isPending}
      />

      {claim.error ? (
        <p className="text-xs text-rose">{claim.error.message}</p>
      ) : null}
    </div>
  );
}

function QuestSection({
  title,
  hint,
  quests,
  onClaim,
  pending,
}: {
  title: string;
  hint: string;
  quests: QuestView[];
  onClaim: (quest: QuestView) => void;
  pending: boolean;
}) {
  return (
    <div>
      <SectionTitle hint={hint}>{title}</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {quests.map((quest) => (
          <div
            key={quest.id}
            className={cn(
              "rounded-xl border p-3 transition",
              quest.claimed
                ? "border-line/40 bg-black/10 opacity-60"
                : quest.completed
                  ? "border-teal/30 bg-teal/5"
                  : "border-line/60 bg-panel/40",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-sm">
                  {quest.name}
                  {quest.claimed ? <Check className="h-3.5 w-3.5 text-teal" /> : null}
                </div>
                <div className="text-[10px] text-muted">{quest.description}</div>
              </div>
              <span className="shrink-0 rounded-full border border-line/60 px-2 py-0.5 text-[10px] text-gold">
                {quest.coins}c{quest.eggs ? ` + ${quest.eggs}e` : ""}
              </span>
            </div>
            <div className="mt-2">
              <Bar
                value={quest.progress}
                max={quest.target}
                color={quest.completed ? "#3ad7c0" : "#8b9cb3"}
                height={4}
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
                <span>
                  {quest.progress}/{quest.target}
                </span>
                <button
                  onClick={() => onClaim(quest)}
                  disabled={!quest.completed || quest.claimed || pending}
                  className="rounded-lg border border-teal/30 px-2 py-0.5 text-teal transition hover:bg-teal/10 disabled:border-line/50 disabled:text-muted disabled:opacity-50"
                >
                  {quest.claimed ? "Claimed" : "Claim"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
