import type { ElementId, Ivs } from "./types";

export const LEGACY_BREED_COST = 10;
export const LEGACY_IV_BONUS = 2;

const ELEMENT_TRAITS: Record<number, string> = {
  0: "Neutral Step",
  1: "Emberheart",
  2: "Tidecall",
  3: "Windmark",
  4: "Earthbound",
  5: "Stormline",
  6: "Frostmark",
  7: "Voidtrace",
  8: "Gilded Aura",
  9: "Shadowmark",
};

export function legacyTraitFor(element: ElementId): string {
  return ELEMENT_TRAITS[element] ?? "Ancestral Spark";
}

export function applyLegacyIvs(ivs: Ivs): Ivs {
  const next = { ...ivs };
  for (const key of Object.keys(next) as Array<keyof Ivs>) {
    next[key] = Math.min(31, next[key] + LEGACY_IV_BONUS);
  }
  return next;
}
