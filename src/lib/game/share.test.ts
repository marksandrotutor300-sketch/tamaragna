import { describe, expect, it } from "vitest";
import {
  SHARE_TOKEN_LENGTH,
  createShareToken,
  isShareToken,
  isValidPublicSlug,
  normalizePublicSlug,
  sharePath,
} from "./share";

describe("share tokens", () => {
  it("creates an unguessable alphanumeric token", () => {
    const token = createShareToken();
    expect(token).toHaveLength(SHARE_TOKEN_LENGTH);
    expect(isShareToken(token)).toBe(true);
    expect(isShareToken("../etc/passwd")).toBe(false);
    expect(sharePath(token)).toBe(`/replay/${token}`);
    expect(createShareToken()).not.toBe(token);
  });
});

describe("public trainer slugs", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizePublicSlug("My Trainer!")).toBe("my-trainer");
    expect(normalizePublicSlug("  --Ace--  ")).toBe("ace");
  });

  it("rejects short, reserved and malformed slugs", () => {
    expect(isValidPublicSlug("api")).toBe(false);
    expect(isValidPublicSlug("ab")).toBe(false);
    expect(isValidPublicSlug("-ace")).toBe(false);
    expect(isValidPublicSlug("ace-")).toBe(false);
    expect(isValidPublicSlug("ace_of_spades")).toBe(false);
    expect(isValidPublicSlug("ace-of-spades")).toBe(true);
  });
});
