import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CareState, Ivs } from "@/lib/game/types";
import type { QuestState } from "@/lib/game/quests";
import type { BattleInput, BattleResult, CombatantInit } from "@/lib/sim/types";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: text("device_id").notNull().unique(),
  displayName: text("display_name").notNull().default("Trainer"),
  coins: integer("coins").notNull().default(500),
  eggs: integer("eggs").notNull().default(1),
  food: integer("food").notNull().default(5),
  rating: integer("rating").notNull().default(1000),
  season: smallint("season").notNull().default(1),
  placementMatches: smallint("placement_matches").notNull().default(0),
  lastBattleAt: timestamp("last_battle_at", { withTimezone: true }),
  publicSlug: text("public_slug"),
  publicCard: boolean("public_card").notNull().default(false),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  legacyPoints: integer("legacy_points").notNull().default(0),
  spectatorPoints: integer("spectator_points").notNull().default(0),
  habitat: text("habitat").notNull().default("verdant"),
  materials: integer("materials").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("profiles_public_slug_idx")
    .on(table.publicSlug)
    .where(sql`public_slug IS NOT NULL`),
  uniqueIndex("profiles_user_idx")
    .on(table.userId)
    .where(sql`user_id IS NOT NULL`),
]);

export const seasons = pgTable("seasons", {
  id: smallint("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const pets = pgTable(
  "pets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    speciesId: integer("species_id").notNull(),
    nickname: text("nickname").notNull(),
    rarity: smallint("rarity").notNull(),
    nature: text("nature").notNull().default("hardy"),
    star: smallint("star").notNull().default(1),
    level: smallint("level").notNull().default(1),
    exp: integer("exp").notNull().default(0),
    slot: smallint("slot"),
    ivs: jsonb("ivs").$type<Ivs>().notNull(),
    care: jsonb("care").$type<CareState>().notNull(),
    loadout: jsonb("loadout").$type<number[]>(),
    evolutionStage: smallint("evolution_stage").notNull().default(1),
    parentAId: uuid("parent_a_id"),
    parentBId: uuid("parent_b_id"),
    marketListed: boolean("market_listed").notNull().default(false),
    expeditionId: uuid("expedition_id"),
    legacyTrait: text("legacy_trait"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("pets_owner_slot_idx").on(table.ownerId, table.slot),
    index("pets_parents_idx").on(table.parentAId, table.parentBId),
  ],
);

export const petSkillMastery = pgTable(
  "pet_skill_mastery",
  {
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    skillId: integer("skill_id").notNull(),
    level: smallint("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.petId, table.skillId] })],
);

export const battles = pgTable(
  "battles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mode: text("mode").notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    opponentSnapshotId: uuid("opponent_snapshot_id"),
    towerRunId: uuid("tower_run_id"),
    seed: text("seed").notNull(),
    payload: jsonb("payload").$type<BattlePayload>().notNull(),
    inputLog: jsonb("input_log").$type<BattleInput[]>(),
    result: jsonb("result").$type<BattleResult>(),
    resultHash: text("result_hash"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("battles_owner_created_idx").on(table.ownerId, table.createdAt),
    index("battles_opponent_idx").on(table.opponentSnapshotId),
    index("battles_status_idx").on(table.status),
  ],
);

export const towerRuns = pgTable(
  "tower_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    seed: text("seed").notNull(),
    wave: integer("wave").notNull().default(0),
    highestWave: integer("highest_wave").notNull().default(0),
    teamState: jsonb("team_state").$type<TowerTeamState>().notNull(),
    blessings: jsonb("blessings")
      .$type<Array<{ wave: number; id: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: text("status").notNull().default("active"),
    elapsedMs: integer("elapsed_ms").notNull().default(0),
    season: smallint("season").notNull().default(1),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [
    index("tower_owner_status_idx").on(table.ownerId, table.status),
    index("tower_leaderboard_idx").on(
      table.status,
      table.highestWave,
      table.elapsedMs,
    ),
  ],
);

export const pvpSnapshots = pgTable(
  "pvp_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .unique()
      .references(() => profiles.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    season: smallint("season").notNull().default(1),
    team: jsonb("team").$type<CombatantInit[]>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [index("pvp_snapshots_season_rating_idx").on(table.season, table.rating)],
);

export const questStates = pgTable("quest_states", {
  profileId: uuid("profile_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  state: jsonb("state").$type<QuestState>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seasonRewards = pgTable(
  "season_rewards",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    season: smallint("season").notNull(),
    rating: integer("rating").notNull(),
    tier: text("tier").notNull(),
    coins: integer("coins").notNull(),
    eggs: integer("eggs").notNull(),
    claimed: boolean("claimed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.season] }),
    index("season_rewards_profile_claimed_idx").on(table.profileId, table.claimed),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type SeasonMeta = typeof seasons.$inferSelect;
export type Pet = typeof pets.$inferSelect;
export type Battle = typeof battles.$inferSelect;
export type TowerRun = typeof towerRuns.$inferSelect;
export type PvpSnapshot = typeof pvpSnapshots.$inferSelect;
export type QuestStateRow = typeof questStates.$inferSelect;
export type SeasonReward = typeof seasonRewards.$inferSelect;

export const schemaMigrations = pgTable("schema_migrations", {
  version: text("version").primaryKey(),
  name: text("name").notNull().default(""),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export const battleShares = pgTable(
  "battle_shares",
  {
    token: text("token").primaryKey(),
    battleId: uuid("battle_id")
      .notNull()
      .references(() => battles.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    visibility: text("visibility").notNull().default("unlisted"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("battle_shares_battle_idx").on(table.battleId),
    index("battle_shares_owner_idx").on(table.ownerId, table.createdAt),
  ],
);

export type BattleShare = typeof battleShares.$inferSelect;

export const liveMatches = pgTable(
  "live_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: text("room_id").notNull().unique(),
    battleId: uuid("battle_id").references(() => battles.id, { onDelete: "set null" }),
    tournamentMatchId: uuid("tournament_match_id"),
    season: smallint("season").notNull(),
    playerA: uuid("player_a")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    playerB: uuid("player_b")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    winner: uuid("winner").references(() => profiles.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("live_matches_players_idx").on(table.playerA, table.playerB, table.status),
  ],
);

export const matchmakingQueue = pgTable("matchmaking_queue", {
  profileId: uuid("profile_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  season: smallint("season").notNull(),
  rating: integer("rating").notNull(),
  enqueuedAt: timestamp("enqueued_at", { withTimezone: true }).notNull().defaultNow(),
  matchedAt: timestamp("matched_at", { withTimezone: true }),
});

export const tournaments = pgTable("tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  season: smallint("season").notNull(),
  format: text("format").notNull().default("single-elimination"),
  status: text("status").notNull().default("draft"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  size: smallint("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tournamentEntries = pgTable(
  "tournament_entries",
  {
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    seed: integer("seed"),
    checkedIn: boolean("checked_in").notNull().default(false),
    eliminatedAt: timestamp("eliminated_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.tournamentId, table.profileId] }),
  ],
);

export const tournamentMatches = pgTable(
  "tournament_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    round: smallint("round").notNull(),
    slot: smallint("slot").notNull(),
    playerA: uuid("player_a").references(() => profiles.id, { onDelete: "set null" }),
    playerB: uuid("player_b").references(() => profiles.id, { onDelete: "set null" }),
    liveMatchId: uuid("live_match_id").references(() => liveMatches.id, {
      onDelete: "set null",
    }),
    winner: uuid("winner").references(() => profiles.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
  },
  (table) => [
    index("tournament_matches_tournament_idx").on(
      table.tournamentId,
      table.round,
      table.slot,
    ),
  ],
);

export const guilds = pgTable("guilds", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  tag: text("tag").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const guildMembers = pgTable(
  "guild_members",
  {
    guildId: uuid("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .unique()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.profileId] })],
);

export const guildRaids = pgTable(
  "guild_raids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guildId: uuid("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    bossSpeciesId: integer("boss_species_id").notNull(),
    bossName: text("boss_name").notNull(),
    maxHp: integer("max_hp").notNull(),
    hp: integer("hp").notNull(),
    status: text("status").notNull().default("active"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("guild_raids_guild_idx").on(table.guildId, table.status)],
);

export const guildContributions = pgTable(
  "guild_contributions",
  {
    raidId: uuid("raid_id")
      .notNull()
      .references(() => guildRaids.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    damage: integer("damage").notNull().default(0),
    attacks: integer("attacks").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.raidId, table.profileId] })],
);

export const marketListings = pgTable(
  "market_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    price: integer("price").notNull(),
    fee: integer("fee").notNull().default(0),
    status: text("status").notNull().default("active"),
    buyerId: uuid("buyer_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    soldAt: timestamp("sold_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("market_active_pet_idx")
      .on(table.petId)
      .where(sql`status = 'active'`),
    index("market_status_idx").on(table.status, table.createdAt),
  ],
);

export type ExpeditionRewards = {
  coins: number;
  eggs: number;
  materials: number;
};

export const expeditions = pgTable(
  "expeditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    routeId: text("route_id").notNull(),
    petIds: jsonb("pet_ids").$type<string[]>().notNull(),
    rewards: jsonb("rewards").$type<ExpeditionRewards>().notNull(),
    status: text("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (table) => [
    index("expeditions_profile_idx").on(table.profileId, table.status),
  ],
);

export const ranchVisits = pgTable(
  "ranch_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    visitorId: uuid("visitor_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    message: text("message").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ranch_visits_host_idx").on(table.hostId, table.createdAt),
  ],
);

export const rankedCups = pgTable("ranked_cups", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .unique()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  season: smallint("season").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const spectatorPicks = pgTable(
  "spectator_picks",
  {
    matchId: uuid("match_id").notNull(),
    voterId: uuid("voter_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    pickId: uuid("pick_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    correct: boolean("correct"),
    points: integer("points").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.matchId, table.voterId] })],
);

export const legacyMarks = pgTable(
  "legacy_marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    speciesId: integer("species_id").notNull(),
    trait: text("trait").notNull(),
    sourceName: text("source_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("legacy_marks_profile_idx").on(table.profileId, table.createdAt),
  ],
);

export const dojoGhosts = pgTable(
  "dojo_ghosts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    team: jsonb("team").$type<CombatantInit[]>().notNull(),
    source: text("source").notNull().default("team"),
    difficulty: integer("difficulty").notNull().default(1),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("dojo_ghosts_owner_idx").on(table.ownerId, table.createdAt)],
);

export const dojoRuns = pgTable("dojo_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  ghostId: uuid("ghost_id")
    .notNull()
    .references(() => dojoGhosts.id, { onDelete: "cascade" }),
  winner: text("winner").notNull(),
  battleId: uuid("battle_id").references(() => battles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: smallint("version").notNull().default(1),
    event: text("event").notNull(),
    season: smallint("season"),
    mode: text("mode"),
    battleId: uuid("battle_id"),
    actorId: uuid("actor_id"),
    winner: text("winner"),
    durationMs: integer("duration_ms"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("analytics_events_created_idx").on(table.createdAt),
    index("analytics_events_event_idx").on(table.event, table.createdAt),
  ],
);

export const balanceDaily = pgTable(
  "balance_daily",
  {
    day: text("day").notNull(),
    season: smallint("season").notNull(),
    mode: text("mode").notNull(),
    dimension: text("dimension").notNull(),
    key: text("key").notNull(),
    battles: integer("battles").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    picks: integer("picks").notNull().default(0),
    damageSum: integer("damage_sum").notNull().default(0),
  },
  (table) => [
    primaryKey({
      columns: [table.day, table.season, table.mode, table.dimension, table.key],
    }),
  ],
);

export const transferCodes = pgTable(
  "transfer_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("transfer_codes_profile_idx").on(table.profileId, table.usedAt)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("rate_limits_reset_idx").on(table.resetAt)],
);

export type TransferCode = typeof transferCodes.$inferSelect;

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("sessions_user_idx").on(table.userId, table.revokedAt)],
);

export const emailTokens = pgTable(
  "email_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    email: text("email").notNull(),
    purpose: text("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("email_tokens_email_idx").on(table.email, table.usedAt)],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    preferences: jsonb("preferences")
      .$type<Record<string, boolean>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => [
    index("push_subscriptions_user_idx").on(table.userId, table.disabledAt),
  ],
);

export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => pushSubscriptions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notification_log_sub_idx").on(
      table.subscriptionId,
      table.kind,
      table.sentAt,
    ),
  ],
);

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  response: jsonb("response").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Session = typeof sessions.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export type BattlePayload = {
  /** Latest is 2 once evolution/mastery are baked into combatants. */
  version?: number;
  teamA: CombatantInit[];
  teamB: CombatantInit[];
  ai: { a: boolean; b: boolean };
  maxMs?: number;
  wave?: number;
};

export type TowerTeamState = {
  combatants: CombatantInit[];
};
