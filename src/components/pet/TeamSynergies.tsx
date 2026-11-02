import { Sparkles, Users } from "lucide-react";
import { Panel, SectionTitle } from "@/components/ui/primitives";
import { computeTeamSynergies } from "@/lib/game/synergy";
import type { PetView } from "@/lib/game/views";

const HINTS = [
  "2 pets of one element: +5% ATK/MATK",
  "2 pets of one race: +8% DEF/MDEF",
  "3 different races: +5% max HP",
];

export function TeamSynergies({ pets }: { pets: PetView[] }) {
  const members = pets.map((pet) => ({
    speciesId: pet.speciesId,
    element: pet.species.element,
    raceName: pet.species.raceName,
  }));
  const synergies = computeTeamSynergies(members);

  return (
    <Panel>
      <SectionTitle hint={`${synergies.length} active`}>Team synergies</SectionTitle>

      {synergies.length > 0 ? (
        <div className="space-y-2">
          {synergies.map((synergy) => (
            <div
              key={synergy.id}
              className="flex items-start gap-2 rounded-xl border border-teal/20 bg-teal/5 px-3 py-2"
            >
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
              <div>
                <div className="text-xs font-medium text-teal">{synergy.name}</div>
                <div className="text-[10px] text-muted">{synergy.description}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line/60 px-3 py-4 text-center text-[11px] text-muted">
          <Users className="mx-auto mb-1 h-4 w-4" />
          No composition bonus yet.
        </div>
      )}

      <ul className="mt-3 space-y-1 text-[10px] text-muted">
        {HINTS.map((hint) => (
          <li key={hint}>· {hint}</li>
        ))}
      </ul>
    </Panel>
  );
}
