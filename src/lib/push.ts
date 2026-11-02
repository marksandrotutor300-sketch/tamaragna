import webPush from "web-push";

export type PushTarget = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export function pushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export async function sendPush(
  target: PushTarget,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<void> {
  if (!pushConfigured()) throw new Error("Push is not configured");

  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  await webPush.sendNotification(
    { endpoint: target.endpoint, keys: target.keys },
    JSON.stringify(payload),
  );
}
