import { ok } from "@/lib/api";
import { featuredForDate } from "@/lib/game/featured";
import { dayKey } from "@/lib/game/quests";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const date = dayKey();
  const species = featuredForDate(date).map((entry) => ({
    id: entry.id,
    name: entry.name,
    tier: entry.tier,
    element: entry.element,
    elementLevel: entry.elementLevel,
    raceName: entry.raceName,
    mvp: entry.mvp,
    boss: entry.boss,
  }));

  return ok({ date, species, boost: 3 });
}
