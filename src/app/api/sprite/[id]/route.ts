import type { NextRequest } from "next/server";
import { fetchSprite, parseMobAction } from "@/lib/assets";
import { getSpecies } from "@/lib/game/species";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const speciesId = Number(id);

  if (!Number.isInteger(speciesId) || !getSpecies(speciesId)) {
    return new Response("Unknown species", { status: 404 });
  }

  const search = request.nextUrl.searchParams;
  const action = parseMobAction(search.get("action"));
  const dir = Math.min(7, Math.max(0, Number(search.get("dir") ?? 0) || 0));
  const frameParam = search.get("frame");
  const frame = frameParam === null ? undefined : Math.max(0, Number(frameParam) || 0);
  const staticOnly = search.get("static") === "1";

  const sprite = await fetchSprite(
    { speciesId, action, dir, frame },
    { staticOnly },
  );
  if (!sprite) {
    return new Response("Sprite unavailable", { status: 404 });
  }

  return new Response(sprite.body, {
    headers: {
      "Content-Type": sprite.contentType,
      "Content-Length": String(sprite.body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Sprite-Provider": sprite.provider,
    },
  });
}
