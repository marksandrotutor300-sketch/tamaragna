import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withActor } from "@/lib/api";
import { requireUser } from "@/lib/db/actor";
import { getDb } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
  preferences: z.record(z.string(), z.boolean()).optional(),
});

export async function POST(request: Request): Promise<Response> {
  return withActor(async (actor) => {
    requireUser(actor);
    if (
      !(await checkRateLimit(
        `${actor.profile.id}:push-subscribe`,
        LIMITS.pushSubscribe,
      ))
    ) {
      return fail("Too many subscription changes", 429);
    }

    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const db = await getDb();
    await db
      .insert(pushSubscriptions)
      .values({
        userId: actor.userId,
        profileId: actor.profile.id,
        endpoint: parsed.data.endpoint,
        keys: parsed.data.keys,
        preferences: parsed.data.preferences ?? {},
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: actor.userId,
          profileId: actor.profile.id,
          keys: parsed.data.keys,
          preferences: parsed.data.preferences ?? {},
          lastSeenAt: new Date(),
          disabledAt: null,
        },
      });

    return ok({ subscribed: true });
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return withActor(async (actor) => {
    requireUser(actor);
    const body = (await request.json().catch(() => ({}))) as {
      endpoint?: string;
    };
    if (!body.endpoint) return fail("Missing endpoint", 400);

    const db = await getDb();
    await db
      .update(pushSubscriptions)
      .set({ disabledAt: new Date() })
      .where(eq(pushSubscriptions.endpoint, body.endpoint));

    return ok({ unsubscribed: true });
  });
}
