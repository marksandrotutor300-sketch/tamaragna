import { and, eq, ne, or, sql } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import {
  liveMatches,
  matchmakingQueue,
  profiles,
} from "@/lib/db/schema";
import { featureUnavailable } from "@/lib/features";
import { createBattleRow, loadTeamPets } from "@/lib/game/battles";
import { teamToCombatants } from "@/lib/game/team";
import { createLiveRoom, getLiveRoom } from "@/lib/live/rooms";
import { signLiveTicket } from "@/lib/live/ticket";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

function ticketFor(
  matchId: string,
  profileId: string,
  seat: "a" | "b",
): string {
  return signLiveTicket({
    matchId,
    profileId,
    seat,
    spectator: false,
  });
}

export async function POST(): Promise<Response> {
  const disabled = featureUnavailable("livePvp");
  if (disabled) return disabled;

  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:live-queue`, LIMITS.liveQueue))) {
      return fail("Too many queue requests - slow down", 429);
    }

    const team = await loadTeamPets(profile.id);
    if (team.length === 0) {
      return fail("Put at least one pet on your team first", 400);
    }

    const db = await getDb();
    const candidates = await db
      .select({ queue: matchmakingQueue, opponent: profiles })
      .from(matchmakingQueue)
      .innerJoin(profiles, eq(matchmakingQueue.profileId, profiles.id))
      .where(
        and(
          eq(matchmakingQueue.season, profile.season),
          ne(matchmakingQueue.profileId, profile.id),
        ),
      )
      .orderBy(sql`abs(${matchmakingQueue.rating} - ${profile.rating})`)
      .limit(1);

    const opponent = candidates[0];
    if (!opponent) {
      await db
        .insert(matchmakingQueue)
        .values({
          profileId: profile.id,
          season: profile.season,
          rating: profile.rating,
        })
        .onConflictDoUpdate({
          target: matchmakingQueue.profileId,
          set: {
            season: profile.season,
            rating: profile.rating,
            enqueuedAt: new Date(),
            matchedAt: null,
          },
        });
      return ok({ matched: false, waiting: true });
    }

    if (opponent.opponent.id === profile.id) {
      return ok({ matched: false, waiting: true });
    }

    const opponentTeam = await loadTeamPets(opponent.opponent.id);
    if (opponentTeam.length === 0) {
      await db
        .delete(matchmakingQueue)
        .where(eq(matchmakingQueue.profileId, opponent.opponent.id));
      return ok({ matched: false, waiting: true, message: "Opponent not ready" });
    }

    const matchId = crypto.randomUUID();
    const seed = crypto.randomUUID();
    const payload = {
      teamA: teamToCombatants(team),
      teamB: teamToCombatants(opponentTeam),
      ai: { a: false, b: false },
    };

    const battle = await createBattleRow({
      ownerId: profile.id,
      mode: "live",
      seed,
      payload,
    });

    await db.transaction(async (tx) => {
      await tx
        .delete(matchmakingQueue)
        .where(
          or(
            eq(matchmakingQueue.profileId, profile.id),
            eq(matchmakingQueue.profileId, opponent.opponent.id),
          ),
        );
      await tx.insert(liveMatches).values({
        id: matchId,
        roomId: matchId,
        battleId: battle.id,
        season: profile.season,
        playerA: profile.id,
        playerB: opponent.opponent.id,
        status: "active",
        startedAt: new Date(),
      });
    });

    createLiveRoom({
      matchId,
      battleId: battle.id,
      season: profile.season,
      seed,
      payload,
      players: {
        a: {
          profileId: profile.id,
          displayName: profile.displayName,
          rating: profile.rating,
          placementMatches: profile.placementMatches,
        },
        b: {
          profileId: opponent.opponent.id,
          displayName: opponent.opponent.displayName,
          rating: opponent.opponent.rating,
          placementMatches: opponent.opponent.placementMatches,
        },
      },
    });

    return ok({
      matched: true,
      matchId,
      seat: "a",
      ticket: ticketFor(matchId, profile.id, "a"),
      opponent: {
        displayName: opponent.opponent.displayName,
        rating: opponent.opponent.rating,
      },
    });
  });
}

export async function GET(): Promise<Response> {
  const disabled = featureUnavailable("livePvp");
  if (disabled) return disabled;

  return withUser(async (profile) => {
    const db = await getDb();
    const matches = await db
      .select()
      .from(liveMatches)
      .where(
        and(
          or(
            eq(liveMatches.playerA, profile.id),
            eq(liveMatches.playerB, profile.id),
          ),
          eq(liveMatches.status, "active"),
        ),
      )
      .orderBy(sql`${liveMatches.createdAt} desc`)
      .limit(1);
    const match = matches[0];

    if (match) {
      const seat = match.playerA === profile.id ? "a" : "b";
      return ok({
        matched: true,
        matchId: match.id,
        seat,
        ticket: ticketFor(match.id, profile.id, seat),
        roomLive: Boolean(getLiveRoom(match.id)),
      });
    }

    const queued = await db
      .select({ profileId: matchmakingQueue.profileId })
      .from(matchmakingQueue)
      .where(eq(matchmakingQueue.profileId, profile.id))
      .limit(1);

    return ok({ matched: false, waiting: Boolean(queued[0]) });
  });
}

export async function DELETE(): Promise<Response> {
  const disabled = featureUnavailable("livePvp");
  if (disabled) return disabled;

  return withUser(async (profile) => {
    const db = await getDb();
    await db
      .delete(matchmakingQueue)
      .where(eq(matchmakingQueue.profileId, profile.id));
    return ok({ cancelled: true });
  });
}
