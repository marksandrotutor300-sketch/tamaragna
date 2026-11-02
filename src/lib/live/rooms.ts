import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  battles,
  liveMatches,
  profiles,
  pvpSnapshots,
  spectatorPicks,
  tournamentMatches,
  tournaments,
  type BattlePayload,
} from "@/lib/db/schema";
import { grantBattleRewards } from "@/lib/game/battles";
import { eloDelta } from "@/lib/game/pvp";
import { recordSkillMastery } from "@/lib/game/mastery";
import { PLACEMENT_MATCHES, placementK } from "@/lib/game/season";
import { recordBattleComplete } from "@/lib/game/telemetry";
import { logEvent } from "@/lib/log";
import { BattleEngine } from "@/lib/sim/engine";
import { simulateBattle } from "@/lib/sim/replay";
import type {
  BattleInput,
  BattleResult,
  CombatantInit,
  Side,
  SideSnapshot,
} from "@/lib/sim/types";
import type { LiveSeat, LiveTicket } from "./ticket";

export type LivePlayer = {
  profileId: string;
  displayName: string;
  rating: number;
  placementMatches: number;
};

export type LiveSnapshot = {
  type: "snapshot";
  matchId: string;
  battleId: string;
  status: "active" | "complete";
  seq: number;
  t: number;
  a: SideSnapshot;
  b: SideSnapshot;
  players: {
    a: { profileId: string; displayName: string; rating: number };
    b: { profileId: string; displayName: string; rating: number };
  };
  skills: {
    a: Array<Array<{ id: number; displayName: string; iconId: number; cooldownMs: number }>>;
    b: Array<Array<{ id: number; displayName: string; iconId: number; cooldownMs: number }>>;
  };
  result: BattleResult | null;
};

type Subscriber = {
  send: (snapshot: LiveSnapshot) => void;
  spectator: boolean;
  closed: boolean;
};

export type LiveRoom = {
  id: string;
  battleId: string;
  season: number;
  seed: string;
  payload: BattlePayload;
  engine: BattleEngine;
  players: Record<"a" | "b", LivePlayer>;
  status: "active" | "complete";
  seq: number;
  inputs: BattleInput[];
  subscribers: Set<Subscriber>;
  result: BattleResult | null;
  timer: ReturnType<typeof setInterval> | null;
  finishing: boolean;
  tickCount: number;
};

const globalRooms = globalThis as {
  __tamaragnaLiveRooms?: Map<string, LiveRoom>;
};
const rooms = (globalRooms.__tamaragnaLiveRooms ??= new Map());

function skillView(team: CombatantInit[]) {
  return team.map((combatant) =>
    combatant.skills.map((skill) => ({
      id: skill.id,
      displayName: skill.displayName,
      iconId: skill.iconId,
      cooldownMs: skill.cooldownMs,
    })),
  );
}

function snapshotFor(room: LiveRoom): LiveSnapshot {
  const sides = room.engine.snapshot();
  return {
    type: "snapshot",
    matchId: room.id,
    battleId: room.battleId,
    status: room.status,
    seq: room.seq,
    t: room.engine.currentTime,
    a: sides.a,
    b: sides.b,
    players: {
      a: {
        profileId: room.players.a.profileId,
        displayName: room.players.a.displayName,
        rating: room.players.a.rating,
      },
      b: {
        profileId: room.players.b.profileId,
        displayName: room.players.b.displayName,
        rating: room.players.b.rating,
      },
    },
    skills: {
      a: skillView(room.payload.teamA),
      b: skillView(room.payload.teamB),
    },
    result: room.result,
  };
}

function broadcast(room: LiveRoom, snapshot: LiveSnapshot): void {
  for (const subscriber of room.subscribers) {
    if (subscriber.closed) continue;
    if (subscriber.spectator) {
      setTimeout(() => {
        if (!subscriber.closed) subscriber.send(snapshot);
      }, 5_000);
    } else {
      subscriber.send(snapshot);
    }
  }
}

export function getLiveRoom(matchId: string): LiveRoom | undefined {
  return rooms.get(matchId);
}

export function hasLiveRoom(matchId: string): boolean {
  return rooms.has(matchId);
}

