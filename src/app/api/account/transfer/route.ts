import { and, eq, isNull } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { transferCodes } from "@/lib/db/schema";
import { generateTransferCode, TRANSFER_TTL_MS } from "@/lib/account/transfer";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  return withUser(async (profile) => {
    if (
      !(await checkRateLimit(
        `${profile.id}:transfer-create`,
        LIMITS.transferCreate,
      ))
    ) {
      return fail("Too many transfer codes - wait a minute", 429);
    }

    const db = await getDb();
    await db
      .delete(transferCodes)
      .where(
        and(
          eq(transferCodes.profileId, profile.id),
          isNull(transferCodes.usedAt),
        ),
      );

    const { code, hash } = generateTransferCode();
    const expiresAt = new Date(Date.now() + TRANSFER_TTL_MS);
    await db.insert(transferCodes).values({
      codeHash: hash,
      profileId: profile.id,
      expiresAt,
    });

    return ok({ code, expiresAt: expiresAt.toISOString() });
  });
}
