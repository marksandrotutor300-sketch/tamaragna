"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Shield, Swords, UserPlus, Users } from "lucide-react";
import { Bar, Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { useMe } from "@/hooks/useGame";

type Detail = {
  guild: {
    id: string;
    name: string;
    tag: string;
    ownerId: string;
    description: string;
  };
  members: Array<{
    profileId: string;
    displayName: string;
    role: string;
    rating: number;
  }>;
  raid: {
    id: string;
    bossName: string;
    maxHp: number;
    hp: number;
    status: string;
    endsAt: string;
  } | null;
  contributions: Array<{
    profileId: string;
    displayName: string;
    damage: number;
    attacks: number;
  }>;
};

export default function GuildDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["guild", params.id],
    queryFn: () => api.get<Detail>(`/api/guilds/${params.id}`),
    refetchInterval: 4_000,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (success) setMessage(success);
      await queryClient.invalidateQueries({ queryKey: ["guild", params.id] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await refetch();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const myMembership = data.members.find((member) => member.profileId === me?.profile.id);
  const isLeader = myMembership?.role === "leader";
  const canRaid = isLeader || myMembership?.role === "officer";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/guild"
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" /> guild hall
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[10px] text-teal">{data.guild.tag}</div>
          <h1 className="flex items-center gap-2 font-display text-2xl">
            <Shield className="h-5 w-5 text-teal" /> {data.guild.name}
          </h1>
          <p className="text-xs text-muted">{data.guild.description || "A new guild."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!myMembership ? (
            <Button
              size="sm"
              onClick={() => void run(() => api.post(`/api/guilds/${data.guild.id}/join`), "Joined the guild.")}
              disabled={busy}
            >
              <UserPlus className="h-3.5 w-3.5" /> Join
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void run(() => api.post(`/api/guilds/${data.guild.id}/leave`), "Left the guild.")}
              disabled={busy || isLeader}
            >
              Leave
            </Button>
          )}
          {isLeader ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!window.confirm("Disband this guild for everyone?")) return;
                void run(async () => {
                  await api.del(`/api/guilds/${data.guild.id}`);
                  router.push("/guild");
                }, "Guild disbanded.");
              }}
              disabled={busy}
            >
              Disband
            </Button>
          ) : null}
        </div>
      </div>

      {message ? <p className="text-xs text-teal">{message}</p> : null}
      {error ? <p className="text-xs text-rose">{error}</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Panel>
          <SectionTitle hint={`${data.members.length}/20`}>Members</SectionTitle>
          <div className="space-y-1">
            {data.members.map((member) => (
              <div
                key={member.profileId}
                className="flex items-center justify-between rounded-lg border border-line/50 bg-black/20 px-2 py-1.5 text-xs"
              >
                <span className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted" />
                  {member.displayName}
                </span>
                <span className="text-[10px] text-muted">
                  {member.role} · {member.rating}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle hint={data.raid ? data.raid.status : "none"}>Guild raid</SectionTitle>
          {data.raid ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span>{data.raid.bossName}</span>
                <span className="text-muted">
                  {Math.max(0, data.raid.hp).toLocaleString()} / {data.raid.maxHp.toLocaleString()}
                </span>
              </div>
              <Bar
                value={data.raid.hp}
                max={data.raid.maxHp}
                color="#ff7a5c"
                className="mt-2"
                height={7}
              />
              <div className="mt-2 flex gap-2">
                {myMembership && data.raid.status === "active" ? (
                  <Button
                    size="sm"
                    variant="gold"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const result = await api.post<{ damage: number; defeated: boolean; rewards: { coins: number; materials: number } }>(
                          `/api/guilds/${data.guild.id}/raid/attack`,
                        );
                        setMessage(
                          `Dealt ${result.damage.toLocaleString()} damage. +${result.rewards.coins}c +${result.rewards.materials} materials${result.defeated ? " · Boss defeated!" : ""}`,
                        );
                      }, "")
                    }
                  >
                    <Swords className="h-3.5 w-3.5" /> Attack boss
                  </Button>
                ) : null}
                {canRaid && data.raid.status !== "active" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void run(() => api.post(`/api/guilds/${data.guild.id}/raid`), "New raid started.")}
                  >
                    Start new raid
                  </Button>
                ) : null}
              </div>
            </>
          ) : canRaid ? (
            <Button
              size="sm"
              onClick={() => void run(() => api.post(`/api/guilds/${data.guild.id}/raid`), "Raid started.")}
              disabled={busy}
            >
              <Swords className="h-3.5 w-3.5" /> Open weekly raid
            </Button>
          ) : (
            <p className="text-[11px] text-muted">No active raid. A leader or officer can open one.</p>
          )}
        </Panel>
      </div>

      {data.contributions.length > 0 ? (
        <Panel>
          <SectionTitle hint="this raid">Contribution</SectionTitle>
          <div className="space-y-1">
            {data.contributions.map((entry) => (
              <div key={entry.profileId} className="flex justify-between text-xs">
                <span>{entry.displayName}</span>
                <span className="text-muted">
                  {entry.damage.toLocaleString()} dmg · {entry.attacks} hits
                </span>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
