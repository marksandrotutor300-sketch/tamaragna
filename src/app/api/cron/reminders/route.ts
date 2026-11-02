import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  notificationLog,
  pets,
  pushSubscriptions,
} from "@/lib/db/schema";
import { normalizeCare } from "@/lib/game/care";
import { pushConfigured, sendPush } from "@/lib/push";
import { logEvent } from "@/lib/log";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  if (!secret || (authorization !== `Bearer ${secret}` && headerSecret !== secret)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!pushConfigured()) {
    return Response.json({ sent: 0, configured: false });
  }

  const db = await getDb();
  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(isNull(pushSubscriptions.disabledAt))
    .limit(100);

  let sent = 0;
  let skipped = 0;

  for (const subscription of subscriptions) {
    const petRows = await db
      .select()
      .from(pets)
      .where(eq(pets.ownerId, subscription.profileId))
      .limit(30);

    const needy = petRows.find((pet) => {
      const care = normalizeCare(pet.care);
      return care.hunger < 30 || care.mood < 30 || care.energy < 20;
    });
    if (!needy) {
      skipped += 1;
      continue;
    }

    const recent = await db
      .select({ id: notificationLog.id })
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.subscriptionId, subscription.id),
          eq(notificationLog.kind, "care"),
        ),
      )
      .orderBy(desc(notificationLog.sentAt))
      .limit(1);

    if (recent[0]) {
      const rows = await db
        .select({ sentAt: notificationLog.sentAt })
        .from(notificationLog)
        .where(eq(notificationLog.id, recent[0].id))
        .limit(1);
      const last = rows[0]?.sentAt;
      if (last && Date.now() - last.getTime() < 6 * 60 * 60_000) {
        skipped += 1;
        continue;
      }
    }

    try {
      await sendPush(subscription, {
        title: "TamaRagna",
        body: `${needy.nickname} is hungry. Check the ranch.`,
        url: "/ranch",
        tag: "care",
      });
      await db.insert(notificationLog).values({
        subscriptionId: subscription.id,
        kind: "care",
      });
      sent += 1;
    } catch (error) {
      logEvent("warn", "push.care_failed", {
        subscriptionId: subscription.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return Response.json({ sent, skipped, configured: true });
}
