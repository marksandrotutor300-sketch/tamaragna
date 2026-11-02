"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Swords } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { Pill } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { ELEMENT_COLORS, ELEMENT_NAMES } from "@/lib/game/elements";
import { RARITY } from "@/lib/game/rarity";
import type { GeneratedSkill, GeneratedSpecies } from "@/lib/game/types";
import type { ResolvedSkill } from "@/lib/game/skills";

type Detail = {
  species: GeneratedSpecies;
  skills: Array<{
    baseLevel: number;
    definition: GeneratedSkill;
    level1: ResolvedSkill;
    level10: ResolvedSkill;
    atRarity3: ResolvedSkill;
  }>;
};

export default function SpeciesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const { data, isLoading } = useQuery({
    queryKey: ["species", id],
    queryFn: () => api.get<Detail>(`/api/bestiary/${id}`),
    enabled: Number.isFinite(id),
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const { species, skills } = data;

  const practice = async () => {
    try {
      const battle = await api.post<{ battleId: string }>("/api/battle/practice", {
        speciesId: species.id,
      });
      router.push(`/battle/${battle.battleId}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not start battle");
    }
  };

  return (
    <div className="space-y-4">
      <Link
        href="/bestiary"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to bestiary
      </Link>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-60"
            style={{
              background: `radial-gradient(circle at 50% 0%, ${ELEMENT_COLORS[species.element]}33, transparent 70%)`,
            }}
          />
          <div className="relative flex flex-col items-center py-4">
            <PetSprite speciesId={species.id} size={190} />
            <h1 className="mt-2 font-display text-2xl">{species.name}</h1>
            <div className="text-[11px] text-muted">
              #{species.id} · {species.aegisName}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              <Pill color={RARITY[species.tier].color}>{RARITY[species.tier].name} tier</Pill>
              <Pill color={ELEMENT_COLORS[species.element]}>
                {ELEMENT_NAMES[species.element]} {species.elementLevel}
              </Pill>
              <Pill>{species.raceName}</Pill>
              <Pill>{species.sizeName}</Pill>
              {species.mvp ? <Pill color="#ffc94a">MVP</Pill> : null}
            </div>
          </div>

          <div className="relative mt-2 grid grid-cols-3 gap-2">
            {[
              ["Level", species.level],
              ["HP", species.base.hp],
              ["ATK", species.base.atk],
              ["DEF", species.base.def],
              ["MDEF", species.base.mdef],
              ["Attack", `${(1000 / species.base.aspdMs).toFixed(2)}/s`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line/60 bg-black/20 px-2 py-1.5">
                <div className="text-[9px] uppercase tracking-[0.14em] text-muted">{label}</div>
                <div className="font-display text-sm">{value}</div>
              </div>
            ))}
          </div>

          <div className="relative mt-3">
            <Button className="w-full" onClick={practice}>
              <Swords className="h-4 w-4" /> Practice against {species.name}
            </Button>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <SectionTitle hint="fixed per species">Skill kit</SectionTitle>
            <div className="space-y-2">
              {skills.map((entry) => (
                <div
                  key={entry.definition.id}
                  className="rounded-xl border border-line/60 bg-black/20 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* skill icon comes from the RO icon proxy */}
                      <img
                        src={`/api/icon/skill/${entry.definition.id}`}
                        alt=""
                        width={26}
                        height={26}
                        className="rounded-md border border-black/40"
                        onError={(event) => {
                          event.currentTarget.style.visibility = "hidden";
                        }}
                      />
                      <span className="text-sm">{entry.definition.displayName}</span>
                    </div>
                    <span className="text-[10px] text-muted">
                      base Lv {entry.baseLevel}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted">
                    <span>{entry.definition.kind}</span>
                    <span style={{ color: ELEMENT_COLORS[entry.level1.element] }}>
                      {ELEMENT_NAMES[entry.level1.element]}
                    </span>
                    <span>
                      {entry.level1.hits} hit{entry.level1.hits > 1 ? "s" : ""}
                    </span>
                    <span>{entry.level1.power}% power</span>
                    <span>{(entry.level1.cooldownMs / 1000).toFixed(1)}s cooldown</span>
                    {entry.level1.status ? (
                      <span className="text-violet">
                        {entry.level1.status.kind} {(entry.level1.status.chance * 100).toFixed(0)}%
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle hint="where it lives in Ragnarok">Spawn maps</SectionTitle>
            {species.spawnMaps.length === 0 ? (
              <p className="text-xs text-muted">
                Event, quest or instance-only monster - no open-world spawns.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {species.spawnMaps.map((map) => (
                  <span
                    key={map}
                    className="inline-flex items-center gap-1 rounded-lg border border-line/60 bg-black/20 px-2 py-1 text-[11px] text-muted"
                  >
                    <MapPin className="h-3 w-3" />
                    {map}
                  </span>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
