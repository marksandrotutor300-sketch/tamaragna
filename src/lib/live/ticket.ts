import { createHmac, timingSafeEqual } from "node:crypto";

export type LiveSeat = "a" | "b" | "spectator";

export type LiveTicket = {
  matchId: string;
  profileId: string | null;
  seat: LiveSeat;
  spectator: boolean;
  exp: number;
};

const SECRET = process.env.LIVE_TOKEN_SECRET ?? "tamaragna-dev-live-secret";
const TTL_SECONDS = 60 * 60 * 2;

export function signLiveTicket(
  payload: Omit<LiveTicket, "exp">,
): string {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyLiveTicket(token: string): LiveTicket | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = createHmac("sha256", SECRET)
    .update(encoded)
    .digest("base64url");
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as LiveTicket;
    if (!payload.matchId || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
