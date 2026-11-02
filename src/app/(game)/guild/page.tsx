"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, Shield } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { useMe } from "@/hooks/useGame";

type Guild = {
  id: string;
  name: string;
  tag: string;
  description: string;
  members: number;
};

export default function GuildPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["guilds"],
    queryFn: () => api.get<{ guilds: Guild[]; myGuildId: string | null }>("/api/guilds"),
  });
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ guild: Guild }>("/api/guilds", {
        name: name.trim(),
        tag: tag.trim(),
        description: description.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["guilds"] });
      router.push(`/guild/${result.guild.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create guild");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">social</div>
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <Shield className="h-5 w-5 text-teal" /> Guild hall
        </h1>
        <p className="mt-1 text-xs text-muted">
          One guild per trainer. Members share a weekly raid boss and contribution board.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-2">
          {data?.guilds.map((guild) => (
            <Link key={guild.id} href={`/guild/${guild.id}`}>
              <Panel className="flex items-center justify-between transition hover:border-teal/40">
                <div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="rounded bg-teal/10 px-1.5 py-0.5 text-[10px] text-teal">
                      {guild.tag}
                    </span>
                    {guild.name}
                  </div>
                  <div className="text-[10px] text-muted">
                    {guild.members}/20 members · {guild.description || "No description"}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Panel>
            </Link>
          ))}
          {data?.guilds.length === 0 ? (
            <Panel className="py-8 text-center text-xs text-muted">
              No guilds yet. Found the first one.
            </Panel>
          ) : null}
        </div>
      )}

      {!data?.myGuildId ? (
        <Panel>
          <SectionTitle hint="500 coins">Found a guild</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Guild name"
              className="rounded-lg border border-line bg-black/30 px-2 py-2 text-xs outline-none focus:border-teal/50"
            />
            <input
              value={tag}
              onChange={(event) => setTag(event.target.value.toUpperCase())}
              placeholder="TAG"
              maxLength={5}
              className="rounded-lg border border-line bg-black/30 px-2 py-2 text-xs uppercase outline-none focus:border-teal/50"
            />
          </div>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="A short description"
            maxLength={160}
            className="mt-2 w-full rounded-lg border border-line bg-black/30 px-2 py-2 text-xs outline-none focus:border-teal/50"
          />
          <Button
            className="mt-2"
            size="sm"
            onClick={() => void create()}
            disabled={busy || name.trim().length < 3 || tag.trim().length < 2 || (me?.profile.coins ?? 0) < 500}
          >
            <Plus className="h-3.5 w-3.5" /> {busy ? "Founding..." : "Found guild"}
          </Button>
          {error ? <p className="mt-2 text-[10px] text-rose">{error}</p> : null}
        </Panel>
      ) : null}
    </div>
  );
}
