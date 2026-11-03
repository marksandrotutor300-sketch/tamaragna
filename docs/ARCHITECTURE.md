# Architecture

How TamaRagna is put together: module boundaries, data flow, the database, the API surface,
and the integrity model.

---

## 1. Shape of the system

```
  rAthena (pinned SHA)                  Public RO asset hosts
          │                                      │
  scripts/fetch-rathena.ts               /api/sprite/[id]
  scripts/build-bestiary.ts              /api/icon/skill/[id]
          │                              /api/map/[map]
  data/generated/*.json                         │
          │                                     │
  ┌───────┴───────────── server routes ─────────┴───────────┐
  │  src/app/api/**                                         │
  │                                                         │
  │  src/lib/game/**   ──►   src/lib/sim/**   ◄── browser   │
  │  (stats, care, hatch,     (pure engine)       battle     │
  │   tower, PvP, views)                           runner    │
  └───────────────────────┬─────────────────────────────────┘
                          │
                  src/lib/db/** (Drizzle)
                          │
             Postgres  or  embedded PGlite
```

The single most important property: **`src/lib/sim` is pure TypeScript and runs unchanged in
both environments.** The browser plays the battle live; the server re-runs the same battle
from the stored seed and the submitted input log.

---

## 2. Stack

| Layer | Choice | Version |
| --- | --- | --- |
| Framework | Next.js App Router | 16.4.3 |
| UI | React | 19.3.1 |
| Language | TypeScript (strict) | 5.9 |
| Styling | Tailwind CSS v4 | 4.3.3 |
| Server state | TanStack Query | 5.105 |
| ORM | Drizzle | 0.45 |
| Database | Postgres via `postgres.js`, or PGlite | — |
| Validation | Zod | 4.6 |
| Tests | Vitest | 5.0 |
| Data parsing | `yaml` | 2.9 |
| PWA | Serwist + `@serwist/turbopack` | 9.5.13 |

There is no game engine. Battles are rendered with DOM and CSS; sprites are animated APNG
`<img>` elements.

---

## 3. Module map

### Shared, environment-agnostic

| Path | Responsibility |
| --- | --- |
| `src/lib/sim/types.ts` | Combatants, inputs, events, snapshots, results |
| `src/lib/sim/engine.ts` | `BattleEngine`: fixed-tick state machine |
| `src/lib/sim/damage.ts` | Damage, mitigation, status math |
| `src/lib/sim/ai.ts` | Deterministic skill/swap policy |
| `src/lib/sim/checksum.ts` | FNV-1a 64-bit result hash |
| `src/lib/sim/replay.ts` | `simulateBattle`, `verifyBattle` |
| `src/lib/rng.ts` | Seeded `mulberry32` |
| `src/lib/game/types.ts` | Data-model types shared by pipeline and app |
| `src/lib/game/elements.ts` | Element names/colours |
| `src/lib/game/rarity.ts` | Rarity table, hatch weights, IV grading |
| `src/lib/game/stats.ts` | Effective stats, power score |
| `src/lib/game/skills.ts` | Skill level/power resolution, loadout default/validation |
| `src/lib/game/care.ts` | Lazy care decay and action effects |
| `src/lib/game/leveling.ts` | EXP curve |
| `src/lib/game/eggs.ts` | Egg costs (client-safe constants) |
| `src/lib/game/combat-data.ts` | Skills + attribute chart (small JSON) |
| `src/lib/game/nature.ts` | Eight natures, stat multipliers, labels |
| `src/lib/game/awakening.ts` | Star multiplier and awakening cost |
| `src/lib/game/breeding.ts` | IV/nature/rarity inheritance and breeding cost |
| `src/lib/game/synergy.ts` | Team composition bonuses |
| `src/lib/game/quests.ts` | Quest definitions, UTC reset, progress, claims, login streak |
| `src/lib/game/season.ts` | Season tiers, rewards and placement K |
| `src/lib/game/blessings.ts` | Tower draft definitions, deterministic options, application |
| `src/lib/game/affixes.ts` | Elite wave affixes |
| `src/lib/game/modifiers.ts` | Shared stat-modifier application for blessings and affixes |

### Server-only

| Path | Responsibility |
| --- | --- |
| `src/lib/game/species.ts` | Loads the 1.3 MB `species.json`; the only module that does |
| `src/lib/game/views.ts` | Server-side `petView` serialisation |
| `src/lib/game/combatant.ts` | Pet/species → `CombatantInit`, wild combatants |
| `src/lib/game/hatch.ts` | Hatch roll (uses the full species pool) |
| `src/lib/game/tower.ts` | Wave generation and scaling |
| `src/lib/game/tower-service.ts` | Wave battle creation, idempotent resume |
| `src/lib/game/battles.ts` | Battle rows and reward grants |
| `src/lib/game/pvp.ts` / `pvp-service.ts` | Elo, snapshot refresh |
| `src/lib/game/quest-service.ts` | Quest state persistence, progress recording, claims |
| `src/lib/game/featured.ts` | Deterministic daily featured species (uses the full species pool) |
| `src/lib/features.ts` | Process-wide feature flags for share, telemetry, accounts, evolution and live PvP |
| `src/lib/db/actor.ts` | Device-cookie actor now; session actor seam for M3 |
| `src/lib/db/migrations.ts` | Additive migration runner and `schema_migrations` baseline |
| `src/lib/game/share.ts` | Share tokens, public slugs and reserved-route validation |
| `src/lib/game/replays.ts` | Public replay reader + checksum re-verification |
| `src/lib/game/trainer-cards.ts` | Opt-in public trainer cards and sitemap slugs |
| `src/lib/game/defenses.ts` | Defense log for snapshot attacks |
| `src/lib/game/telemetry.ts` / `balance.ts` | Battle event capture, daily aggregates, outliers |
| `src/lib/game/evolution.ts` / `mastery.ts` | Curated evolution graph and skill mastery XP |
| `src/lib/game/expeditions.ts` / `habitats.ts` / `legacy.ts` | Routes/rewards, ranch themes and retirement traits |
| `src/lib/live/rooms.ts` / `ticket.ts` | Authoritative live rooms, SSE fan-out, HMAC tickets |
| `src/lib/tournaments.ts` | Brackets, joins, match linking and advancement |
| `src/lib/admin.ts` / `src/lib/admin/service.ts` | Token/super-admin gate, player/pet operations, audit log |
| `src/lib/db/session.ts` / `src/lib/auth/magic.ts` | Revocable sessions and magic-link tokens |
| `src/lib/email.ts` / `src/lib/push.ts` | Resend adapter, VAPID push, cron sending |
| `src/lib/client/care-queue.ts` | IndexedDB care outbox for Background Sync |
| `src/lib/site.ts` | Canonical site URL for sitemap, OG and share links |
| `src/lib/rate-limit.ts` | Fixed-window DB-backed rate limiter and client IP key |
| `src/lib/account/transfer.ts` | Transfer code generation/hashing and save snapshot schema |
| `src/proxy.ts` | Same-origin check for API mutations (Next 16 proxy convention) |
| `src/lib/db/*` | Drizzle schema, DDL, Postgres/PGlite bootstrap, device auth |
| `src/lib/assets/*` | Provider adapter and upstream fetches |

