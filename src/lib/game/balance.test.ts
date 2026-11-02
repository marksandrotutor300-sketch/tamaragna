import { describe, expect, it } from "vitest";
import { aggregateBalanceRows, type BalanceRow } from "./balance";

const event = (winner: "a" | "b", speciesA: number, speciesB: number) => ({
  createdAt: new Date("2026-01-02T00:00:00Z"),
  season: 1,
  mode: "pvp",
  winner,
  payload: {
    teamA: [
      {
        speciesId: speciesA,
        rarity: 3,
        nature: "hardy",
        star: 1,
        stage: 1,
        level: 20,
        skills: [1, 2, 3, 4],
      },
    ],
    teamB: [
      {
        speciesId: speciesB,
        rarity: 2,
        nature: "adamant",
        star: 1,
        stage: 1,
        level: 20,
        skills: [5, 6, 7, 8],
      },
    ],
  },
});

describe("balance aggregation", () => {
  it("counts species wins and picks", () => {
    const rows = aggregateBalanceRows([
      event("a", 1002, 1005),
      event("b", 1002, 1005),
    ]);
    const species = rows.filter((row) => row.dimension === "species");
    const poring = species.find((row) => row.key === "1002") as BalanceRow;
    const familiar = species.find((row) => row.key === "1005") as BalanceRow;

    expect(poring.battles).toBe(2);
    expect(poring.wins).toBe(1);
    expect(familiar.battles).toBe(2);
    expect(familiar.wins).toBe(1);
  });

  it("tracks skills and nature dimensions", () => {
    const rows = aggregateBalanceRows([event("a", 1002, 1005)]);
    expect(rows.some((row) => row.dimension === "skill" && row.key === "1")).toBe(
      true,
    );
    expect(
      rows.some((row) => row.dimension === "nature" && row.key === "adamant"),
    ).toBe(true);
  });
});
