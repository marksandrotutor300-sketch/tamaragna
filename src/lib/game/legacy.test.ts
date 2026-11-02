import { describe, expect, it } from "vitest";
import { LEGACY_IV_BONUS, applyLegacyIvs, legacyTraitFor } from "./legacy";

describe("legacy", () => {
  it("raises every IV by the legacy bonus and caps at 31", () => {
    const next = applyLegacyIvs({ str: 30, agi: 1, vit: 31, int: 5, dex: 10, luk: 20 });
    expect(next.str).toBe(31);
    expect(next.agi).toBe(1 + LEGACY_IV_BONUS);
    expect(next.vit).toBe(31);
  });

  it("provides stable elemental traits", () => {
    expect(legacyTraitFor(1)).toBe("Emberheart");
    expect(legacyTraitFor(7)).toBe("Voidtrace");
    expect(legacyTraitFor(99 as never)).toBe("Ancestral Spark");
  });
});
