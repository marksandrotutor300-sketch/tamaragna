import { pushPublicKey } from "@/lib/push";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const key = pushPublicKey();
  if (!key) {
    return Response.json({ configured: false, publicKey: null });
  }
  return Response.json(
    { configured: true, publicKey: key },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