export function createLiveRoom(params: {
  matchId: string;
  battleId: string;
  season: number;
  seed: string;
  payload: BattlePayload;
  players: Record<"a" | "b", LivePlayer>;
}): LiveRoom {
  const engine = new BattleEngine({
    seed: params.seed,
    teamA: params.payload.teamA,
    teamB: params.payload.teamB,
    ai: { a: false, b: false },
    maxMs: 180_000,
  });

  const room: LiveRoom = {
    id: params.matchId,
    battleId: params.battleId,
    season: params.season,
    seed: params.seed,
    payload: params.payload,
    engine,
    players: params.players,
    status: "active",
    seq: 0,
    inputs: [],
    subscribers: new Set(),
    result: null,
    timer: null,
    finishing: false,
    tickCount: 0,
  };

  room.timer = setInterval(() => {
    if (room.status !== "active") return;
    try {
      room.engine.step(50);
      room.tickCount += 1;
      room.seq += 1;

      if (room.tickCount % 2 === 0 || room.engine.finished) {
        broadcast(room, snapshotFor(room));
      }

      if (room.engine.finished) {
        void finishLiveRoom(room);
      }
    } catch (error) {
      logEvent("error", "live.tick_failed", {
        matchId: room.id,
        error: error instanceof Error ? error.message : String(error),
      });
      void finishLiveRoom(room);
    }
  }, 50);

  rooms.set(room.id, room);
  setTimeout(() => {
    broadcast(room, snapshotFor(room));
  }, 100);

  return room;
}

export function subscribeLiveRoom(
  matchId: string,
  ticket: LiveTicket,
  send: (snapshot: LiveSnapshot) => void,
): (() => void) | null {
  const room = rooms.get(matchId);
  if (!room || ticket.matchId !== matchId) return null;
  if (
    !ticket.spectator &&
    (ticket.seat === "spectator" ||
      !ticket.profileId ||
      room.players[ticket.seat as "a" | "b"]?.profileId !== ticket.profileId)
  ) {
    return null;
  }

  const subscriber: Subscriber = {
    send,
    spectator: ticket.spectator || ticket.seat === "spectator",
    closed: false,
  };
  room.subscribers.add(subscriber);

  const initial = snapshotFor(room);
  if (subscriber.spectator) {
    setTimeout(() => {
      if (!subscriber.closed) send(initial);
    }, 5_000);
  } else {
    send(initial);
  }

  return () => {
    subscriber.closed = true;
    room.subscribers.delete(subscriber);
  };
}

export function applyLiveInput(
  matchId: string,
  ticket: LiveTicket,
  input: { kind: "skill" | "swap"; index: number },
): boolean {
  const room = rooms.get(matchId);
  if (!room || room.status !== "active" || room.finishing) return false;
  if (ticket.matchId !== matchId || ticket.spectator || ticket.seat === "spectator") {
    return false;
  }
  if (
    !ticket.profileId ||
    room.players[ticket.seat as "a" | "b"]?.profileId !== ticket.profileId
  ) {
    return false;
  }

  const side = ticket.seat as Side;
  room.inputs.push({
    t: room.engine.currentTime,
    kind: input.kind,
    index: input.index,
    side,
  });

  if (input.kind === "skill") room.engine.pressSkillFor(side, input.index);
  else room.engine.swapFor(side, input.index);

  return true;
}

async function advanceTournament(
  tournamentMatchId: string,
  winnerId: string,
): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tournamentMatches)
    .where(eq(tournamentMatches.id, tournamentMatchId))
    .limit(1);
  const match = rows[0];
  if (!match) return;
  if (match.status === "complete") return;

  await db
    .update(tournamentMatches)
    .set({ status: "complete", winner: winnerId })
    .where(eq(tournamentMatches.id, match.id));

  const tournamentRows = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, match.tournamentId))
    .limit(1);
  const tournament = tournamentRows[0];
  if (!tournament) return;

  const totalRounds = Math.log2(tournament.size);
  if (match.round >= totalRounds) {
    await db
      .update(tournaments)
      .set({ status: "complete" })
      .where(eq(tournaments.id, tournament.id));
    return;
  }

  const nextRound = match.round + 1;
  const nextSlot = Math.floor(match.slot / 2);
  const isA = match.slot % 2 === 0;
  const nextRows = await db
    .select()
    .from(tournamentMatches)
    .where(
      and(
        eq(tournamentMatches.tournamentId, tournament.id),
        eq(tournamentMatches.round, nextRound),
        eq(tournamentMatches.slot, nextSlot),
      ),
    )
    .limit(1);

  if (nextRows[0]) {
    await db
      .update(tournamentMatches)
      .set(isA ? { playerA: winnerId } : { playerB: winnerId })
      .where(eq(tournamentMatches.id, nextRows[0].id));
  } else {
    await db.insert(tournamentMatches).values({
      tournamentId: tournament.id,
      round: nextRound,
      slot: nextSlot,
      playerA: isA ? winnerId : null,
      playerB: isA ? null : winnerId,
    });
  }
}

