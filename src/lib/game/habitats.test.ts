import { describe, expect, it } from "vitest";
import { HABITATS, getHabitat } from "./habitats";

describe("habitats", () => {
  it("has a free starter and a paid theme", () => {
    expect(getHabitat("verdant").cost).toBe(0);
    expect(HABITATS.some((habitat) => habitat.cost > 0)).toBe(true);
  });

  it("falls back to verdant for unknown themes", () => {
    expect(getHabitat("unknown").id).toBe("verdant");
  });
});
