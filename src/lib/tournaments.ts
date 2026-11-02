import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  liveMatches,
  profiles,
  tournamentEntries,
  tournamentMatches,
  tournaments,
} from "@/lib/db/schema";
import { createBattleRow, loadTeamPets } from "@/lib/game/battles";
import { teamToCombatants } from "@/lib/game/team";
import { createLiveRoom } from "@/lib/live/rooms";
import { signLiveTicket } from "@/lib/live/ticket";

export async function listTournaments() {
  const db = await getDb();
  return db
    .select()
    .from(tournaments)
    .orderBy(desc(tournaments.createdAt))
    .limit(20);
}

export async function getTournamentDetail(id: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);
  const tournament = rows[0];
  if (!tournament) return null;

  const entries = await db
    .select({ entry: tournamentEntries, profile: profiles })
    .from(tournamentEntries)
    .innerJoin(profiles, eq(tournamentEntries.profileId, profiles.id))
    .where(eq(tournamentEntries.tournamentId, id))
    .orderBy(asc(tournamentEntries.seed));

  const matches = await db
    .select()
    .from(tournamentMatches)
    .where(eq(tournamentMatches.tournamentId, id))
    .orderBy(asc(tournamentMatches.round), asc(tournamentMatches.slot));

  const profileIds = [
    ...new Set(
      matches.flatMap((match) =>
        [match.playerA, match.playerB, match.winner].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ),
  ];
  const names = new Map<string, string>();
  if (profileIds.length > 0) {
    const profileRows = await db
      .select({ id: profiles.id, displayName: profiles.displayName })
      .from(profiles);
    for (const profile of profileRows) names.set(profile.id, profile.displayName);
  }

  return {
    tournament,
    entries: entries.map(({ entry, profile }) => ({
      ...entry,
      displayName: profile.displayName,
      rating: profile.rating,
    })),
    matches: matches.map((match) => ({
      ...match,
      playerAName: match.playerA ? names.get(match.playerA) ?? "Trainer" : null,
      playerBName: match.playerB ? names.get(match.playerB) ?? "Trainer" : null,
      winnerName: match.winner ? names.get(match.winner) ?? "Trainer" : null,
    })),
  };
}

export async function joinTournament(id: string, profileId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);
  const tournament = rows[0];
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "draft") throw new Error("Tournament already started");

  const entries = await db
    .select({ profileId: tournamentEntries.profileId })
    .from(tournamentEntries)
    .where(eq(tournamentEntries.tournamentId, id));
  if (entries.some((entry) => entry.profileId === profileId)) {
    return { joined: true };
  }
  if (entries.length >= tournament.size) throw new Error("Tournament is full");

  await db.insert(tournamentEntries).values({
    tournamentId: id,
    profileId,
    seed: entries.length + 1,
  });
  return { joined: true };
}

export async function startTournament(id: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);
  const tournament = rows[0];
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "draft") throw new Error("Tournament already started");

  const entries = await db
    .select({ entry: tournamentEntries, profile: profiles })
    .from(tournamentEntries)
    .innerJoin(profiles, eq(tournamentEntries.profileId, profiles.id))
    .where(eq(tournamentEntries.tournamentId, id))
    .orderBy(desc(profiles.rating));

  if (entries.length < tournament.size) {
    throw new Error(`Need ${tournament.size} trainers (${entries.length} joined)`);
  }

  const size = tournament.size;
  const rounds = Math.log2(size);
  if (!Number.isInteger(rounds) || ![4, 8, 16].includes(size)) {
    throw new Error("Unsupported tournament size");
  }

  const values: Array<{
    tournamentId: string;
    round: number;
    slot: number;
    playerA: string | null;
    playerB: string | null;
  }> = [];
  for (let round = 1; round <= rounds; round += 1) {
    const matchesInRound = size / 2 ** round;
    for (let slot = 0; slot < matchesInRound; slot += 1) {
      values.push({
        tournamentId: id,
        round,
        slot,
        playerA: round === 1 ? entries[slot * 2]?.profile.id ?? null : null,
        playerB: round === 1 ? entries[slot * 2 + 1]?.profile.id ?? null : null,
      });
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, id));
    await tx.insert(tournamentMatches).values(values);
    await tx
      .update(tournaments)
      .set({ status: "active" })
      .where(eq(tournaments.id, id));
  });

  return { started: true };
}

export async function startTournamentMatch(
  tournamentId: string,
  matchId: string,
  profileId: string,
) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(tournamentMatches)
    .where(
      and(
        eq(tournamentMatches.id, matchId),
        eq(tournamentMatches.tournamentId, tournamentId),
      ),
    )
    .limit(1);
  const match = rows[0];
  if (!match) throw new Error("Bracket match not found");
  if (match.playerA !== profileId && match.playerB !== profileId) {
    throw new Error("You are not in this bracket match");
  }
  if (match.status === "complete") throw new Error("Bracket match is already complete");

  if (match.liveMatchId) {
    const liveRows = await db
      .select()
      .from(liveMatches)
      .where(eq(liveMatches.id, match.liveMatchId))
      .limit(1);
    const live = liveRows[0];
    if (!live) throw new Error("Live match no longer exists");
    const seat = live.playerA === profileId ? "a" : "b";
    return {
      matchId: live.id,
      seat,
      ticket: signLiveTicket({
        matchId: live.id,
        profileId,
        seat,
        spectator: false,
      }),
    };
  }

  if (!match.playerA || !match.playerB) throw new Error("Both players are not set");
  const tournamentRows = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  const tournament = tournamentRows[0];
  if (!tournament) throw new Error("Tournament not found");

  const profileRows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, match.playerA));
  const profileA = profileRows[0];
  const profileBRows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, match.playerB))
    .limit(1);
  const profileB = profileBRows[0];
  if (!profileA || !profileB) throw new Error("Player profile missing");

  const teamA = await loadTeamPets(profileA.id);
  const teamB = await loadTeamPets(profileB.id);
  if (teamA.length === 0 || teamB.length === 0) {
    throw new Error("Both players need a team");
  }

  const liveId = crypto.randomUUID();
  const seed = crypto.randomUUID();
  const payload = {
    teamA: teamToCombatants(teamA),
    teamB: teamToCombatants(teamB),
    ai: { a: false, b: false },
  };
  const battle = await createBattleRow({
    ownerId: profileA.id,
    mode: "live",
    seed,
    payload,
  });

  await db.insert(liveMatches).values({
    id: liveId,
    roomId: liveId,
    battleId: battle.id,
    tournamentMatchId: match.id,
    season: tournament.season,
    playerA: profileA.id,
    playerB: profileB.id,
    status: "active",
    startedAt: new Date(),
  });
  await db
    .update(tournamentMatches)
    .set({ liveMatchId: liveId, status: "active" })
    .where(eq(tournamentMatches.id, match.id));

  createLiveRoom({
    matchId: liveId,
    battleId: battle.id,
    season: tournament.season,
    seed,
    payload,
    players: {
      a: {
        profileId: profileA.id,
        displayName: profileA.displayName,
        rating: profileA.rating,
        placementMatches: profileA.placementMatches,
      },
      b: {
        profileId: profileB.id,
        displayName: profileB.displayName,
        rating: profileB.rating,
        placementMatches: profileB.placementMatches,
      },
    },
  });

  const seat = profileA.id === profileId ? "a" : "b";
  return {
    matchId: liveId,
    seat,
    ticket: signLiveTicket({
      matchId: liveId,
      profileId,
      seat,
      spectator: false,
    }),
  };
}