Client bundles must never import `species.ts`. The UI uses `import type` for view types and
imports only `rarity`, `elements`, `care`, `eggs` and `combat-data` at runtime. A 1.3 MB
regression here was caught and removed once already (see `docs/STATUS.md`).

Stats resolve in this order: species → rarity → level → IVs → care → nature → star. Team
synergies are applied afterwards in `teamToCombatants`, so they are baked into the
`CombatantInit` stored in battle payloads and PvP snapshots. Status resistance is derived
from the final VIT/LUK. The client and the replay therefore need no extra genetics state.

A pet's loadout is four skill IDs chosen from its species' six. `buildCombatant` normalizes
the selection, rejects duplicates/unknown IDs and resolves only those four into
`CombatantInit.skills`; the default is the first three offensive skills plus one support.
This keeps the battle engine and input indices at four slots.

### UI

| Path | Responsibility |
| --- | --- |
| `src/app/(game)/*` | Ranch, team, hatch, tower, arena, bestiary |
| `src/app/battle/[id]` | Full-screen arena route |
| `src/components/battle/BattleStage.tsx` | Event playback, animations, submission overlay |
| `src/hooks/useBattleRunner.ts` | `requestAnimationFrame` loop around `BattleEngine` |
| `src/components/pet/*` | Sprites, rarity frames, IV radar, care bars |
| `src/components/layout/AppShell.tsx` | Navigation, currency, responsive shell |

### PWA

| Path | Responsibility |
| --- | --- |
| `src/app/sw.ts` | Serwist worker: precache manifest, runtime caching, offline fallback |
| `src/app/serwist/[path]/route.ts` | Prerenders `/serwist/sw.js` at build time via `createSerwistRoute` |
| `src/app/manifest.ts` | Web app manifest: standalone display, start URL, icons |
| `src/app/offline/page.tsx` | Static offline fallback document |
| `scripts/generate-icons.ts` | Renders the PNG icon set from the Lucide `sparkles` glyph |

---

## 4. Request and battle data flow

### Creating a battle

1. The client calls a creation route (`/api/battle/practice`, `/api/tower/start`,
   `/api/tower/[runId]/next`, or `/api/pvp/match`).
2. The server resolves the player's team into `CombatantInit[]` (stats, resolved skills,
   spawn map) and builds the opposing team.
3. The server generates a seed, stores `{ seed, payload, mode }` in `battles`, and returns
   `{ battleId, seed, payload }`. The payload contains both fully resolved teams.
4. The client runs `BattleEngine` locally and renders the event stream.

### Submitting a battle

1. The client posts `{ inputLog, resultHash }`.
2. The server loads the stored battle, rejects non-pending battles, and enforces a 2 s
   per-profile cooldown.
3. It re-runs `simulateBattle` with the stored seed/teams and the submitted input log.
4. If the checksum differs, the request is rejected with 400.
5. Otherwise rewards, Elo and tower progress are applied from the **replayed** result, and
   the battle row is marked complete with its result and input log.

### Checksum

```
FNV-1a 64( seed | inputLog | side A snapshot | side B snapshot | winner | reason | duration )
```

It is a consistency check, not a cryptographic signature.

---

## 5. Database

Five tables, created idempotently by `src/lib/db/ddl.ts` on first connection. The schema and
DDL are kept in sync by hand.

### `profiles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `device_id` | text unique | the `tr_device` cookie value |
| `display_name` | text | 2–20 chars, editable |
| `coins`, `eggs`, `food` | integer | `food` reserved, unused |
| `rating` | integer | default 1000 |
| `season` | smallint | default 1 |
| `placement_matches` | smallint | PvP placement count, 0–5 |
| `last_battle_at` | timestamptz | submission rate limit |
| `created_at` | timestamptz | |

### `pets`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `owner_id` | uuid FK → profiles | cascade delete |
| `species_id` | integer | rAthena mob ID |
| `nickname` | text | |
| `rarity` | smallint | 1–5 |
| `nature` | text | one of eight nature IDs, default `hardy` |
| `star` | smallint | awakening rank 1–5, default 1 |
| `level`, `exp` | smallint/integer | max 50 |
| `slot` | smallint nullable | 1–3, null = storage |
| `ivs` | jsonb | six values 0–31 |
| `care` | jsonb | hunger/mood/energy/friendship/lastCareAt/sleeping |
| `loadout` | jsonb nullable | four skill IDs; null = default three attacks + one support |
| `stat_overrides` | jsonb nullable | admin-forced final stats applied after every multiplier |
| `created_at` | timestamptz | |

Index: `pets(owner_id, slot)`.

### `battles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `mode` | text | `practice` / `tower` / `pvp` |
| `owner_id` | uuid FK | cascade |
| `opponent_snapshot_id` | uuid nullable | PvP only |
| `tower_run_id` | uuid nullable | tower only |
| `seed` | text | server-issued |
| `payload` | jsonb | both teams + AI flags (+ wave) |
| `input_log` | jsonb | filled on submission |
| `result`, `result_hash` | jsonb/text | replay output |
| `status` | text | `pending` → `complete` |
| `created_at`, `completed_at` | timestamptz | |

Index: `battles(owner_id, created_at)`.

### `tower_runs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `owner_id` | uuid FK | cascade |
| `seed` | text | run seed; wave seeds derive from it |
| `wave` | integer | last **cleared** wave |
| `highest_wave` | integer | leaderboard value |
| `team_state` | jsonb | snapshot combatants with carried HP |
| `blessings` | jsonb | `[{ wave, id }]` draft choices applied to the run |
| `status` | text | `active` / `ended` |
| `elapsed_ms` | integer | total battle time |
| `season` | smallint | |
| `started_at`, `ended_at` | timestamptz | |

Index: `tower_runs(owner_id, status)`.

### `card_runs`