async function finishLiveRoom(room: LiveRoom): Promise<void> {
  if (room.finishing) return;
  room.finishing = true;
  if (room.timer) clearInterval(room.timer);
  room.timer = null;

  try {
    const canonical = simulateBattle(
      {
        seed: room.seed,
        teamA: room.payload.teamA,
        teamB: room.payload.teamB,
        ai: { a: false, b: false },
        maxMs: 180_000,
      },
      room.inputs,
    );

    room.result = canonical.result;
    room.status = "complete";
    room.seq += 1;
    broadcast(room, snapshotFor(room));

    const db = await getDb();
    const battleRows = await db
      .select()
      .from(battles)
      .where(eq(battles.id, room.battleId))
      .limit(1);
    const battle = battleRows[0];
    if (!battle) return;

    await db
      .update(battles)
      .set({
        status: "complete",
        inputLog: room.inputs,
        result: canonical.result,
        resultHash: canonical.result.checksum,
        completedAt: new Date(),
      })
      .where(eq(battles.id, battle.id));

    const winnerProfileId =
      canonical.result.winner === "a"
        ? room.players.a.profileId
        : canonical.result.winner === "b"
          ? room.players.b.profileId
          : null;

    const liveRows = await db
      .select()
      .from(liveMatches)
      .where(eq(liveMatches.battleId, battle.id))
      .limit(1);
    const live = liveRows[0];

    await db
      .update(liveMatches)
      .set({
        status: "complete",
        winner: winnerProfileId,
        endedAt: new Date(),
      })
      .where(eq(liveMatches.id, live?.id ?? room.id));

    const profileRows = await db
      .select()
      .from(profiles)
      .where(
        inArray(profiles.id, [
          room.players.a.profileId,
          room.players.b.profileId,
        ]),
      );
    const byId = new Map(profileRows.map((profile) => [profile.id, profile]));
    const profileA = byId.get(room.players.a.profileId);
    const profileB = byId.get(room.players.b.profileId);

    if (profileA && profileB) {
      const scoreA =
        canonical.result.winner === "a"
          ? 1
          : canonical.result.winner === "b"
            ? 0
            : 0.5;
      const deltaA = eloDelta(
        profileA.rating,
        profileB.rating,
        scoreA as 0 | 0.5 | 1,
        placementK(profileA.placementMatches),
      );
      const deltaB = eloDelta(
        profileB.rating,
        profileA.rating,
        (1 - scoreA) as 0 | 0.5 | 1,
        placementK(profileB.placementMatches),
      );

      await db
        .update(profiles)
        .set({
          rating: Math.max(100, profileA.rating + deltaA),
          placementMatches: Math.min(
            PLACEMENT_MATCHES,
            profileA.placementMatches + 1,
          ),
        })
        .where(eq(profiles.id, profileA.id));
      await db
        .update(profiles)
        .set({
          rating: Math.max(100, profileB.rating + deltaB),
          placementMatches: Math.min(
            PLACEMENT_MATCHES,
            profileB.placementMatches + 1,
          ),
        })
        .where(eq(profiles.id, profileB.id));

      await db
        .update(pvpSnapshots)
        .set({
          rating: Math.max(100, profileA.rating + deltaA),
          updatedAt: new Date(),
        })
        .where(eq(pvpSnapshots.ownerId, profileA.id));
      await db
        .update(pvpSnapshots)
        .set({
          rating: Math.max(100, profileB.rating + deltaB),
          updatedAt: new Date(),
        })
        .where(eq(pvpSnapshots.ownerId, profileB.id));

      const aWon = canonical.result.winner === "a";
      await grantBattleRewards(
        profileA,
        room.payload.teamA.map((combatant) => combatant.petId),
        aWon ? 60 : 20,
        aWon ? 40 : 15,
      );
      await grantBattleRewards(
        profileB,
        room.payload.teamB.map((combatant) => combatant.petId),
        aWon ? 20 : 60,
        aWon ? 15 : 40,
      );

      await recordBattleComplete({
        battle: {
          id: battle.id,
          ownerId: battle.ownerId,
          mode: "live",
          payload: room.payload,
          result: canonical.result,
        },
        season: room.season,
      });

      await recordSkillMastery(room.payload.teamA, canonical.events, "a");
      await recordSkillMastery(room.payload.teamB, canonical.events, "b");
    }

    if (live?.tournamentMatchId && winnerProfileId) {
      await advanceTournament(live.tournamentMatchId, winnerProfileId);
    }

    const picks = await db
      .select()
      .from(spectatorPicks)
      .where(eq(spectatorPicks.matchId, room.id));
    for (const pick of picks) {
      const correct = Boolean(winnerProfileId && pick.pickId === winnerProfileId);
      await db
        .update(spectatorPicks)
        .set({ correct, points: correct ? 10 : 0 })
        .where(
          and(
            eq(spectatorPicks.matchId, room.id),
            eq(spectatorPicks.voterId, pick.voterId),
          ),
        );
      if (correct) {
        await db
          .update(profiles)
          .set({ spectatorPoints: sql`${profiles.spectatorPoints} + 10` })
          .where(eq(profiles.id, pick.voterId));
      }
    }

    setTimeout(() => {
      rooms.delete(room.id);
    }, 10 * 60_000);
  } catch (error) {
    logEvent("error", "live.finish_failed", {
      matchId: room.id,
      error: error instanceof Error ? error.message : String(error),
    });
    room.finishing = false;
  }
}
