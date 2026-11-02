import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { analyticsEvents, balanceDaily } from "@/lib/db/schema";

type TeamSignature = {
  speciesId: number;
  rarity?: number;
  nature?: string;
  star?: number;
  stage?: number;
  level: number;
  skills: number[];
};

type Aggregate = {
  day: string;
  season: number;
  mode: string;
  dimension: string;
  key: string;
  battles: number;
  wins: number;
  picks: number;
};

export type BalanceRow = Aggregate & { damageSum: number };

function increment(
  map: Map<string, Aggregate>,
  base: Omit<Aggregate, "battles" | "wins" | "picks">,
  won: boolean,
) {
  const id = `${base.day}|${base.season}|${base.mode}|${base.dimension}|${base.key}`;
  let row = map.get(id);
  if (!row) {
    row = { ...base, battles: 0, wins: 0, picks: 0 };
    map.set(id, row);
  }
  row.battles += 1;
  row.picks += 1;
  if (won) row.wins += 1;
}

function addTeam(
  map: Map<string, Aggregate>,
  day: string,
  season: number,
  mode: string,
  team: TeamSignature[],
  won: boolean,
) {
  for (const member of team) {
    const dimensions: Array<[string, string]> = [
      ["species", String(member.speciesId)],
      ["level", String(Math.floor(member.level / 10) * 10)],
    ];
    if (member.rarity !== undefined) dimensions.push(["rarity", String(member.rarity)]);
    if (member.nature) dimensions.push(["nature", member.nature]);
    if (member.star !== undefined) dimensions.push(["star", String(member.star)]);
    if (member.stage !== undefined) dimensions.push(["stage", String(member.stage)]);

    for (const [dimension, key] of dimensions) {
      increment(map, { day, season, mode, dimension, key }, won);
    }
    for (const skillId of member.skills) {
      increment(
        map,
        { day, season, mode, dimension: "skill", key: String(skillId) },
        won,
      );
    }
  }
}

export function aggregateBalanceRows(
  events: Array<{
    createdAt: Date;
    season: number | null;
    mode: string | null;
    winner: string | null;
    payload: Record<string, unknown>;
  }>,
): BalanceRow[] {
  const map = new Map<string, Aggregate>();

  for (const event of events) {
    if (!event.season || !event.mode) continue;
    const payload = event.payload as {
      teamA?: TeamSignature[];
      teamB?: TeamSignature[];
    };
    const day = event.createdAt.toISOString().slice(0, 10);
    addTeam(map, day, event.season, event.mode, payload.teamA ?? [], event.winner === "a");
    addTeam(map, day, event.season, event.mode, payload.teamB ?? [], event.winner === "b");
  }

  return [...map.values()].map((row) => ({ ...row, damageSum: 0 }));
}

export async function recomputeBalance(): Promise<{
  events: number;
  rows: number;
}> {
  const db = await getDb();
  const events = await db
    .select()
    .from(analyticsEvents)
    .where(eq(analyticsEvents.event, "battle_complete"));
  const rows = aggregateBalanceRows(events);

  await db.delete(balanceDaily);
  for (let index = 0; index < rows.length; index += 250) {
    const chunk = rows.slice(index, index + 250);
    if (chunk.length > 0) await db.insert(balanceDaily).values(chunk);
  }

  return { events: events.length, rows: rows.length };
}
