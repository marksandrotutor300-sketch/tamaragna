"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Dumbbell,
  Gamepad2,
  Moon,
  Palette,
  Sun,
  Utensils,
  Heart,
  Zap,
  ChevronRight,
  Layers,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Bar, Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { NatureBadge, StarPips } from "@/components/pet/Genetics";
import { RarityBadge, RarityFrame } from "@/components/pet/RarityFrame";
import { StatRadar, IvPips } from "@/components/pet/StatRadar";
import { teamPets, useCareAction, useMe } from "@/hooks/useGame";
import { CARE_COSTS, careMood } from "@/lib/game/care";
import { HABITATS, getHabitat } from "@/lib/game/habitats";
import { api } from "@/lib/client/api";
import { elementColor, elementName } from "@/lib/game/elements";
import { natureById } from "@/lib/game/nature";
import type { CareAction } from "@/lib/game/types";
import { cn } from "@/lib/client/cn";

const MOOD_COPY: Record<string, string> = {
  happy: "beaming",
  content: "content",
  hungry: "hungry",
  tired: "sleepy",
  sad: "lonely",
};

export default function RanchPage() {
  const { data, isLoading } = useMe();
  const care = useCareAction();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [habitatBusy, setHabitatBusy] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const team = teamPets(data.pets);
  const pet = team.find((entry) => entry.id === selectedId) ?? team[0];

  if (!pet) {
    return (
      <div className="mx-auto max-w-md pt-10 text-center">
        <div className="mb-4 flex justify-center">
          <PetSprite speciesId={1002} size={140} />
        </div>
        <h1 className="font-display text-2xl">Your ranch is empty</h1>
        <p className="mt-2 text-sm text-muted">
          Hatch an egg to meet your first monster. It will join a free team slot
          automatically.
        </p>
        <Link href="/hatch" className="mt-5 inline-block">
          <Button variant="gold">Go to the hatchery</Button>
        </Link>
      </div>
    );
  }

  const mood = careMood(pet.care);
  const run = (action: CareAction) => {
    care.mutate(
      { petId: pet.id, action },
      {
        onSuccess: (result) => {
          setFlash(
            action === "feed"
              ? `${pet.nickname} devours it happily.`
              : action === "play"
                ? `${pet.nickname} bounces around.`
                : action === "train"
                  ? `${pet.nickname} trains hard. +EXP`
                  : action === "rest"
                    ? `${pet.nickname} curls up to sleep.`
                    : `${pet.nickname} wakes up.`,
          );
          window.setTimeout(() => setFlash(null), 2200);
          void result;
        },
        onError: (error) => {
          setFlash(error.message);
          window.setTimeout(() => setFlash(null), 2600);
        },
      },
    );
  };

  const busy = care.isPending;

  const changeHabitat = async (habitatId: string) => {
    setHabitatBusy(true);
    setFlash(null);
    try {
      await api.patch("/api/account/habitat", { habitat: habitatId });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setFlash("Ranch habitat changed.");
    } catch (error) {
      setFlash(error instanceof Error ? error.message : "Could not change habitat");
    } finally {
      setHabitatBusy(false);
    }
  };

  const habitat = getHabitat(data.profile.habitat);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">the ranch</div>
          <h1 className="font-display text-2xl">Good to see you</h1>
        </div>
        <div className="flex gap-2">
          {team.length === 3 ? (
            <Link href="/cards">
              <Button variant="ghost" size="sm">
                <Layers className="h-4 w-4" /> Rift Deck
              </Button>
            </Link>
          ) : null}
          {team.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setSelectedId(entry.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-2 py-1.5 text-xs transition",
                entry.id === pet.id
                  ? "border-teal/50 bg-teal/10 text-teal"
                  : "border-line/70 text-muted hover:border-white/20",
              )}
            >
              <PetSprite speciesId={entry.speciesId} size={26} animate={false} />
              <span className="hidden sm:inline">{entry.nickname}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <RarityFrame rarity={pet.rarity} active className="relative p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl leading-none">{pet.nickname}</h2>
                <RarityBadge rarity={pet.rarity} />
                <StarPips star={pet.star} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span>
                  {pet.species.name} · Lv {pet.level} · {pet.power.toLocaleString()} power
                </span>
                <NatureBadge nature={pet.nature} />
              </div>
              <div className="mt-0.5 text-[10px] text-muted">
                {natureById(pet.nature).description}
              </div>
            </div>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px]"
              style={{
                color: elementColor(pet.species.element),
                borderColor: `${elementColor(pet.species.element)}55`,
                background: `${elementColor(pet.species.element)}12`,
              }}
            >
              {elementName(pet.species.element)} {pet.species.elementLevel}
            </span>
          </div>

          <div className="relative mt-3 flex h-64 items-center justify-center rounded-2xl border border-white/5 bg-black/20">
            <div
              className="pointer-events-none absolute h-44 w-44 rounded-full blur-3xl"
              style={{ background: `${elementColor(pet.species.element)}22` }}
            />
            <PetSprite
              speciesId={pet.speciesId}
              size={210}
              priority
              className={pet.care.sleeping ? "opacity-70" : undefined}
            />
            {pet.care.sleeping ? (
              <span className="absolute right-4 top-4 rounded-full bg-violet/20 px-2 py-0.5 text-[10px] text-violet">
                asleep
              </span>
            ) : null}
            <span className="absolute bottom-3 left-4 text-[10px] uppercase tracking-[0.18em] text-muted">
              {MOOD_COPY[mood]}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <CareBar label="Hunger" value={pet.care.hunger} color="#ffc94a" />
            <CareBar label="Mood" value={pet.care.mood} color="#ff7a7a" />
            <CareBar label="Energy" value={pet.care.energy} color="#3ad7c0" />
            <CareBar label="Friendship" value={pet.care.friendship} color="#b57bff" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Action
              icon={<Utensils className="h-4 w-4" />}
              label="Feed"
              cost={CARE_COSTS.feed}
              disabled={busy}
              onClick={() => run("feed")}
            />
            <Action
              icon={<Gamepad2 className="h-4 w-4" />}
              label="Play"
              cost={CARE_COSTS.play}
              disabled={busy}
              onClick={() => run("play")}
            />
            <Action
              icon={<Dumbbell className="h-4 w-4" />}
              label="Train"
              cost={CARE_COSTS.train}
              disabled={busy}
              onClick={() => run("train")}
            />
            <Action
              icon={
                pet.care.sleeping ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
              }
              label={pet.care.sleeping ? "Wake" : "Rest"}
              cost={0}
              disabled={busy}
              onClick={() => run(pet.care.sleeping ? "wake" : "rest")}
            />
          </div>

          {flash ? (
            <div className="mt-3 rounded-lg border border-teal/30 bg-teal/10 px-3 py-2 text-xs text-teal">
              {flash}
            </div>
          ) : null}

          <CareEffects care={pet.care} />
        </RarityFrame>

        <div className="space-y-4">
          <Panel>
            <SectionTitle hint={`IV total ${Object.values(pet.ivs).reduce((a, b) => a + b, 0)}/186`}>
              Individual values
            </SectionTitle>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <StatRadar ivs={pet.ivs} />
              <div className="w-full flex-1 space-y-2">
                <StatLine label="HP" value={pet.stats.hpMax} />
                <StatLine label="ATK" value={pet.stats.atk} />
                <StatLine label="DEF" value={pet.stats.def} />
                <StatLine label="ASPD" value={`${(1000 / pet.stats.aspdMs).toFixed(2)}/s`} />
                <StatLine label="CRIT" value={`${(pet.stats.critChance * 100).toFixed(0)}%`} />
                <StatLine
                  label="RESIST"
                  value={`${Math.round(pet.stats.statusResist * 100)}%`}
                />
              </div>
            </div>
            <div className="mt-3">
              <IvPips ivs={pet.ivs} />
            </div>
          </Panel>

          <Panel>
            <SectionTitle hint={`${data.profile.materials} materials`}>
              <span className="inline-flex items-center gap-1">
                <Palette className="h-3.5 w-3.5" style={{ color: habitat.accent }} /> Habitat
              </span>
            </SectionTitle>
            <p className="text-[10px] text-muted">{habitat.name} · {habitat.description}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {HABITATS.map((entry) => {
                const active = entry.id === data.profile.habitat;
                const affordable = data.profile.materials >= entry.cost;
                return (
                  <button
                    key={entry.id}
                    disabled={active || habitatBusy || !affordable}
                    onClick={() => void changeHabitat(entry.id)}
                    className={`rounded-xl border p-2 text-left text-xs transition disabled:opacity-50 ${
                      active
                        ? "border-teal/40 bg-teal/10"
                        : "border-line/60 bg-black/20 hover:border-white/20"
                    }`}
                  >
                    <span style={{ color: entry.accent }}>{entry.name}</span>
                    <div className="text-[10px] text-muted">
                      {entry.cost > 0 ? `${entry.cost} materials` : "free"}
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <SectionTitle hint={`${pet.species.raceName} · ${pet.species.sizeName}`}>Skills</SectionTitle>
            <div className="space-y-2">
              {pet.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-center gap-3 rounded-xl border border-line/60 bg-black/20 px-3 py-2"
                >
                  {/* skill icon comes from the RO icon proxy */}
                  <img
                    src={`/api/icon/skill/${skill.id}`}
                    alt=""
                    width={28}
                    height={28}
                    className="rounded-md border border-black/40"
                    onError={(event) => {
                      event.currentTarget.style.visibility = "hidden";
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm">{skill.displayName}</span>
                      <span className="text-[10px] text-muted">Lv {skill.level}</span>
                    </div>
                    <div className="text-[10px] text-muted">
                      {skill.kind} · {elementName(skill.element)} · {skill.hits} hit
                      {skill.hits > 1 ? "s" : ""} · {(skill.cooldownMs / 1000).toFixed(1)}s
                    </div>
                  </div>
                  <span className="font-display text-sm text-gold">{skill.power}%</span>
                </div>
              ))}
            </div>
            <Link
              href="/team"
              className="mt-3 flex items-center justify-between rounded-xl border border-line/60 px-3 py-2 text-xs text-muted transition hover:border-teal/40 hover:text-teal"
            >
              Manage team and storage
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/breed"
              className="mt-2 flex items-center justify-between rounded-xl border border-line/60 px-3 py-2 text-xs text-muted transition hover:border-violet/40 hover:text-violet"
            >
              Breeding and genetics
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CareBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-line/60 bg-black/20 px-2.5 py-2">
      <div className="flex items-center justify-between text-[10px] text-muted">
        <span>{label}</span>
        <span className="tabular-nums text-ink">{Math.round(value)}</span>
      </div>
      <Bar value={value} max={100} color={color} className="mt-1.5" height={4} />
    </div>
  );
}

function Action({
  icon,
  label,
  cost,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  cost: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-center gap-1 rounded-xl border border-line/70 bg-black/20 px-2 py-2.5 text-xs transition hover:border-teal/40 hover:bg-teal/5 disabled:opacity-40"
    >
      <span className="text-muted group-hover:text-teal">{icon}</span>
      <span>{label}</span>
      <span className="text-[10px] text-muted">{cost > 0 ? `${cost}c` : "free"}</span>
    </button>
  );
}

function StatLine({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between border-b border-line/40 pb-1.5 text-xs last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-display text-sm">{value}</span>
    </div>
  );
}

function CareEffects({
  care,
}: {
  care: { hunger: number; mood: number; friendship: number };
}) {
  const effects: Array<{ icon: React.ReactNode; text: string; tone: string }> = [];

  if (care.hunger >= 70) {
    effects.push({ icon: <Utensils className="h-3 w-3" />, text: "Well fed: full attack", tone: "text-teal" });
  } else if (care.hunger >= 40) {
    effects.push({ icon: <Utensils className="h-3 w-3" />, text: "Peckish: -5% attack", tone: "text-gold" });
  } else {
    effects.push({ icon: <Utensils className="h-3 w-3" />, text: "Starving: -12% attack", tone: "text-rose" });
  }

  if (care.mood >= 70) {
    effects.push({ icon: <Heart className="h-3 w-3" />, text: "Happy: +5% crit", tone: "text-rose" });
  } else if (care.mood < 30) {
    effects.push({ icon: <Heart className="h-3 w-3" />, text: "Lonely: -5% crit", tone: "text-rose" });
  }

  if (care.friendship >= 80) {
    effects.push({ icon: <Zap className="h-3 w-3" />, text: "Bonded: +5% HP", tone: "text-violet" });
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {effects.map((effect) => (
        <span
          key={effect.text}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px]",
            effect.tone,
          )}
        >
          {effect.icon}
          {effect.text}
        </span>
      ))}
    </div>
  );
}
