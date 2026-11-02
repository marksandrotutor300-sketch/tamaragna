import { createHash, randomInt } from "node:crypto";
import { z } from "zod";

export const SAVE_VERSION = 1;
export const TRANSFER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TRANSFER_LENGTH = 10;
export const TRANSFER_TTL_MS = 15 * 60_000;

export function normalizeTransferCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashTransferCode(input: string): string {
  return createHash("sha256").update(normalizeTransferCode(input)).digest("hex");
}

export function generateTransferCode(): { code: string; hash: string } {
  let code = "";
  for (let index = 0; index < TRANSFER_LENGTH; index += 1) {
    code += TRANSFER_ALPHABET[randomInt(TRANSFER_ALPHABET.length)];
  }
  return { code, hash: hashTransferCode(code) };
}

const ivSchema = z.object({
  str: z.number().int().min(0).max(31),
  agi: z.number().int().min(0).max(31),
  vit: z.number().int().min(0).max(31),
  int: z.number().int().min(0).max(31),
  dex: z.number().int().min(0).max(31),
  luk: z.number().int().min(0).max(31),
});

const careSchema = z.object({
  hunger: z.number().min(0).max(100),
  mood: z.number().min(0).max(100),
  energy: z.number().min(0).max(100),
  friendship: z.number().min(0).max(100),
  lastCareAt: z.string().min(1),
  sleeping: z.boolean(),
});

const petSchema = z.object({
  speciesId: z.number().int().positive(),
  nickname: z.string().trim().min(1).max(20),
  rarity: z.number().int().min(1).max(5),
  nature: z.string().min(1).max(20),
  star: z.number().int().min(1).max(5),
  level: z.number().int().min(1).max(50),
  exp: z.number().int().min(0).max(1_000_000_000),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
  ivs: ivSchema,
  care: careSchema,
  loadout: z.array(z.number().int()).length(4).nullable().optional(),
});

export const saveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  exportedAt: z.string().optional(),
  profile: z.object({
    displayName: z.string().trim().min(2).max(20),
    coins: z.number().int().min(0).max(1_000_000_000),
    eggs: z.number().int().min(0).max(100_000),
    rating: z.number().int().min(100).max(4000),
    season: z.number().int().min(1).max(1000),
    placementMatches: z.number().int().min(0).max(5),
  }),
  pets: z.array(petSchema).max(30),
});

export type SaveSnapshot = z.infer<typeof saveSchema>;
