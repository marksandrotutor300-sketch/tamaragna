import { describe, expect, it } from "vitest";
import { evolutionFamily, evolutionOptions } from "./evolution";

describe("evolution graph", () => {
  it("offers the Poring branch and the family line", () => {
    const options = evolutionOptions(1002);
    expect(options.map((option) => option.to)).toEqual(
      expect.arrayContaining([1031, 1113]),
    );
    expect(evolutionFamily(1002)?.name).toBe("Poring guardian line");
  });

  it("has a terminal stage for a family", () => {
    expect(evolutionOptions(1242)).toHaveLength(0);
  });
});
