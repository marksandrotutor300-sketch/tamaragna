import { describe, expect, it } from "vitest";
import { signLiveTicket, verifyLiveTicket } from "./ticket";

describe("live tickets", () => {
  it("round-trips a signed seat", () => {
    const token = signLiveTicket({
      matchId: "match-1",
      profileId: "profile-1",
      seat: "a",
      spectator: false,
    });
    const ticket = verifyLiveTicket(token);
    expect(ticket?.matchId).toBe("match-1");
    expect(ticket?.seat).toBe("a");
    expect(ticket?.spectator).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const token = signLiveTicket({
      matchId: "match-1",
      profileId: "profile-1",
      seat: "b",
      spectator: false,
    });
    const [encoded, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({
        matchId: "match-2",
        profileId: "profile-2",
        seat: "a",
        spectator: false,
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toString("base64url");
    expect(verifyLiveTicket(`${forged}.${signature}`)).toBeNull();
    expect(verifyLiveTicket(`${encoded}.${signature}`)?.matchId).toBe("match-1");
  });

  it("supports spectator tickets", () => {
    const token = signLiveTicket({
      matchId: "match-3",
      profileId: null,
      seat: "spectator",
      spectator: true,
    });
    expect(verifyLiveTicket(token)?.spectator).toBe(true);
  });
});
