import { Rng } from "@/lib/rng";
import { ALL_SPECIES } from "./species";
import type { GeneratedSpecies } from "./types";

/**
 * Three deterministic featured species per UTC day. Wild eggs give them 3x
 * weight, so the hatch pool rotates without any database state.
 */
export function featuredForDate(dateKey: string): GeneratedSpecies[] {
  const pool = ALL_SPECIES.filter((species) => species.playable);
  const rng = new Rng(`featured:${dateKey}`);
  const picked: GeneratedSpecies[] = [];
  const seen = new Set<number>();
  let guard = 0;

  while (picked.length < 3 && guard < 200 && picked.length < pool.length) {
    guard += 1;
    const candidate = rng.pick(pool);
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    picked.push(candidate);
  }

  return picked;
}
