import type { ElementId } from "./types";

export type TeamMember = {
  speciesId: number;
  element: ElementId;
  raceName: string;
};

export type TeamSynergy = {
  id: "element-focus" | "race-bond" | "diversity";
  name: string;
  description: string;
  bonus: { atk?: number; def?: number; hp?: number };
  target: { element?: ElementId; race?: string };
};

export type SynergyBonuses = {
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  hp: number;
};

const NEUTRAL: SynergyBonuses = { atk: 1, matk: 1, def: 1, mdef: 1, hp: 1 };

/**
 * Composition bonuses. They are derived, never stored, so changing a team
 * immediately changes the next battle and the PvP snapshot.
 */
export function computeTeamSynergies(members: TeamMember[]): TeamSynergy[] {
  if (members.length < 2) return [];

  const elements = new Map<ElementId, number>();
  const races = new Map<string, number>();
  for (const member of members) {
    elements.set(member.element, (elements.get(member.element) ?? 0) + 1);
    races.set(member.raceName, (races.get(member.raceName) ?? 0) + 1);
  }

  const synergies: TeamSynergy[] = [];

  const focus = [...elements.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  if (focus) {
    const bonus = focus[1] >= 3 ? 0.08 : 0.05;
    synergies.push({
      id: "element-focus",
      name: "Elemental Focus",
      description: `${focus[1]} pets share an element: +${Math.round(bonus * 100)}% ATK and MATK for that element.`,
      bonus: { atk: bonus },
      target: { element: focus[0] },
    });
  }

  const bond = [...races.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (bond) {
    synergies.push({
      id: "race-bond",
      name: "Kindred",
      description: `${bond[1]} pets share a race: +8% DEF and MDEF for that race.`,
      bonus: { def: 0.08 },
      target: { race: bond[0] },
    });
  }

  if (members.length >= 3 && races.size === members.length) {
    synergies.push({
      id: "diversity",
      name: "Mixed Company",
      description: "Three different races: +5% max HP for the whole team.",
      bonus: { hp: 0.05 },
      target: {},
    });
  }

  return synergies;
}

export function synergyBonusesFor(
  member: TeamMember,
  synergies: TeamSynergy[],
): SynergyBonuses {
  const bonuses = { ...NEUTRAL };

  for (const synergy of synergies) {
    if (synergy.target.element !== undefined && synergy.target.element !== member.element) {
      continue;
    }
    if (synergy.target.race !== undefined && synergy.target.race !== member.raceName) {
      continue;
    }

    if (synergy.bonus.atk) {
      bonuses.atk += synergy.bonus.atk;
      bonuses.matk += synergy.bonus.atk;
    }
    if (synergy.bonus.def) {
      bonuses.def += synergy.bonus.def;
      bonuses.mdef += synergy.bonus.def;
    }
    if (synergy.bonus.hp) {
      bonuses.hp += synergy.bonus.hp;
    }
  }

  return bonuses;
}
