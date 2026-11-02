import { describe, expect, it } from "vitest";
import {
  SAVE_VERSION,
  TRANSFER_ALPHABET,
  TRANSFER_LENGTH,
  generateTransferCode,
  hashTransferCode,
  normalizeTransferCode,
  saveSchema,
} from "./transfer";

function validSave() {
  return {
    version: SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      displayName: "Ash",
      coins: 500,
      eggs: 1,
      rating: 1000,
      season: 1,
      placementMatches: 0,
    },
    pets: [
      {
        speciesId: 1002,
        nickname: "Poring",
        rarity: 1,
        nature: "hardy",
        star: 1,
        level: 1,
        exp: 0,
        slot: 1,
        ivs: { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 },
        care: {
          hunger: 80,
          mood: 80,
          energy: 80,
          friendship: 20,
          lastCareAt: new Date().toISOString(),
          sleeping: false,
        },
        loadout: null,
      },
    ],
  };
}

describe("transfer codes", () => {
  it("normalizes case and punctuation before hashing", () => {
    expect(normalizeTransferCode("abcde-fghij")).toBe("ABCDEFGHIJ");
    expect(hashTransferCode("abcde-fghij")).toBe(hashTransferCode("ABCDE FGHIJ"));
    expect(hashTransferCode("abcde-fghij")).not.toBe(hashTransferCode("ABCDE-FGHIK"));
  });

  it("generates a code from the unambiguous alphabet", () => {
    const { code, hash } = generateTransferCode();
    expect(code).toHaveLength(TRANSFER_LENGTH);
    expect([...code].every((character) => TRANSFER_ALPHABET.includes(character))).toBe(
      true,
    );
    expect(hash).toBe(hashTransferCode(code));
    expect(generateTransferCode().code).not.toBe(code);
  });
});

describe("save schema", () => {
  it("accepts a normal export", () => {
    const parsed = saveSchema.safeParse(validSave());
    expect(parsed.success).toBe(true);
  });

  it("rejects out-of-range stats and malformed loadouts", () => {
    const highIv = validSave();
    highIv.pets[0].ivs.str = 32;
    expect(saveSchema.safeParse(highIv).success).toBe(false);

    const badLevel = validSave();
    badLevel.pets[0].level = 0;
    expect(saveSchema.safeParse(badLevel).success).toBe(false);

    const badLoadout = validSave();
    // @ts-expect-error deliberately malformed save shape
    badLoadout.pets[0].loadout = [1, 2, 3];
    expect(saveSchema.safeParse(badLoadout).success).toBe(false);

    const badSlot = validSave();
    badSlot.pets[0].slot = 4;
    expect(saveSchema.safeParse(badSlot).success).toBe(false);
  });
});
