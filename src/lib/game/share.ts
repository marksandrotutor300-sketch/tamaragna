import { randomInt } from "node:crypto";

const SHARE_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const SHARE_TOKEN_LENGTH = 12;

const RESERVED_SLUGS = new Set([
  "account",
  "admin",
  "api",
  "arena",
  "battle",
  "bestiary",
  "breed",
  "hatch",
  "offline",
  "pvp",
  "quests",
  "ranch",
  "replay",
  "team",
  "tower",
  "trainer",
  "transfer",
  "watch",
]);

export function createShareToken(): string {
  let token = "";
  for (let index = 0; index < SHARE_TOKEN_LENGTH; index += 1) {
    token += SHARE_ALPHABET[randomInt(SHARE_ALPHABET.length)];
  }
  return token;
}

export function isShareToken(value: string): boolean {
  return new RegExp(`^[A-Za-z0-9]{${SHARE_TOKEN_LENGTH}}$`).test(value);
}

export function sharePath(token: string): string {
  return `/replay/${token}`;
}

export function normalizePublicSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

export function isValidPublicSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 24) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug);
}
