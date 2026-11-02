"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Dna, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { NatureBadge, StarPips } from "@/components/pet/Genetics";
import { RarityBadge, RarityFrame } from "@/components/pet/RarityFrame";
import { TeamSynergies } from "@/components/pet/TeamSynergies";
import { IvPips, StatRadar } from "@/components/pet/StatRadar";
import { storagePets, teamPets, useAwaken, useEvolutionOptions, useEvolve, useLineage, useMe, useRerollNature, useUpdatePet } from "@/hooks/useGame";
import { MAX_STAR, awakenCost } from "@/lib/game/awakening";
import { elementColor, elementName } from "@/lib/game/elements";
import { NATURE_REROLL_COST, natureById } from "@/lib/game/nature";
import { RARITY } from "@/lib/game/rarity";
import type { PetView } from "@/lib/game/views";
import { cn } from "@/lib/client/cn";

export default function TeamPage() {
  const { data, isLoading } = useMe();
  const update = useUpdatePet();
  const awaken = useAwaken();
  const reroll = useRerollNature();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [fodderId, setFodderId] = useState("");
  const [loadoutDraft, setLoadoutDraft] = useState<number[] | null>(null);

  useEffect(() => {
    setFodderId("");
    setLoadoutDraft(null);
  }, [selectedId]);

  const team = useMemo(() => teamPets(data?.pets ?? []), [data]);
  const storage = useMemo(() => storagePets(data?.pets ?? []), [data]);
  const selected =
    data?.pets.find((pet) => pet.id === selectedId) ?? team[0] ?? storage[0] ?? null;

  const evolution = useEvolutionOptions(selected?.id);
  const evolve = useEvolve();
  const lineage = useLineage(selected?.id);

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const assign = (pet: PetView, slot: 1 | 2 | 3 | null) => {
    update.mutate({ petId: pet.id, patch: { slot } });
  };

  const duplicates = selected
    ? storage.filter((pet) => pet.speciesId === selected.speciesId && pet.star <= selected.star)
    : [];
  const awakenPrice = selected ? awakenCost(selected.star) : 0;

  const consumeDuplicate = () => {
    if (!selected || !fodderId) return;
    awaken.mutate(
      { petId: selected.id, fodderId },
      { onSuccess: () => setFodderId("") },
    );
  };

  const draft = loadoutDraft ?? selected?.loadout ?? [];
  const draftChanged = selected
    ? draft.length !== selected.loadout.length ||
      draft.some((id, index) => id !== selected.loadout[index])
    : false;

  const saveLoadout = () => {
    if (!selected || draft.length !== 4) return;
    update.mutate(
      { petId: selected.id, patch: { loadout: draft } },
      { onSuccess: () => setLoadoutDraft(null) },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">roster</div>
          <h1 className="font-display text-2xl">Team &amp; storage</h1>
          <p className="mt-1 text-xs text-muted">
            Three pets can travel with you. Only one fights at a time — swap mid-battle
            on a short cooldown.
          </p>
        </div>
        <Link href="/breed">
          <Button variant="ghost" size="sm">
            <Dna className="h-4 w-4" /> Breeding
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([1, 2, 3] as const).map((slot) => {
          const pet = team.find((entry) => entry.slot === slot);
          return (
            <div
              key={slot}
              className={cn(
                "relative flex min-h-[150px] flex-col items-center justify-center rounded-2xl border p-3 text-center",
                pet ? "border-line/70 bg-panel/50" : "border-dashed border-line/60 bg-black/10",
              )}
            >
              <span className="absolute left-3 top-2 text-[10px] uppercase tracking-[0.16em] text-muted">
                slot {slot}
              </span>
              {pet ? (
                <>
                  <button onClick={() => setSelectedId(pet.id)} className="mt-3">
                    <PetSprite speciesId={pet.speciesId} size={72} animate={false} />
                  </button>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-sm">{pet.nickname}</span>
                    <RarityBadge rarity={pet.rarity} />
                  </div>
                  <div className="text-[10px] text-muted">
                    Lv {pet.level} · {pet.power.toLocaleString()} power
                  </div>
                  <button
                    onClick={() => assign(pet, null)}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-rose/20 px-2 py-1 text-[10px] text-rose/80 hover:bg-rose/10"
                  >
                    <X className="h-3 w-3" /> bench
                  </button>
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 text-muted" />
                  <div className="mt-2 text-xs text-muted">empty</div>
                  <div className="mt-1 text-[10px] text-muted/70">
                    pick a pet below to fill it
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <TeamSynergies pets={team} />

      {selected ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <RarityFrame rarity={selected.rarity} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <PetSprite speciesId={selected.speciesId} size={72} animate={false} />
                <div>
                  {renaming ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        maxLength={20}
                        className="w-32 rounded-lg border border-line bg-black/40 px-2 py-1 text-sm outline-none focus:border-teal/60"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          const nickname = draftName.trim();
                          if (nickname.length > 0) {
                            update.mutate({ petId: selected.id, patch: { nickname } });
                          }
                          setRenaming(false);
                        }}
                        className="rounded p-1 text-teal hover:bg-white/5"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setRenaming(false)}
                        className="rounded p-1 text-muted hover:bg-white/5"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-xl">{selected.nickname}</h2>
                      <button
                        onClick={() => {
                          setDraftName(selected.nickname);
                          setRenaming(true);
                        }}
                        className="rounded p-1 text-muted hover:bg-white/5 hover:text-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <StarPips star={selected.star} />
                    </div>
                  )}
                  <div className="text-xs text-muted">
                    {selected.species.name} · Lv {selected.level} · Stage{" "}
                    {selected.evolutionStage} ·{" "}
                    <span style={{ color: RARITY[selected.rarity].color }}>
                      {RARITY[selected.rarity].name}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <NatureBadge nature={selected.nature} />
                    <span className="text-[10px] text-muted">
                      {natureById(selected.nature).description}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px]"
                      style={{
                        color: elementColor(selected.species.element),
                        borderColor: `${elementColor(selected.species.element)}55`,
                        background: `${elementColor(selected.species.element)}12`,
                      }}
                    >
                      {elementName(selected.species.element)} {selected.species.elementLevel}
                    </span>
                    <span className="rounded-full border border-line/60 px-2 py-0.5 text-[10px] text-muted">
                      {selected.species.raceName}
                    </span>
                    {selected.species.mvp ? (
                      <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] text-gold">
                        MVP
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted">power</div>
                <div className="font-display text-2xl text-gold">
                  {selected.power.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <MiniStat label="HP" value={selected.stats.hpMax} />
              <MiniStat label="ATK" value={selected.stats.atk} />
              <MiniStat label="DEF" value={selected.stats.def} />
              <MiniStat
                label="ASPD"
                value={`${(1000 / selected.stats.aspdMs).toFixed(2)}/s`}
              />
              <MiniStat
                label="RESIST"
                value={`${Math.round(selected.stats.statusResist * 100)}%`}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {([1, 2, 3] as const).map((slot) => (
                <button
                  key={slot}
                  onClick={() => assign(selected, slot)}
                  disabled={selected.slot === slot}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11px] transition",
                    selected.slot === slot
                      ? "border-teal/40 bg-teal/10 text-teal"
                      : "border-line/70 text-muted hover:border-teal/40 hover:text-ink",
                  )}
                >
                  {selected.slot === slot ? `In slot ${slot}` : `Put in slot ${slot}`}
                </button>
              ))}
              {selected.slot !== null ? (
                <button
                  onClick={() => assign(selected, null)}
                  className="rounded-lg border border-rose/20 px-2.5 py-1 text-[11px] text-rose/80 hover:bg-rose/10"
                >
                  <Trash2 className="mr-1 inline h-3 w-3" />
                  Bench
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex justify-center">
                <StatRadar ivs={selected.ivs} size={170} />
              </div>
              <IvPips ivs={selected.ivs} />
            </div>
          </RarityFrame>

          <Panel className="mb-4">
            <SectionTitle hint={natureById(selected.nature).name}>Genetics</SectionTitle>
            <p className="text-[11px] text-muted">
              {natureById(selected.nature).description}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => reroll.mutate({ petId: selected.id })}
              disabled={reroll.isPending || data.profile.coins < NATURE_REROLL_COST}
            >
              {reroll.isPending
                ? "Rerolling..."
                : `Reroll nature — ${NATURE_REROLL_COST}c`}
            </Button>
            {reroll.error ? (
              <p className="mt-1 text-[10px] text-rose">{reroll.error.message}</p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniStat label="Stars" value={`${selected.star}/${MAX_STAR}`} />
              <MiniStat
                label="IV total"
                value={`${Object.values(selected.ivs).reduce((sum, value) => sum + value, 0)}/186`}
              />
              <MiniStat
                label="Status resist"
                value={`${Math.round(selected.stats.statusResist * 100)}%`}
              />
              <MiniStat label="Nature" value={natureById(selected.nature).name} />
            </div>

            {selected.star < MAX_STAR ? (
              duplicates.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <label
                    htmlFor="awaken-fodder"
                    className="text-[10px] uppercase tracking-[0.14em] text-muted"
                  >
                    Duplicate to consume
                  </label>
                  <select
                    id="awaken-fodder"
                    value={fodderId}
                    onChange={(event) => setFodderId(event.target.value)}
                    className="w-full rounded-lg border border-line bg-black/40 px-2 py-1.5 text-xs outline-none focus:border-teal/60"
                  >
                    <option value="">Choose a duplicate</option>
                    {duplicates.map((pet) => (
                      <option key={pet.id} value={pet.id}>
                        {pet.nickname} · {pet.star}★ · Lv {pet.level}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="gold"
                    size="sm"
                    className="w-full"
                    onClick={consumeDuplicate}
                    disabled={
                      !fodderId ||
                      awaken.isPending ||
                      data.profile.coins < awakenPrice
                    }
                  >
                    <Star className="h-3.5 w-3.5" />
                    {awaken.isPending ? "Awakening..." : `Awaken — ${awakenPrice}c`}
                  </Button>
                  {awaken.error ? (
                    <p className="text-[10px] text-rose">{awaken.error.message}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-line/60 px-3 py-2 text-[10px] text-muted">
                  Hatch another {selected.species.name} to awaken this one.
                </p>
              )
            ) : (
              <p className="mt-3 text-[10px] text-gold">Max stars.</p>
            )}

            <Link
              href="/breed"
              className="mt-3 flex items-center justify-between rounded-xl border border-line/60 px-3 py-2 text-xs text-muted transition hover:border-violet/40 hover:text-violet"
            >
              Breeding
              <Dna className="h-4 w-4" />
            </Link>
          </Panel>

          <Panel>
            <SectionTitle hint={`Stage ${selected.evolutionStage}`}>Evolution</SectionTitle>
            {evolution.isLoading ? (
              <Spinner className="h-5 w-5" />
            ) : evolution.data?.options.length ? (
              <div className="space-y-2">
                {evolution.data.options.map((option) => {
                  const canEvolve =
                    option.stage === selected.evolutionStage + 1 &&
                    selected.level >= option.level &&
                    selected.star >= option.star &&
                    data.profile.coins >= option.coins;
                  return (
                    <div
                      key={`${option.from}-${option.to}`}
                      className="rounded-xl border border-line/60 bg-black/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm">{option.target.name}</div>
                          <div className="text-[10px] text-muted">
                            {option.family} · stage {option.stage}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canEvolve || evolve.isPending}
                          onClick={() =>
                            evolve.mutate({
                              petId: selected.id,
                              toSpeciesId: option.to,
                            })
                          }
                        >
                          {evolve.isPending ? "Evolving..." : "Evolve"}
                        </Button>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted">
                        <span>Lv {option.level}</span>
                        <span>{option.star}★</span>
                        <span>{option.coins} coins</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-muted">No further evolution for this line.</p>
            )}
            {evolve.error ? (
              <p className="mt-2 text-[10px] text-rose">{evolve.error.message}</p>
            ) : null}
            {lineage.data?.ancestors.length ? (
              <div className="mt-3 border-t border-line/50 pt-2">
                <div className="text-[9px] uppercase tracking-[0.14em] text-muted">
                  Lineage
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {lineage.data.ancestors.map((ancestor) => (
                    <span
                      key={ancestor.id}
                      className="rounded-full border border-line/60 bg-black/20 px-2 py-0.5 text-[10px] text-muted"
                    >
                      {ancestor.speciesName} · Lv {ancestor.level} · S
                      {ancestor.stage}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel>
            <SectionTitle hint={`${draft.length}/4 equipped`}>Skill loadout</SectionTitle>
            <div className="space-y-2">
              {selected.availableSkills.map((skill) => {
                const equipped = draft.includes(skill.id);
                const full = draft.length >= 4;

                return (
                  <button
                    key={skill.id}
                    onClick={() => {
                      if (equipped) {
                        setLoadoutDraft(draft.filter((id) => id !== skill.id));
                      } else if (!full) {
                        setLoadoutDraft([...draft, skill.id]);
                      }
                    }}
                    disabled={!equipped && full}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left transition",
                      equipped
                        ? "border-teal/40 bg-teal/10"
                        : "border-line/60 bg-black/20 hover:border-white/20",
                      !equipped && full && "opacity-40",
                    )}
                  >
                    <div className="flex items-center gap-2">
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
                          <span className="text-[10px] text-violet">
                            M{skill.masteryLevel ?? 1}
                          </span>
                          {equipped ? <Check className="h-3.5 w-3.5 text-teal" /> : null}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted">
                          <span>{skill.kind}</span>
                          <span style={{ color: elementColor(skill.element) }}>
                            {elementName(skill.element)}
                          </span>
                          <span>
                            {skill.hits} hit{skill.hits > 1 ? "s" : ""}
                          </span>
                          <span>{(skill.cooldownMs / 1000).toFixed(1)}s cd</span>
                          <span>{skill.power}% power</span>
                          {skill.status ? (
                            <span className="text-violet">{skill.status.kind}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={saveLoadout}
                disabled={draft.length !== 4 || !draftChanged || update.isPending}
              >
                {update.isPending ? "Saving..." : "Save loadout"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setLoadoutDraft(null)}
                disabled={loadoutDraft === null}
              >
                Reset
              </Button>
            </div>

            {draft.length !== 4 ? (
              <p className="mt-2 text-[10px] text-gold">Equip exactly four skills.</p>
            ) : null}
            {update.error ? (
              <p className="mt-2 text-[10px] text-rose">{update.error.message}</p>
            ) : null}
          </Panel>
        </div>
      ) : null}

      <div>
        <SectionTitle hint={`${storage.length} in storage`}>Storage</SectionTitle>
        {storage.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line/60 px-4 py-8 text-center text-sm text-muted">
            Nothing in storage. Hatch more eggs to grow the ranch.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {storage.map((pet) => (
              <div
                key={pet.id}
                className={cn(
                  "rounded-xl border p-2 transition",
                  selected?.id === pet.id
                    ? "border-teal/40 bg-teal/5"
                    : "border-line/60 bg-panel/40 hover:border-white/20",
                )}
              >
                <button
                  onClick={() => setSelectedId(pet.id)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <PetSprite speciesId={pet.speciesId} size={44} animate={false} />
                  <div className="min-w-0">
                    <div className="truncate text-xs">{pet.nickname}</div>
                    <div className="text-[10px] text-muted">Lv {pet.level}</div>
                  </div>
                </button>
                <div className="mt-1.5 flex gap-1">
                  {([1, 2, 3] as const).map((slot) => (
                    <button
                      key={slot}
                      onClick={() => assign(pet, slot)}
                      className="flex-1 rounded border border-line/70 py-0.5 text-[10px] text-muted hover:border-teal/40 hover:text-teal"
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-line/60 bg-black/20 px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="font-display text-sm">{value}</div>
    </div>
  );
}
