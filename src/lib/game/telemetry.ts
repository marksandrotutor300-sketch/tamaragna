import { getDb } from "@/lib/db/client";
import { analyticsEvents, type Battle } from "@/lib/db/schema";
import type { CombatantInit } from "@/lib/sim/types";
import { logEvent } from "@/lib/log";

type TeamSignature = {
  speciesId: number;
  rarity?: number;
  nature?: string;
  star?: number;
  stage?: number;
  level: number;
  skills: number[];
};

export function teamSignature(team: CombatantInit[]): TeamSignature[] {
  return team.map((member) => ({
    speciesId: member.speciesId,
    rarity: member.rarity,
    nature: member.nature,
    star: member.star,
    stage: member.evolutionStage,
    level: member.level,
    skills: member.skills.map((skill) => skill.id),
  }));
}

/**
 * Best-effort analytics write. A telemetry failure must never fail a battle.
 */
export async function recordBattleComplete(params: {
  battle: Pick<Battle, "id" | "ownerId" | "mode" | "payload"> & {
    result: Battle["result"];
  };
  season: number;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(analyticsEvents).values({
      version: 1,
      event: "battle_complete",
      season: params.season,
      mode: params.battle.mode,
      battleId: params.battle.id,
      actorId: params.battle.ownerId,
      winner: params.battle.result?.winner ?? null,
      durationMs: params.battle.result?.durationMs ?? null,
      payload: {
        teamA: teamSignature(params.battle.payload.teamA),
        teamB: teamSignature(params.battle.payload.teamB),
        wave: params.battle.payload.wave ?? null,
        reason: params.battle.result?.reason ?? null,
      },
    });
  } catch (error) {
    logEvent("warn", "telemetry.battle_complete_failed", {
      battleId: params.battle.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
