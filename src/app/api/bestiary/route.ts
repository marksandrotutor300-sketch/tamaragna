import type { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { ALL_SUMMARIES } from "@/lib/game/species";

export const runtime = "nodejs";

const PAGE_SIZE = 60;

export async function GET(request: NextRequest): Promise<Response> {
  const search = request.nextUrl.searchParams;
  const query = (search.get("q") ?? "").trim().toLowerCase();
  const tier = Number(search.get("tier") ?? 0);
  const element = search.get("element");
  const page = Math.max(1, Number(search.get("page") ?? 1) || 1);

  let results = ALL_SUMMARIES;

  if (query) {
    results = results.filter(
      (species) =>
        species.name.toLowerCase().includes(query) ||
        String(species.id) === query,
    );
  }
  if (tier >= 1 && tier <= 5) {
    results = results.filter((species) => species.tier === tier);
  }
  if (element !== null && element !== "") {
    const elementId = Number(element);
    results = results.filter((species) => species.element === elementId);
  }

  const total = results.length;
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = results.slice(start, start + PAGE_SIZE);

  return ok({
    total,
    page,
    pageSize: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    species: pageItems,
  });
}
