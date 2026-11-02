import type { NextRequest } from "next/server";
import { ALL_MAPS } from "@/lib/game/species";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ map: string }> },
): Promise<Response> {
  const { map } = await context.params;

  if (!ALL_MAPS.has(map)) {
    return new Response("Unknown map", { status: 404 });
  }

  try {
    const upstream = await fetch(
      `https://www.divine-pride.net/img/map/original/${encodeURIComponent(map)}.png`,
      {
        next: { revalidate: 2_592_000 },
        headers: { "User-Agent": "tamaragna/0.1 (fan project)" },
      },
    );

    if (!upstream.ok) return new Response("Map unavailable", { status: 404 });

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Map unavailable", { status: 404 });
  }
}
