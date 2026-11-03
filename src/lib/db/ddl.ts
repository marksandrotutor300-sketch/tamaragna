/**
 * Idempotent DDL so a fresh embedded database (or an empty Postgres) works with
 * no migration step. Keep this in sync with schema.ts.
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'Trainer',
  coins integer NOT NULL DEFAULT 500,
  eggs integer NOT NULL DEFAULT 1,
  food integer NOT NULL DEFAULT 5,
  rating integer NOT NULL DEFAULT 1000,
  season smallint NOT NULL DEFAULT 1,
  placement_matches smallint NOT NULL DEFAULT 0,
  last_battle_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS placement_matches smallint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS seasons (
  id smallint PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
INSERT INTO seasons (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  species_id integer NOT NULL,
  nickname text NOT NULL,
  rarity smallint NOT NULL,
  nature text NOT NULL DEFAULT 'hardy',
  star smallint NOT NULL DEFAULT 1,
  level smallint NOT NULL DEFAULT 1,
  exp integer NOT NULL DEFAULT 0,
  slot smallint,
  ivs jsonb NOT NULL,
  care jsonb NOT NULL,
  loadout jsonb,
  stat_overrides jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pets ADD COLUMN IF NOT EXISTS nature text NOT NULL DEFAULT 'hardy';
ALTER TABLE pets ADD COLUMN IF NOT EXISTS star smallint NOT NULL DEFAULT 1;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS loadout jsonb;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS stat_overrides jsonb;
CREATE INDEX IF NOT EXISTS pets_owner_slot_idx ON pets (owner_id, slot);

CREATE TABLE IF NOT EXISTS battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opponent_snapshot_id uuid,
  tower_run_id uuid,
  seed text NOT NULL,
  payload jsonb NOT NULL,
  input_log jsonb,
  result jsonb,
  result_hash text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS battles_owner_created_idx ON battles (owner_id, created_at);
CREATE INDEX IF NOT EXISTS battles_opponent_idx ON battles (opponent_snapshot_id);
CREATE INDEX IF NOT EXISTS battles_status_idx ON battles (status);

CREATE TABLE IF NOT EXISTS tower_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seed text NOT NULL,
  wave integer NOT NULL DEFAULT 0,
  highest_wave integer NOT NULL DEFAULT 0,
  team_state jsonb NOT NULL,
  blessings jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  elapsed_ms integer NOT NULL DEFAULT 0,
  season smallint NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE tower_runs ADD COLUMN IF NOT EXISTS blessings jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS tower_owner_status_idx ON tower_runs (owner_id, status);
CREATE INDEX IF NOT EXISTS tower_leaderboard_idx
  ON tower_runs (status, highest_wave DESC, elapsed_ms);

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

CREATE TABLE IF NOT EXISTS pvp_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL,
  season smallint NOT NULL DEFAULT 1,
  team jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pvp_snapshots_season_rating_idx
  ON pvp_snapshots (season, rating);

CREATE TABLE IF NOT EXISTS quest_states (
  profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS season_rewards (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  season smallint NOT NULL,
  rating integer NOT NULL,
  tier text NOT NULL,
  coins integer NOT NULL,
  eggs integer NOT NULL,
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, season)
);
CREATE INDEX IF NOT EXISTS season_rewards_profile_claimed_idx
  ON season_rewards (profile_id, claimed);

CREATE TABLE IF NOT EXISTS transfer_codes (
  code_hash text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transfer_codes_profile_idx
  ON transfer_codes (profile_id, used_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_reset_idx ON rate_limits (reset_at);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  applied_at timestamptz NOT NULL DEFAULT now()
);
`;