A three-act Rift Deck run. One active row per profile via the partial unique index
`card_runs_active_idx`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `owner_id` | uuid FK | cascade |
| `seed` | text | never exposed through the API |
| `status` | text | `active` / `won` / `lost` / `abandoned` |
| `act`, `node_id` | smallint/text | current act and last reached node |
| `map` | jsonb | generated three-act map |
| `deck` | jsonb | card instances + next instance id |
| `relics` | jsonb | string ids |
| `champions` | jsonb | pet snapshots with run HP/block/cards |
| `run_gold` | integer | run-local currency |
| `ascension` | smallint | A0–A5 difficulty |
| `path` | text | Rift Path id |
| `edicts` | jsonb | snapshotted Rift Edict ids |
| `contracts` | jsonb | three run contract states |
| `pending` | jsonb | reward/rest/shop/event interaction |
| `score`, `elapsed_ms`, `season` | numeric | leaderboard and season |
| `completed_node_ids` | jsonb | cleared rooms |
| `reward_*`, `rewarded_at` | integer/timestamptz | once-only capped reward ledger |
| `started_at`, `ended_at` | timestamptz | |

### `card_battles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `owner_id`, `run_id` | uuid FK | cascade |
| `node_id` | text | map node |
| `seed` | text | battle seed |
| `state` | jsonb | server-authoritative combat state |
| `input_log` | jsonb | accepted card actions |
| `result`, `result_hash` | jsonb/text | terminal combat result |
| `version` | integer | optimistic action concurrency |
| `status` | text | `pending` / `complete` / `lost` |
| `created_at`, `completed_at` | timestamptz | |

### `pvp_snapshots`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `owner_id` | uuid FK unique | cascade |
| `rating` | integer | |
| `season` | smallint | |
| `team` | jsonb | `CombatantInit[]` |
| `updated_at` | timestamptz | |

### `seasons`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | smallint PK | current and historical season numbers |
| `started_at`, `ended_at` | timestamptz | rollover timestamps |

New profiles join the highest season in use (table or profile fallback).

### `quest_states`

| Column | Type | Notes |
| --- | --- | --- |
| `profile_id` | uuid PK FK | one row per profile |
| `state` | jsonb | day/week keys, streak, progress and claimed lists |
| `updated_at` | timestamptz | |

### `season_rewards`

| Column | Type | Notes |
| --- | --- | --- |
| `profile_id` + `season` | composite PK | one reward per profile per season |
| `rating`, `tier` | integer/text | snapshot at rollover |
| `coins`, `eggs` | integer | reward amounts |
| `claimed` | boolean | manual claim from the arena |

Index: `season_rewards(profile_id, claimed)`.

### `transfer_codes`

| Column | Type | Notes |
| --- | --- | --- |
| `code_hash` | text PK | SHA-256 of the normalized code; plain code is never stored |
| `profile_id` | uuid FK | cascade delete |
| `expires_at` | timestamptz | 15-minute TTL |
| `used_at` | timestamptz nullable | single use |
| `created_at` | timestamptz | |

Index: `transfer_codes(profile_id, used_at)`.

### `rate_limits`

| Column | Type | Notes |
| --- | --- | --- |
| `key` | text PK | `${profileId}:${action}` or `${ip}:transfer-redeem` |
| `count` | integer | requests in the current fixed window |
| `reset_at` | timestamptz | window end |

Index: `rate_limits(reset_at)`.

### `schema_migrations`

| Column | Type | Notes |
| --- | --- | --- |
| `version` | text PK | e.g. `0001_share_replay` |
| `name` | text | human label |
| `applied_at` | timestamptz | |

The idempotent DDL is the baseline. `runMigrations` applies numbered additive SQL inside a
transaction and records it; `npm run db:migrate` / `db:status` expose the same path.

### `battle_shares`

| Column | Type | Notes |
| --- | --- | --- |
| `token` | text PK | 12-character base62; unlisted |
| `battle_id` | uuid FK | cascade delete |
| `owner_id` | uuid FK | the sharer |
| `visibility` | text | `unlisted` by default |
| `created_at` | timestamptz | |
| `revoked_at` | timestamptz nullable | revoke keeps the audit row |

Indexes: `battle_shares(battle_id)` and `battle_shares(owner_id, created_at)`.
Profiles gain nullable `public_slug` (partial unique) and `public_card` (opt-in).

### Accounts and push

- `users(id, email unique, email_verified_at, deleted_at)`.
- `sessions(id, user_id, token_hash unique, expires_at, last_seen_at, revoked_at)`.
- `email_tokens(token_hash, email, purpose, expires_at, used_at)`.
- `profiles.user_id` nullable, partial unique — one account ↔ one ranch.
- `push_subscriptions(user_id, profile_id, endpoint unique, keys, preferences)`.
- `notification_log(subscription_id, kind, sent_at)`.
- `idempotency_keys(key, profile_id, response)` for the care outbox.

### Telemetry and balance

- `analytics_events(event, season, mode, battle_id, actor_id, winner, duration_ms, payload)`.
  Payload is a compact team signature, never a raw input log.
- `balance_daily(day, season, mode, dimension, key, battles, wins, picks, damage_sum)`.

### Evolution and mastery

- `pets.evolution_stage`, `pets.parent_a_id`, `pets.parent_b_id`.
- `pet_skill_mastery(pet_id, skill_id, level, xp)`.
- `data/evolution.yaml` is the source of truth; `npm run data:evolution` validates it,
  resolves species IDs, rejects cycles/duplicates and writes `data/generated/evolution.json`.

### Live PvP and tournaments

- `live_matches(id, room_id unique, battle_id, tournament_match_id, player_a/b, status,
  winner, started_at, ended_at)`.
- `matchmaking_queue(profile_id PK, season, rating, enqueued_at, matched_at)`.
- `tournaments`, `tournament_entries`, `tournament_matches` (round/slot bracket, live match
  link, winner).

### Seven upgrades

- `profiles.legacy_points`, `spectator_points`, `habitat`, `materials`.
- `pets.market_listed`, `expedition_id`, `legacy_trait`.
- `guilds`, `guild_members`, `guild_raids`, `guild_contributions`.
- `market_listings` (one active listing per pet via a partial unique index).
- `expeditions` (pet-id JSON, computed rewards, timer).
- `ranch_visits`.
- `ranked_cups` (linked to `tournaments`) and `spectator_picks`.
- `legacy_marks`, `dojo_ghosts`, `dojo_runs`.
- `admin_audit_log` and `admin_role_events` (owner/admin changes with actor, target, previous
  role, new role, reason and timestamp).

Additional indexes: `battles(opponent_snapshot_id)`, `battles(status)`,
`tower_runs(status, highest_wave, elapsed_ms)`, `pvp_snapshots(season, rating)`.

### Bootstrap

`src/lib/db/client.ts` exposes a singleton `getDb()`:

