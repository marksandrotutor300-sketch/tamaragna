import type { NextRequest } from "next/server";
import { getSkill } from "@/lib/game/combat-data";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const skillId = Number(id);
  const skill = getSkill(skillId);
  if (!skill) return new Response("Unknown skill", { status: 404 });

  try {
    const upstream = await fetch(
      `https://static.divine-pride.net/images/skill/${skill.iconId}.png`,
      {
        next: { revalidate: 2_592_000 },
        headers: { "User-Agent": "tamaragna/0.1 (fan project)" },
      },
    );

    if (!upstream.ok) return new Response("Icon unavailable", { status: 404 });

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Icon unavailable", { status: 404 });
  }
}
