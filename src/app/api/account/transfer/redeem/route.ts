import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { hashTransferCode } from "@/lib/account/transfer";
import { getProfile, setDeviceCookie } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import { pets, profiles, transferCodes } from "@/lib/db/schema";
import { checkRateLimit, clientKey, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().trim().min(6).max(24),
});

export async function POST(request: Request): Promise<Response> {
  if (
    !(await checkRateLimit(
      `${clientKey(request)}:transfer-redeem`,
      LIMITS.transferRedeem,
    ))
  ) {
    return fail("Too many attempts - wait a few minutes", 429);
  }

  const parsed = await parseBody(request, schema);
  if ("error" in parsed) return parsed.error;

  const db = await getDb();
  const hash = hashTransferCode(parsed.data.code);
  const codeRows = await db
    .select()
    .from(transferCodes)
    .where(eq(transferCodes.codeHash, hash))
    .limit(1);

  const codeRow = codeRows[0];
  if (!codeRow || codeRow.usedAt || codeRow.expiresAt.getTime() <= Date.now()) {
    return fail("That transfer code is invalid or expired", 400);
  }

  const targetRows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, codeRow.profileId))
    .limit(1);
  const target = targetRows[0];
  if (!target) return fail("That ranch no longer exists", 404);

  const caller = await getProfile();
  if (caller?.id === target.id) {
    return fail("This is already the active ranch on this device", 400);
  }

  if (caller) {
    const counts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pets)
      .where(eq(pets.ownerId, caller.id));
    if ((counts[0]?.count ?? 0) > 0) {
      return fail(
        "This device already has a ranch. Use a private window or clear cookies first.",
        400,
      );
    }
  }

  const newDeviceId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    if (caller) {
      await tx.delete(profiles).where(eq(profiles.id, caller.id));
    }
    await tx
      .update(profiles)
      .set({ deviceId: newDeviceId })
      .where(eq(profiles.id, target.id));
    await tx
      .update(transferCodes)
      .set({ usedAt: new Date() })
      .where(eq(transferCodes.codeHash, hash));
    await tx
      .delete(transferCodes)
      .where(
        and(
          eq(transferCodes.profileId, target.id),
          isNull(transferCodes.usedAt),
        ),
      );
  });

  await setDeviceCookie(newDeviceId);

  return ok({ moved: true, displayName: target.displayName });
}