- `DATABASE_URL` set → `postgres.js` + Drizzle, then executes the DDL statements.
- otherwise → PGlite (Postgres compiled to WASM) persisted at
  `~/.tamaragna/pglite` (override with `PGLITE_DIR`), executes the same DDL.

The embedded directory is deliberately **outside the project** so Next's dev file watcher
never sees database writes (that previously caused a reload loop).

---

## 6. API surface

All routes are Node runtime and validate input with Zod. Errors return
`{ error: string }` with a 4xx status.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/me` | Profile, all pets, team order |
| `PATCH` | `/api/me` | Rename trainer (2–20 chars) |
| `GET` | `/api/pets` | Roster as resolved views |
| `PATCH` | `/api/pets/:id` | Rename, assign slot 1–3/null, or set a four-skill loadout |
| `POST` | `/api/pets/:id/awaken` | `{ fodderId }` → star +1, fodder consumed |
| `POST` | `/api/pets/:id/nature` | Reroll the nature for 300 coins |
| `GET` | `/api/quests` | Daily/weekly progress and login streak |
| `POST` | `/api/quests/claim` | `{ kind: "daily"\|"weekly"\|"login", id? }` |
| `GET` | `/api/season` | Season, tier, placements and rewards |
| `POST` | `/api/season/claim` | Claim all unclaimed season rewards |
| `GET` | `/api/featured` | Three featured species for the UTC day |
| `POST` | `/api/account/transfer` | Create a single-use transfer code |
| `POST` | `/api/account/transfer/redeem` | Move the profile to this device (no auth) |
| `GET` | `/api/account/export` | Download a profile + pets save snapshot |
| `POST` | `/api/account/import` | Restore a save into a fresh ranch |
| `GET` | `/api/health` | DB + data manifest + schema version probe (no auth) |
| `POST` | `/api/battles/:id/share` | Owner-only share link; revokes previous active link |
| `DELETE` | `/api/battles/:id/share` | Revoke active links for a battle |
| `GET` | `/api/replays/:token` | Public sanitized replay; re-verifies checksum |
| `GET` | `/api/trainer/:slug` | Opt-in public trainer card |
| `GET` | `/api/pvp/defenses` | Recent attacks against the caller's snapshots |
| `POST` | `/api/pvp/revenge` | Rematch against an attacker's current snapshot |
| `PATCH` | `/api/account/public-card` | Publish/hide a trainer card and set its slug |
| `POST` | `/api/auth/magic-link` | Send a generic magic-link response (dev link when enabled) |
| `GET` | `/api/auth/verify` | Consume a magic token, link/create a ranch, create a session |
| `GET` | `/api/auth/session` | Current actor identity |
| `POST` | `/api/auth/logout` / `revoke-others` | Revoke the current/all other sessions |
| `DELETE` | `/api/auth/account` | Delete the account, keep the ranch anonymous |
| `POST` | `/api/push/subscribe` / `unsubscribe` | Store/disable a VAPID subscription |
| `GET` | `/api/push/public-key` | Push configuration |
| `POST` | `/api/cron/reminders` | Secret-gated care reminder job |
| `GET` | `/api/pets/:id/evolution-options` / `lineage` | Evolution targets and ancestors |
| `POST` | `/api/pets/:id/evolve` | Transactional stage transition |
| `POST` | `/api/pvp/live/queue` | Join/pair the live queue |
| `GET` | `/api/pvp/live/queue` | Poll for a matched ticket |
| `GET` | `/api/pvp/live/:id/stream` | SSE snapshots for players/spectators |
| `POST` | `/api/pvp/live/:id/input` | Validated skill/swap input |
| `POST` | `/api/pvp/live/:id/spectate` | Delayed spectator ticket |
| `GET/POST` | `/api/tournaments` | List/admin-create tournaments |
| `POST` | `/api/tournaments/:id/join` / `start` | Join or generate the bracket |
| `POST` | `/api/tournaments/:id/matches/:matchId/start` | Create/link a live bracket match |
| `POST` | `/api/admin/balance/aggregate` | Recompute daily aggregates |
| `GET/POST` | `/api/guilds`, `/api/guilds/:id/...` | Guild list/found/detail/join/leave/raid |
| `GET/POST` | `/api/market`, `/api/market/:id/...` | Auction browse/list/cancel/buy |
| `GET/POST` | `/api/expeditions`, `/api/expeditions/:id/claim` | Routes/start/claim |
| `PATCH` | `/api/account/habitat` | Buy/select a ranch theme |
| `POST` | `/api/ranch/:slug/visit` | Visit a public ranch |
| `GET/POST` | `/api/ranked`, `/api/ranked/cups/...` | Ladder/cups/join/start |
| `GET/POST` | `/api/pvp/live/:id/pick` | Spectator crowd pick |
| `GET` | `/api/legacy` / `POST /api/pets/:id/retire` | Retirement marks |
| `GET/POST` | `/api/dojo/ghosts`, `/api/dojo/ghosts/:id/spar` | Train/list/spar ghosts |
| `POST` | `/api/dev/boost` | Admin-token seed helper (level/star/species/coins/eggs/materials) |
| `GET` | `/api/cards` | Rift Deck hub, active run and leaderboard |
| `POST` | `/api/cards/runs` | Start/resume a three-act run with `{ ascension?, path? }` |
| `GET` | `/api/cards/runs/:id` | Run map, deck, relics, champions and pending node |
| `POST` | `/api/cards/runs/:id/enter` | Enter a reachable node |
| `POST` | `/api/cards/runs/:id/reward` | Claim a card/relic/skip reward |
| `POST` | `/api/cards/runs/:id/rest` | Heal, upgrade, forge a Signature or ascend a champion |
| `POST` | `/api/cards/runs/:id/shop` | Buy, remove, evolve a relic, inscribe a rune or leave |
| `POST` | `/api/cards/runs/:id/contracts` | Claim a completed Rift Contract |
| `POST` | `/api/cards/runs/:id/event` | Resolve an event choice |
| `POST` | `/api/cards/runs/:id/abandon` | End the run without main rewards |
| `POST` | `/api/cards/edicts` | Buy a permanent Rift Edict with essence |
| `GET` | `/api/cards/leaderboard` | Won-run leaderboard |
| `GET` | `/api/cards/battles/:id` | Current server battle state |
| `POST` | `/api/cards/battles/:id/action` | Play a card or end turn (versioned) |
| `GET` | `/api/admin/players` / `/api/admin/players/:id` | Super-admin player search/detail |
| `PATCH` | `/api/admin/players/:id` | Wallet/profile edits |
| `POST/PATCH` | `/api/admin/pets`, `/api/admin/pets/:id` | Create/edit pets and overrides |
| `POST` | `/api/admin/pets/:id/transfer` | Transfer pet ownership |
| `GET` | `/api/admin/audit` | Recent audit entries |
| `GET/POST` | `/api/admin/roles` | Role log / grant admin by email |
| `POST` | `/api/admin/roles/:userId/revoke` | Revoke admin |
| `POST` | `/api/admin/roles/:userId/rollback` | Roll back last role change |
| `POST` | `/api/admin/roles/owner` | Transfer owner |
| `POST` | `/api/pets/:id/care` | `feed` / `play` / `rest` / `wake` / `train` |
| `POST` | `/api/hatch` | `{ kind: "wild" \| "focused", focusElement? }` |
| `POST` | `/api/breed` | `{ parentA, parentB }` → inherited child |
| `POST` | `/api/pets/:id/awaken` | `{ fodderId }` → star +1, fodder consumed |
| `GET` | `/api/bestiary` | Paginated search: `q`, `tier`, `element`, `page` |
| `GET` | `/api/bestiary/:id` | Full species sheet + kit |
| `POST` | `/api/battle/practice` | `{ speciesId?, auto? }` → battle |
| `GET` | `/api/battle/:id` | Battle payload, status, result and input log |
| `POST` | `/api/battle/:id/submit` | `{ inputLog, resultHash }` |
| `POST` | `/api/tower/start` | `{ auto? }` → run + wave battle |
| `POST` | `/api/tower/:runId/next` | `{ auto?, blessingId? }` → next wave battle (idempotent) |
| `GET` | `/api/tower/:runId/draft` | Three blessings for the next wave, or pending state |
| `POST` | `/api/tower/:runId/abandon` | End an active run |
| `GET` | `/api/tower/leaderboard` | Active run, personal best, top 50 |
| `POST` | `/api/pvp/match` | `{ auto? }` → opponent snapshot + battle |
| `GET` | `/api/pvp/history` | Rating + last 20 duels |
| `GET` | `/api/sprite/:id` | Proxied APNG/PNG (`action`, `dir`, `frame`) |
| `GET` | `/api/icon/skill/:id` | Proxied RO skill icon |
| `GET` | `/api/map/:map` | Proxied RO map image, validated against known maps |

### Key payloads

`CombatantInit` (stored in battle payloads and returned to the client):

```ts
{
  petId, speciesId, name, element, elementLevel, level, rarity?,
  stats: { hpMax, atk, matk, def, mdef, aspdMs, critChance, critMult, statusResist, ... },
  skills: ResolvedSkill[4],
  hp?, spawnMap?, affix?
}
```

Nature, stars and team synergies are already folded into `stats`; there is no separate
genetics payload for the client to replay.

`BattleInput`:

```ts
{ t: number, kind: "skill", index: 0..3 }
{ t: number, kind: "swap",  index: 0..2 }
```

`t` is a multiple of the 50 ms tick.

---

## 7. Identity

Anonymous and cookie-based:

- First API call creates a profile with a random `device_id`.
- The server sets `tr_device` as an httpOnly, SameSite=Lax cookie for five years
  (`Secure` in production).
- Every request looks the profile up by that cookie; no passwords, no third-party auth.
- Clearing cookies loses the profile. A transfer-code flow is the planned mitigation.

This keeps "online" gameplay (cloud saves, leaderboards, async PvP) without an account
system or vendor dependency.

---

## 8. Asset proxy

`src/lib/assets/providers.ts` defines a provider interface plus three implementations:

| Provider | Behavior |
| --- | --- |
| `ragassets` (default) | Animated APNG per action; `action = type×8 + direction` |
| `divine-pride` | Static stills; also the automatic fallback |
| `zrenderer` | Opt-in self-hosted renderer (`ZRENDERER_URL`, optional token) |

`fetchSprite()` tries the configured provider, then `divine-pride`, returns 404 if both
fail. Successful responses are cached by Next's fetch cache and emitted with
`Cache-Control: public, max-age=31536000, immutable`.

Validation:

- Sprite: species ID must exist in the generated bestiary; action whitelist; direction 0–7.
- Skill icon: skill ID must exist in the curated table.
- Map: map name must appear in some species' spawn list.

No asset bytes are ever written into the repository.

---

## 9. Rendering strategy

- Pages are client components. Next prerenders their shells at build time; data is fetched
  from the API through TanStack Query after mount. Only the landing page is fully static.
- The battle page reads the payload from `/api/battle/:id`, so a reload resumes the same
  fight.
- `useBattleRunner` owns a mutable `BattleEngine` in a ref and drives it from a
  `requestAnimationFrame` loop at a fixed 50 ms simulation step, throttling React snapshot
  updates to ~25 fps.
- Sprites are lazy-loaded outside of hero/arena contexts, with a skeleton placeholder and a
  CSS `?` fallback if the proxy 404s.
- Production builds register a service worker; `next dev` intentionally disables it so
  hot reload never fights a cache.

---

## 10. PWA and offline

Production builds ship an installable app backed by Serwist.

- **Worker.** `src/app/sw.ts`, compiled by `@serwist/turbopack` inside
  `src/app/serwist/[path]/route.ts`. The route exports `dynamic = "force-static"`, so
  `/serwist/sw.js` and its source map are generated once at build time, never per request.
- **Scope.** `SerwistProvider` registers with `scope: "/"` and the worker response sets
  `Service-Worker-Allowed: /`, so it controls the whole app rather than only `/serwist/`.
- **Precache.** The route injects the build manifest (chunks, CSS, icons) plus `/offline`;
  currently 53 entries (~1.28 MB).
- **Runtime caching**, in match order:
  1. `/api/sprite`, `/api/icon`, `/api/map` → `CacheFirst` in `tamaragna-ro-assets`
     (600 entries, 30 days).
  2. Any other `/api/**` → `NetworkOnly`. Roster, care and battle state are never cached.
  3. Document navigations → `NetworkFirst` in `tamaragna-pages` (4 s timeout).
  4. Hashed JS/CSS/font/image requests → `StaleWhileRevalidate` in `tamaragna-static`.
- **Fallback.** A failed document request resolves to the precached `/offline` page.
- **Registration.** `SerwistProvider` in the root layout with `cacheOnNavigation={false}`,
  disabled when `NODE_ENV === "development"`.
- **Manifest.** `src/app/manifest.ts` starts at `/ranch`, displays standalone, and points at
  three PNG icons generated from the Lucide `sparkles` glyph by `npm run icons`.

`skipWaiting` and `clientsClaim` are enabled, so a deploy takes over on the next load. The
trade-off is that a tab holding old chunks can need one reload.

---

## 11. Failure modes and mitigations

| Failure | Mitigation |
| --- | --- |
| Missing generated data on a fresh clone | `predev`/`prebuild` run `scripts/ensure-data.ts` |
| Empty database | DDL is idempotent and runs on first connection |
| Sprite host down or rate-limited | Fall back to `divine-pride`, then a placeholder; self-host with zrenderer |
| Port 3000 already in use | Launcher detects it and opens the existing instance |
| Dev file-watcher loop from DB writes | Embedded DB lives in `~/.tamaragna`, not the project |
| Client submits a stale/fake result | Server replays and compares checksums |
| Spam submissions | 2 s per-profile cooldown |
| Oversized client bundle | `species.ts` is server-only; bundle budget checked manually |
| Battle payload grows unbounded | Input logs capped at 3,000 entries; events capped client-side |
| Stale UI after a deploy | New worker activates immediately (`skipWaiting` + `clientsClaim`); reload a tab holding old chunks |
| Offline navigation to an unvisited page | Precache fallback serves `/offline`; live `/api/**` stays network-only |
| Worker compiled on every request | `createSerwistRoute` sets `force-static`; verify `●` in the build route table |
| Awakening loses a duplicate without the star gain | The star update, fodder delete and coin charge run in one transaction |
| Breeding/awakening with an invalid pet | Both routes validate ownership, species, level, storage and star before writing |
| Invalid skill loadout | PATCH requires four unique IDs from the species' six; `buildCombatant` normalizes/falls back if a stored value is stale |
| Reroll charged without a change | `rerollNature` excludes the current nature; the nature and coin updates run in one transaction |
| Quest progress write fails | `recordQuestEventSafe` logs and never fails the care/hatch/battle action |
| Draft applied twice | `tower_runs.blessings` is keyed by wave; a repeat request skips the already-applied choice |
| Season rollover leaves a stale PGlite lock | Run it with the server stopped; remove `postmaster.pid` only after verifying no process is alive |
| Transfer code guessed or replayed | 10-char/50-bit code, SHA-256 storage, 15 min TTL, single use, 5 attempts per IP per 10 min |
| Save import overwrites a ranch | Import refuses any profile that already has pets; transfer is the full-profile path |
| Mutation from another origin | Middleware compares `Origin` host for non-GET API requests and returns 403 |
| Burst of writes | DB-backed fixed-window limits return 429 before the route work |
| Replay token revoked or tampered | `revoked_at` stops serving; the public reader re-simulates and compares `resultHash` |
| OG render fails | Satori blocks localhost via SSRF protection; OG routes use public static sprite URLs |
| Public slug collision | Partial unique index on `profiles.public_slug`; PATCH returns 409 |
| Migration fails halfway | Each migration runs in a transaction and is recorded only on success |
| Replay route disabled | `FEATURE_SHARE=0` returns 404 from share/replay/trainer APIs and pages |
| Magic link replayed or expired | Tokens are single-use SHA-256 rows with a 15-minute TTL; verify updates `used_at` atomically |
| Session stolen or logged out | Sessions are opaque tokens hashed at rest; logout/revoke-others set `revoked_at` |
| Push endpoint returns 410 | The cron catches delivery failures and logs them; a cleanup job can disable dead subscriptions |
| Live process restarts | Rooms are in-memory; active matches are abandoned rather than silently awarding Elo |
| Live checksum mismatch | The canonical input log normalizes `{t,kind,index,side}` before hashing, so JSONB key order cannot break replays |
| Tournament room disappears | The bracket match stays active and can be restarted manually |
| Market sale races | Ownership, listing status, coins and fees commit in one transaction; a stale listing is rejected |
| Raid timer expires | The attack route marks the raid expired instead of accepting damage |
| Render Free sleeps or restarts | Active in-memory live rooms are abandoned; agreed for the free demo tier |
| Ghost snapshot drifts | Ghosts store baked combatants, so later owner changes cannot alter a trained ghost |

---

## 12. Performance notes

- Client JS: **1.03 MB total**, largest chunk 224 KB (React/Next runtime).
- PWA precache: 53 entries / ~1.28 MB (chunks, CSS, icons and the offline page).
- Quest state is one JSONB row per profile; season rewards are one row per profile/season.
- Rate limiting adds one upsert per protected write; public health/bestiary/featured reads
  measured p95 15–31 ms under 200 requests at concurrency 10.
- Skills + attribute chart shipped to the client: ~20 KB combined.
- A 180 s battle is at most 3,600 simulation ticks — negligible CPU.
- The bestiary grid lazy-loads sprites and paginates at 60 cards.
- Database queries are indexed for the access patterns in use (owner+slot, owner+created,
  owner+status, rating ordering).

## 13. Sharing, public cards and discovery

- **Share tokens.** `POST /api/battles/:id/share` is owner-only and completed-only. It
  revokes any active link for that battle, inserts a 12-character base62 token, and returns
  `/replay/<token>`. `DELETE` revokes without deleting the audit row.
- **Replay reader.** `getReplayByToken` joins the share and battle, rejects revoked/unknown
  tokens, re-simulates the stored seed + input log, and compares `resultHash` before serving
  any payload. Public payloads contain teams and battle data, never profile IDs or emails.
- **Replay theater.** `/replay/[token]` renders `ReplayViewer`, which steps the same
  `BattleEngine` in read-only mode at 1×/2×, with pause and no submit path. The completed
  battle page and result overlay expose a **Share replay** button.
- **OG images.** `/replay/[token]/opengraph-image` and `/trainer/[slug]/opengraph-image` use
  `ImageResponse` with the public static sprite URL. Satori's SSRF protection blocks
  `localhost`, so the local sprite proxy cannot be used there.
- **Trainer cards.** `public_slug` + `public_card` are opt-in. The API returns display name,
  rating, season and three pet summaries (species, nickname, level, rarity, star, power).
  The slug is normalized/reserved-route checked and unique via a partial index.
- **Defense log.** Battles store `opponent_snapshot_id`; the defender queries completed
  battles against their snapshots, joins the attacker profile and active share link, and
  labels the outcome from the defender's perspective. Revenge creates a fresh battle against
  the attacker's current snapshot with the defender's current team.
- **Discovery.** Bestiary `[id]` has a server layout with metadata + JSON-LD. `sitemap.ts`
  includes static routes, all playable species and public trainer slugs; `robots.ts`
  disallows `/api/`, `/account`, `/admin/`, `/replay/` and `/transfer`. Replays are
  `noindex`.

## 14. Security and launch readiness

- **Headers/CSP.** `next.config.ts` sets `default-src 'self'`, self-only images/fonts/
  scripts/styles, `frame-ancestors 'none'`, `base-uri`, `form-action`, `object-src 'none'`,
  plus `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy` and COOP. HSTS is sent only
  when `TAMARAGNA_HTTPS=1` or on Vercel, so the local HTTP launcher keeps working.
- **CSP trade-off.** Next hydration scripts require `'unsafe-inline'` without a nonce; a
  nonce-based CSP is a follow-up because it interacts with static caching.
- **CSRF.** `src/proxy.ts` rejects non-GET `/api/**` requests whose `Origin` host differs
  from the request host. CLI clients without `Origin` are allowed.
- **Rate limits.** `src/lib/rate-limit.ts` uses a Postgres upsert with a fixed window. Applied
  to hatch (3/10s), care (20/10s), matchmaking (2/10s), claims, transfers, tower starts,
  share creation (10/min), revenge (2/10s), trainer-card changes (5/min), auth email
  (5/10min), auth verify (20/10min), push subscription (10/min), evolution (5/min), live
  queue (12/min), spectator tickets (20/min), tournament actions (10/min), guild creation
  (3/10min), guild attacks (12/min), market list/buy (10/20 per 10min), expedition starts
  (6/10min), ranch visits (20/10min), ranked joins (10/10min), spectator picks (20/10min),
  retirement (5/10min) and dojo train/spar (6/20 per 10min).
- **Migrations and flags.** The DDL is the idempotent baseline; numbered additive migrations
  run in a transaction and record in `schema_migrations`. Share, telemetry, accounts,
  evolution and live PvP default on; setting the matching `FEATURE_*` env to `0` disables one.
- **Secrets.** `LIVE_TOKEN_SECRET` signs match/spectator tickets; `CRON_SECRET` gates
  reminders; `ADMIN_TOKEN` gates admin/aggregate/dev routes; `VAPID_*` and
  `RESEND_API_KEY`/`EMAIL_FROM` enable delivery. None are committed.
- **Actor seam.** Routes can use `withActor`; it prefers a valid session and falls back to
  the device cookie. `withUser` remains a compatibility wrapper for device-only routes.
- **Account recovery.** Transfer codes are hashed at rest, expire in 15 minutes, are single
  use, and are rate-limited. Redeeming into a device with an existing ranch is refused.
- **Health.** `/api/health` runs `select 1`, returns the pinned rAthena SHA, species count and
  migration version, and is `no-store`.
- **Verification.** Playwright covers landing/bestiary, hatch → reveal → ranch, quests,
  account/transfer, trainer cards and share → replay → revoke. `scripts/load-test.ts`
  measures public reads. The M2–M6 API/SSE flow is covered by the verification run described
  in `STATUS.md`: accounts, evolution, live queue/SSE/replay/spectate, tournaments, telemetry
  aggregation and the admin dashboard.

## 15. Identity, telemetry, progression and live PvP

### 15.1 Accounts and sessions

- `POST /api/auth/magic-link` always returns a generic result; a token hash is stored with a
  15-minute TTL and the link is sent through Resend (or logged when `AUTH_DEV_MODE=1`).
- `GET /api/auth/verify` consumes the token, finds/creates the user, links the current device
  ranch when the account has none, and creates a revocable session (`tr_session`, hashed at
  rest, 30-day sliding window).
- Google sign-in is a second door to the same path: `/api/auth/google/start` stores an OAuth
  `state` in a 10-minute httpOnly cookie and redirects to Google; `/api/auth/google/callback`
  verifies the state, exchanges the code, requires `email_verified`, then calls the same
  `resolveUser` / `resolveProfileForUser` helpers (and the `ensureOwnerEmail` bootstrap) before
  creating a session. It needs no email delivery, only `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET` and `<site>/api/auth/google/callback` registered as a redirect URI.
- `getActor()` checks the session first; if the account has no profile, the device ranch is
  linked. A device already owned by another account is never stolen. `withUser` remains a
  compatibility wrapper around the actor.
- Logout, revoke-others and account deletion are explicit. Deletion unlinks the ranch rather
  than deleting the player's pets.

### 15.2 Push and care sync

- VAPID keys are optional. `push_subscriptions` stores endpoint/keys/preferences;
  `/api/cron/reminders` is gated by `CRON_SECRET`, looks for hungry/tired pets, enforces a
  six-hour `notification_log` window and sends via `web-push`.
- The worker handles `push` and `notificationclick`; the care outbox is IndexedDB-backed,
  registers a `care-sync` tag, and posts with an `Idempotency-Key`. The care route stores the
  first response in `idempotency_keys` and replays it for duplicates.
- Background Sync is unavailable in Safari; the client falls back to retrying on the next
  online/load event.

### 15.3 Telemetry

- Every verified battle completion writes a compact `battle_complete` event (team signatures,
  winner, mode, duration, wave) and never a raw input log or PII.
- `recomputeBalance()` rebuilds `balance_daily`; the same code powers
  `npm run balance:aggregate` and `POST /api/admin/balance/aggregate`.
- `/admin/balance` is gated by `ADMIN_TOKEN`, shows species/rarity/nature/star/stage/skill
  win rates and flags species outside 35–65% with n ≥ 10. Raw events are pruned after 90
  days with `npm run telemetry:prune`.

### 15.4 Evolution and mastery

- `data/evolution.yaml` defines 24 families / 48 edges. `build-evolution.ts` resolves species
  IDs, rejects non-playable targets, duplicate edges and cycles, and writes the generated
  graph.
- Evolution requires the previous stage, level 50, the target star and coins. It preserves
  level/IVs/nature/star, applies a +8% base-stat multiplier per stage above 1, resets the
  loadout to the new species default and carries 50% of matching skill XP.
- `pet_skill_mastery` levels 1–5 add +2% skill power and +1 percentage point status chance
  per level. XP comes from verified casts; the values are baked into `CombatantInit` so
  snapshots/replays stay self-contained.
- Lineage is a recursive parent lookup from `parent_a_id`/`parent_b_id`; breeding writes both
  parents.

### 15.5 Live PvP transport

- `createLiveRoom()` runs the same deterministic `BattleEngine` at 50 ms ticks in a Node
  process. It broadcasts snapshots every 100 ms over SSE; inputs arrive over HTTP and are
  seat-checked. Both sides use `pressSkillFor`/`swapFor`; the engine remains authoritative.
- On finish, the room replays the combined `{t,kind,index,side}` log to produce the canonical
  result/checksum, updates the battle row, applies Elo/placement K and grants rewards.
- HMAC tickets (`LIVE_TOKEN_SECRET`) bind match, profile, seat and a two-hour expiry.
  Spectators get a read-only ticket and a five-second delayed feed.
- Matchmaking picks the closest rating from `matchmaking_queue`, deletes both entries and
  creates a `live_matches` row + room. Polling `/queue` gives the opponent their seat/ticket.
- **This is single-instance.** PartyKit/Cloudflare Durable Objects is the production swap for
  multiple instances; the room/ticket boundary is intentionally isolated.

### 15.6 Tournaments

- Admin creates a 4/8/16 bracket with `ADMIN_TOKEN`; entrants join a draft; any entrant can
  start once full. Bracket generation creates every round/slot up front.
- `startTournamentMatch` creates a live room for the two bracket players and links the
  `tournament_match_id`. On room completion `advanceTournament()` sets the winner and
  populates the next round, completing the tournament at the final.
- The UI polls the bracket, shows entrants/matches, and gives each participant an **Enter
  match** action that returns their seat/ticket.

## 16. Seven upgrades and free deployment

### 16.1 Guilds and raids

- `guilds` + `guild_members` enforce one guild per profile and leader/officer/member roles.
- A raid is a 60k HP `guild_raids` row tied to Baphomet (species 1039) with a seven-day
  window. Attacks load the member's team, run a deterministic auto battle against a scaled
  boss and convert missing boss HP into damage. `guild_contributions` is upserted atomically
  with SQL increments. The defeat blow pays a larger coin/material bonus.

### 16.2 Auction house

- Listing locks `pets.market_listed` and a partial unique index guarantees one active listing
  per pet. Only storage pets are eligible.
- Buyout runs in a transaction: pet ownership/slot/market flag, listing status/buyer/fee,
  buyer debit and seller credit (price − 5%) all commit together. Both PvP snapshots refresh.
- Cancelling flips the listing and clears the pet lock. Sold/cancelled rows remain history.

### 16.3 Expeditions

- Routes are static (`expeditions.ts`), rewards are computed at departure from pet levels and
  friendship, and `pets.expedition_id` locks the party from team/market/care/breed/evolve.
- Claim checks the timer, clears locks and credits coins/eggs/materials in one transaction.

### 16.4 Habitats and visits

- `profiles.habitat` stores one of four themes; switching spends `profiles.materials`.
- Public trainer cards expose the habitat and visit count. A visit is rate-limited, writes
  `ranch_visits`, pays host/visitor coins and does not expose private roster data.

### 16.5 Ranked circuit and spectator picks

- `ranked_cups` wraps an existing tournament row; join/start delegate to the tournament
  service, so brackets and live match linking are shared.
- `spectator_picks` is keyed by live match + voter; active players are rejected. On room
  finish the winner settles all picks, awards 10 points to correct voters and stores the
  result. `/ranked` shows the ladder, cups and spectator points.

### 16.6 Legacy and dojo

- Retirement requires level 50 and a non-locked pet. It writes a `legacy_marks` row, deletes
  the pet and adds points. Breeding spends 10 points for +2 IVs and attaches the newest mark.
- Ghosts store a baked `CombatantInit[]` from the current team or the last opponent. Sparring
  creates a battle row, simulates server-side, records telemetry/mastery, grants coins and
  updates the ghost record. A battle link preserves the result.

### 16.7 Render Free + Supabase Free

- `src/lib/db/client.ts` reads `DATABASE_URL` and uses `prepare: false` with
  `POSTGRES_MAX` (default 1 on Vercel). For Render, use Supabase’s shared pooler in
  **session mode** (port 5432); transaction mode (6543) is for serverless/edge.
- Render Free does not support `preDeployCommand` (paid web services only), so the free
  Blueprint runs `npm run db:migrate` at the end of the build command. Move it to
  `preDeployCommand` if you upgrade to a paid instance.
- `render.yaml` builds/migrates once and runs `npm start` as a single free web service. The
  health check is `/api/health`; `TAMARAGNA_HTTPS=1` enables HSTS.
- Live rooms remain in the Render process, so the service must stay at one instance. Render
  Free sleeps after 15 minutes without incoming HTTP/WebSocket traffic; a sleep or deploy
  drops active rooms. Supabase Free pauses after a week of inactivity.
- See `docs/DEPLOY-RENDER-SUPABASE.md` for the exact setup, limits and smoke checks.

### 16.8 Verification

- Vitest: 111 tests across the engine, genetics, sharing, telemetry, evolution, mastery, live
  tickets, expeditions, habitats, legacy, stat overrides and the CSRF origin guard.
- Playwright: 7 flows, including all seven new hub pages.
- Fresh-database HTTP verification exercised every new flow: guild/raid, market sale, habitat
  purchase + visit, legacy retirement, dojo spar, expedition start, ranked cup with eight
  entrants, and a live spectator pick.

### 16.9 Owner/admin console

- `/admin` accepts either the shared `ADMIN_TOKEN` (owner bootstrap identity), an owner account,
  or an admin account. `users.admin_role` is `owner`, `admin` or null; `is_super_admin` is kept
  in sync for compatibility. The oldest legacy super admin becomes owner in migration
  `0008_admin_roles`; after that, only the owner (or token) can change roles.
- `OWNER_EMAIL` promotes the matching magic-link account only when no owner exists. That keeps
  the bootstrap safe while allowing an explicit owner transfer to stick.
- `/api/admin/roles` is owner-only for mutations: grant by account email, revoke, rollback the
  target's last role event, and transfer ownership (demotes the current owner to admin).
- Every role change writes `admin_role_events` (`actor`, `target_email`, action, previous/new
  role, reason, timestamp). Owners see all events; an admin sees events involving their own
  account. Normal admin mutations still write `admin_audit_log`.
- `/api/admin/*` exposes player search, wallet edits, pet generation, pet stat edits and pet
  gifting. Every mutation writes an audit row. `/admin/balance` accepts an owner/admin session
  or the token; ranked cup/tournament creation and aggregate rebuilding use `superAdminGuard`.
- Economy/pet admin edits are direct, unlimited within the API bounds, audited but not
  reversible; role changes are the only reversible admin action.
- Stats stay derived. `pets.stat_overrides` holds admin-forced final values (`hpMax, atk,
  matk, def, mdef, aspdMs, critChance, critMult, statusResist`) that `applyStatOverrides()`
  applies after nature, stars, care and evolution stage in both `petView()` and
  `buildCombatant()`, so the roster, PvP snapshots and battles all agree.
- Gifting reuses the market-move rules: active listings are cancelled, `slot`, `market_listed`
  and `expedition_id` are cleared, ownership is re-asserted in the UPDATE, and both players'
  PvP snapshots are refreshed. The 30-pet cap applies to the receiving ranch.
