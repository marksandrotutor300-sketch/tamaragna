/**
 * Deterministic PRNG. Every battle must be reproducible from its seed, so no
 * Math.random anywhere in the simulation.
 */

function xmur3(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private nextValue: () => number;

  constructor(seed: string | number) {
    const seedFn = xmur3(String(seed));
    this.nextValue = mulberry32(seedFn());
  }

  /** [0, 1) */
  next(): number {
    return this.nextValue();
  }

  /** inclusive on both ends */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** weighted pick; weights need not sum to 1 */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i += 1) {
      roll -= Math.max(0, weights[i]);
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

export function rngFromSeed(seed: string): Rng {
  return new Rng(seed);
}
