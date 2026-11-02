import { and, eq, gt, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { emailTokens } from "@/lib/db/schema";

export const MAGIC_TOKEN_TTL_MS = 15 * 60_000;

export function hashEmailToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueMagicToken(email: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAGIC_TOKEN_TTL_MS);

  await db
    .delete(emailTokens)
    .where(
      and(
        eq(emailTokens.email, email),
        eq(emailTokens.purpose, "login"),
        isNull(emailTokens.usedAt),
      ),
    );

  await db.insert(emailTokens).values({
    tokenHash: hashEmailToken(token),
    email,
    purpose: "login",
    expiresAt,
  });

  return { token, expiresAt };
}

export async function consumeMagicToken(token: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .update(emailTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(emailTokens.tokenHash, hashEmailToken(token)),
        eq(emailTokens.purpose, "login"),
        isNull(emailTokens.usedAt),
        gt(emailTokens.expiresAt, new Date()),
      ),
    )
    .returning({ email: emailTokens.email });

  return rows[0]?.email ?? null;
}
