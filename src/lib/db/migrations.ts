import { desc, sql } from "drizzle-orm";
import type { Db } from "./client";
import { schemaMigrations } from "./schema";

export type Migration = {
  version: string;
  name: string;
  sql: string;
};

/**
 * Additive migrations only. The idempotent DDL is the baseline; migrations
 * after it are applied in order and recorded in schema_migrations.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: "0001_share_replay",
    name: "share tokens, public trainer cards",
    sql: `
      CREATE TABLE IF NOT EXISTS battle_shares (
        token text PRIMARY KEY,
        battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
        owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        visibility text NOT NULL DEFAULT 'unlisted',
        created_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS battle_shares_battle_idx ON battle_shares (battle_id);
      CREATE INDEX IF NOT EXISTS battle_shares_owner_idx ON battle_shares (owner_id, created_at);

      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_slug text;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_card boolean NOT NULL DEFAULT false;
      CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_slug_idx
        ON profiles (public_slug) WHERE public_slug IS NOT NULL;
    `,
  },
  {
    version: "0002_telemetry",
    name: "battle analytics and daily balance aggregates",
    sql: `
      CREATE TABLE IF NOT EXISTS analytics_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        version smallint NOT NULL DEFAULT 1,
        event text NOT NULL,
        season smallint,
        mode text,
        battle_id uuid,
        actor_id uuid,
        winner text,
        duration_ms integer,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS analytics_events_created_idx ON analytics_events (created_at);
      CREATE INDEX IF NOT EXISTS analytics_events_event_idx ON analytics_events (event, created_at);

      CREATE TABLE IF NOT EXISTS balance_daily (
        day date NOT NULL,
        season smallint NOT NULL,
        mode text NOT NULL,
        dimension text NOT NULL,
        key text NOT NULL,
        battles integer NOT NULL DEFAULT 0,
        wins integer NOT NULL DEFAULT 0,
        picks integer NOT NULL DEFAULT 0,
        damage_sum bigint NOT NULL DEFAULT 0,
        PRIMARY KEY (day, season, mode, dimension, key)
      );
    `,
  },
  {
    version: "0003_accounts_push",
    name: "magic-link accounts, sessions, push and idempotency",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        email_verified_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        user_agent text,
        ip_hash text,
        revoked_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id, revoked_at);

      CREATE TABLE IF NOT EXISTS email_tokens (
        token_hash text PRIMARY KEY,
        email text NOT NULL,
        purpose text NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS email_tokens_email_idx ON email_tokens (email, used_at);

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        endpoint text NOT NULL UNIQUE,
        keys jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        disabled_at timestamptz,
        preferences jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id, disabled_at);

      CREATE TABLE IF NOT EXISTS notification_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        subscription_id uuid NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
        kind text NOT NULL,
        sent_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS notification_log_sub_idx ON notification_log (subscription_id, kind, sent_at);

      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_idx
        ON profiles (user_id) WHERE user_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key text PRIMARY KEY,
        profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        response jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    version: "0004_evolution_mastery",
    name: "evolution stages, lineage parents and skill mastery",
    sql: `
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS evolution_stage smallint NOT NULL DEFAULT 1;
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS parent_a_id uuid REFERENCES pets(id) ON DELETE SET NULL;
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS parent_b_id uuid REFERENCES pets(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS pets_parents_idx ON pets (parent_a_id, parent_b_id);

      CREATE TABLE IF NOT EXISTS pet_skill_mastery (
        pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        skill_id integer NOT NULL,
        level smallint NOT NULL DEFAULT 1,
        xp integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (pet_id, skill_id)
      );
    `,
  },
  {
    version: "0005_live_pvp",
    name: "live matches, matchmaking and tournaments",
    sql: `
      CREATE TABLE IF NOT EXISTS live_matches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id text NOT NULL UNIQUE,
        battle_id uuid REFERENCES battles(id) ON DELETE SET NULL,
        tournament_match_id uuid,
        season smallint NOT NULL,
        player_a uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        player_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'pending',
        winner uuid REFERENCES profiles(id) ON DELETE SET NULL,
        started_at timestamptz,
        ended_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS live_matches_players_idx
        ON live_matches (player_a, player_b, status);

      CREATE TABLE IF NOT EXISTS matchmaking_queue (
        profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        season smallint NOT NULL,
        rating integer NOT NULL,
        enqueued_at timestamptz NOT NULL DEFAULT now(),
        matched_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS tournaments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        season smallint NOT NULL,
        format text NOT NULL DEFAULT 'single-elimination',
        status text NOT NULL DEFAULT 'draft',
        starts_at timestamptz NOT NULL,
        size smallint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS tournament_entries (
        tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        seed integer,
        checked_in boolean NOT NULL DEFAULT false,
        eliminated_at timestamptz,
        PRIMARY KEY (tournament_id, profile_id)
      );

      CREATE TABLE IF NOT EXISTS tournament_matches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        round smallint NOT NULL,
        slot smallint NOT NULL,
        player_a uuid REFERENCES profiles(id) ON DELETE SET NULL,
        player_b uuid REFERENCES profiles(id) ON DELETE SET NULL,
        live_match_id uuid REFERENCES live_matches(id) ON DELETE SET NULL,
        winner uuid REFERENCES profiles(id) ON DELETE SET NULL,
        status text NOT NULL DEFAULT 'pending',
        UNIQUE (tournament_id, round, slot)
      );
    `,
  },
  {
    version: "0006_seven_upgrades",
    name: "guilds, market, expeditions, habitats, circuit, legacy and dojo",
    sql: `
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS legacy_points integer NOT NULL DEFAULT 0;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spectator_points integer NOT NULL DEFAULT 0;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS habitat text NOT NULL DEFAULT 'verdant';
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS materials integer NOT NULL DEFAULT 0;

      ALTER TABLE pets ADD COLUMN IF NOT EXISTS market_listed boolean NOT NULL DEFAULT false;
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS expedition_id uuid;
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS legacy_trait text;

      CREATE TABLE IF NOT EXISTS guilds (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE,
        tag text NOT NULL,
        owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        description text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS guild_members (
        guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        profile_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
        role text NOT NULL DEFAULT 'member',
        joined_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (guild_id, profile_id)
      );

      CREATE TABLE IF NOT EXISTS guild_raids (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        boss_species_id integer NOT NULL,
        boss_name text NOT NULL,
        max_hp integer NOT NULL,
        hp integer NOT NULL,
        status text NOT NULL DEFAULT 'active',
        starts_at timestamptz NOT NULL DEFAULT now(),
        ends_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS guild_raids_guild_idx ON guild_raids (guild_id, status);

      CREATE TABLE IF NOT EXISTS guild_contributions (
        raid_id uuid NOT NULL REFERENCES guild_raids(id) ON DELETE CASCADE,
        profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        damage integer NOT NULL DEFAULT 0,
        attacks integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (raid_id, profile_id)
      );

      CREATE TABLE IF NOT EXISTS market_listings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
        price integer NOT NULL,
        fee integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'active',
        buyer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        sold_at timestamptz
      );
      CREATE UNIQUE INDEX IF NOT EXISTS market_active_pet_idx
        ON market_listings (pet_id) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS market_status_idx ON market_listings (status, created_at);

      CREATE TABLE IF NOT EXISTS expeditions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        route_id text NOT NULL,
        pet_ids jsonb NOT NULL,
        rewards jsonb NOT NULL,
        status text NOT NULL DEFAULT 'active',
        started_at timestamptz NOT NULL DEFAULT now(),
        ends_at timestamptz NOT NULL,
        claimed_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS expeditions_profile_idx ON expeditions (profile_id, status);

      CREATE TABLE IF NOT EXISTS ranch_visits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        host_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        visitor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        message text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS ranch_visits_host_idx ON ranch_visits (host_id, created_at);

      CREATE TABLE IF NOT EXISTS ranked_cups (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tournament_id uuid NOT NULL UNIQUE REFERENCES tournaments(id) ON DELETE CASCADE,
        name text NOT NULL,
        season smallint NOT NULL,
        starts_at timestamptz NOT NULL,
        status text NOT NULL DEFAULT 'scheduled',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS spectator_picks (
        match_id uuid NOT NULL,
        voter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        pick_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        correct boolean,
        points integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (match_id, voter_id)
      );

      CREATE TABLE IF NOT EXISTS legacy_marks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        species_id integer NOT NULL,
        trait text NOT NULL,
        source_name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS legacy_marks_profile_idx ON legacy_marks (profile_id, created_at);

      CREATE TABLE IF NOT EXISTS dojo_ghosts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        name text NOT NULL,
        team jsonb NOT NULL,
        source text NOT NULL DEFAULT 'team',
        difficulty integer NOT NULL DEFAULT 1,
        wins integer NOT NULL DEFAULT 0,
        losses integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS dojo_ghosts_owner_idx ON dojo_ghosts (owner_id, created_at);

      CREATE TABLE IF NOT EXISTS dojo_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        ghost_id uuid NOT NULL REFERENCES dojo_ghosts(id) ON DELETE CASCADE,
        winner text NOT NULL,
        battle_id uuid REFERENCES battles(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    version: "0007_super_admin",
    name: "super-admin role, stat overrides and admin audit log",
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

      ALTER TABLE pets ADD COLUMN IF NOT EXISTS stat_overrides jsonb;

      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_label text NOT NULL,
        action text NOT NULL,
        target_profile_id uuid,
        target_pet_id uuid,
        detail jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at);
    `,
  },
  {
    version: "0008_admin_roles",
    name: "owner/admin hierarchy and role event log",
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role text;

      UPDATE users
      SET admin_role = 'admin'
      WHERE is_super_admin = true AND admin_role IS NULL;

      UPDATE users
      SET admin_role = 'owner'
      WHERE id = (
        SELECT id FROM users
        WHERE admin_role = 'admin'
        ORDER BY created_at ASC
        LIMIT 1
      );

      CREATE TABLE IF NOT EXISTS admin_role_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        actor_label text NOT NULL,
        target_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_email text NOT NULL,
        action text NOT NULL,
        previous_role text,
        new_role text,
        reason text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS admin_role_events_target_idx
        ON admin_role_events (target_user_id, created_at);
      CREATE INDEX IF NOT EXISTS admin_role_events_actor_idx
        ON admin_role_events (actor_user_id, created_at);
    `,
  },
  {
    version: "0009_card_crusade",
    name: "rift deck runs, card battles and reward ledger",
    sql: `
      CREATE TABLE IF NOT EXISTS card_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        seed text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        act smallint NOT NULL DEFAULT 1,
        node_id text,
        map jsonb NOT NULL,
        deck jsonb NOT NULL,
        relics jsonb NOT NULL DEFAULT '[]'::jsonb,
        champions jsonb NOT NULL,
        run_gold integer NOT NULL DEFAULT 0,
        pending jsonb,
        score integer NOT NULL DEFAULT 0,
        elapsed_ms integer NOT NULL DEFAULT 0,
        season smallint NOT NULL DEFAULT 1,
        completed_node_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        reward_coins integer NOT NULL DEFAULT 0,
        reward_materials integer NOT NULL DEFAULT 0,
        reward_eggs integer NOT NULL DEFAULT 0,
        reward_xp integer NOT NULL DEFAULT 0,
        rewarded_at timestamptz,
        started_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS card_runs_owner_status_idx ON card_runs (owner_id, status);
      CREATE INDEX IF NOT EXISTS card_runs_leaderboard_idx
        ON card_runs (status, score DESC, elapsed_ms);
      CREATE UNIQUE INDEX IF NOT EXISTS card_runs_active_idx
        ON card_runs (owner_id) WHERE status = 'active';

      CREATE TABLE IF NOT EXISTS card_battles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        run_id uuid NOT NULL REFERENCES card_runs(id) ON DELETE CASCADE,
        node_id text NOT NULL,
        seed text NOT NULL,
        state jsonb NOT NULL,
        input_log jsonb NOT NULL DEFAULT '[]'::jsonb,
        result jsonb,
        result_hash text,
        version integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS card_battles_run_status_idx ON card_battles (run_id, status);
      CREATE INDEX IF NOT EXISTS card_battles_owner_idx ON card_battles (owner_id, created_at);
    `,
  },
  {
    version: "0010_rift_upgrades",
    name: "ascension, rift paths, signatures, evolved relics and edicts",
    sql: `
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rift_essence integer NOT NULL DEFAULT 0;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rift_edicts jsonb NOT NULL DEFAULT '[]'::jsonb;

      ALTER TABLE card_runs ADD COLUMN IF NOT EXISTS ascension smallint NOT NULL DEFAULT 0;
      ALTER TABLE card_runs ADD COLUMN IF NOT EXISTS path text NOT NULL DEFAULT 'balanced';
      ALTER TABLE card_runs ADD COLUMN IF NOT EXISTS edicts jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE card_runs ADD COLUMN IF NOT EXISTS reward_essence integer NOT NULL DEFAULT 0;
    `,
  },
  {
    version: "0011_rift_contracts",
    name: "rift contracts",
    sql: `
      ALTER TABLE card_runs ADD COLUMN IF NOT EXISTS contracts jsonb NOT NULL DEFAULT '[]'::jsonb;
    `,
  },
];

function splitStatements(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export async function runMigrations(db: Db): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      name text NOT NULL DEFAULT '',
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const appliedRows = await db
    .select({ version: schemaMigrations.version })
    .from(schemaMigrations);
  const applied = new Set(appliedRows.map((row) => row.version));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    await db.transaction(async (tx) => {
      for (const statement of splitStatements(migration.sql)) {
        await tx.execute(sql.raw(statement));
      }
      await tx.insert(schemaMigrations).values({
        version: migration.version,
        name: migration.name,
      });
    });
  }
}

export async function getSchemaVersion(db: Db): Promise<string> {
  const rows = await db
    .select({ version: schemaMigrations.version })
    .from(schemaMigrations)
    .orderBy(desc(schemaMigrations.version))
    .limit(1);
  return rows[0]?.version ?? "0000";
}

export async function getAppliedMigrations(db: Db): Promise<string[]> {
  const rows = await db
    .select({ version: schemaMigrations.version })
    .from(schemaMigrations)
    .orderBy(desc(schemaMigrations.version));
  return rows.map((row) => row.version);
}
