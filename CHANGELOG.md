# Changelog

All notable changes to TamaRagna. The project is a non-commercial fan game; versions are
pre-1.0 and the format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- Installable PWA built with Serwist + `@serwist/turbopack`: web app manifest, 192/512/
  maskable icons, Apple touch icon, precached app shell and an offline fallback page.
- Service-worker caching policy: RO sprites, skill icons and maps are cache-first; all
  other `/api/**` routes are network-only; documents are network-first; hashed assets use
  stale-while-revalidate.
- `npm run icons` regenerates the icon set from the Lucide `sparkles` glyph (ISC).
- Open Graph/Twitter metadata and `appleWebApp` configuration in the root layout.
- Eight natures with ±10% stat modifiers, rolled at hatch and inherited through breeding.
- Awakening: merge a same-species duplicate to raise a pet from 1★ to 5★ (+4% stats/star).
- Breeding at level 10+ for 2 eggs + 250 coins, inheriting per-stat IVs, nature and rarity.
- Team synergies: Elemental Focus, Kindred and Mixed Company.
- Status resistance derived from VIT/LUK, applied to enemy status chances.
- `/breed` page, `POST /api/breed` and `POST /api/pets/:id/awaken`.
- Six-skill species kits (four offensive + two support) with per-pet 4-of-6 loadouts and a
  team-screen editor.
- Nature reroll for 300 coins, always landing on a different nature.
- Season 1 living content: daily/weekly quests, a login streak, seasonal placements and
  rewards, three rotating featured species, tower draft blessings, and elite wave affixes.
- `npm run season:roll`, plus the `seasons`, `quest_states` and `season_rewards` tables.
- Account transfer codes, save export/import, CSP/security headers, CSRF origin checks,
  DB-backed per-route rate limits, a health endpoint, and matchmaking/leaderboard indexes.
- Playwright E2E (`npm run e2e`) and a dependency-free load test (`npm run load`).
- M0 foundation: additive versioned migrations with `schema_migrations`, `db:migrate` /
  `db:status`, a device-cookie actor seam, process-wide feature flags, `BattlePayload.version`
  and schema-version reporting in `/api/health`.
- M1 sharing: unlisted 12-character replay tokens, read-only replay theater, share buttons,
  replay/trainer OG images, opt-in public trainer cards with unique slugs, a defense log with
  revenge, and bestiary metadata/JSON-LD plus `sitemap.xml` and `robots.txt`.
- `battle_shares`, public profile fields and the `src/proxy.ts` origin check.
- M2 telemetry: `analytics_events`, `balance_daily`, battle outcome capture, a deterministic
  aggregation service, `/admin/balance` outlier reporting, `balance:aggregate` and a 90-day
  `telemetry:prune` script.
- M3 accounts: magic-link email tokens, revocable hashed sessions, the session-aware actor,
  ranch linking, account deletion, VAPID push subscriptions, a secret-gated reminder cron,
  a service-worker push/notification handler, and an IndexedDB care outbox with idempotent
  care writes.
- M4 progression: a validated 24-family / 48-edge evolution graph, stage stat multipliers,
  branching options, parent-linked lineage, per-skill mastery XP, mastery-scaled skills, a
  team-screen evolution panel and an admin seed helper for local testing.
- M5 live PvP: authoritative in-memory rooms at 50 ms ticks, matchmaking, HMAC player and
  spectator tickets, SSE snapshots, five-second delayed spectating, canonical live replay
  checksums, live queue/arena/watch pages, and single-elimination tournaments with bracket
  generation and live match linking.
- M6 tuning: balance aggregation/outlier dashboard, live/async outcome telemetry and the
  evolution/mastery tuning hooks.
- Seven post-M6 upgrades: guilds with weekly co-op raid bosses and contribution boards; a
  fixed-price pet auction house with a 5% fee and pet locking; storage-pet expeditions with
  time/friendship-scaled rewards; four ranch habitats plus public ranch visits; a ranked
  ladder with admin-created cups linked to tournaments and spectator winner picks; legacy
  retirement marks with breeding IV inheritance; and a ghost dojo trained from the current
  team or the last opponent.
- Render Free + Supabase Free deployment: `render.yaml`, a `POSTGRES_MAX` pool cap,
  pooler-safe prepared statements and a step-by-step deployment guide.
- Public repository at <https://github.com/marksandrotutor300-sketch/tamaragna> with a
  **Deploy to Render** button. `main` is the deploy branch; Render's
  `autoDeployTrigger: commit` rebuilds and migrates on every push.
- Super-admin console at `/admin`, gated by `ADMIN_TOKEN` or an account flagged with
  `users.is_super_admin` (`npm run admin:promote -- <email>`): player search, wallet edits,
  pet generation (custom or random), pet stat edits, pet gifting and an `admin_audit_log`.
- `pets.stat_overrides` raw stat overrides applied after nature/stars/care/evolution in both
  the roster view and battle combatants.
- `/more` hub, seven feature screens, and Playwright coverage for the new hub pages.
- CSRF origin guard now trusts Render's `x-forwarded-host` and `NEXT_PUBLIC_SITE_URL`,
  fixing `Invalid origin` on mutations behind the Render proxy.

### Changed

- The worker route is prerendered at build time (`● /serwist/sw.js`), so it is never
  compiled per request.
- Re-enabled pinch zoom by removing `maximumScale: 1` from the viewport.
- Disabled the `X-Powered-By` header.
- Tower waves 1–4 force Hardy, zero-IV enemies so a fresh pet can clear the opening.
- The stat pipeline applies nature, stars and team synergies before a battle payload is
  stored; the client needs no extra genetics state.
- The bestiary was regenerated with six skills per species; validation now requires at
  least four offensive and two support skills per kit.
- Existing pets default to the first three attacks plus one support; `ensure-data` detects
  stale four-skill data and rebuilds it.
- New profiles join the highest season in use; rollover resets ratings/placements and opens
  the next season.
- PvP uses K=40 for the first five matches of a season, then K=24.
- Tower results return to the tower screen so a blessing can be chosen before the next wave.
- HSTS is only sent on HTTPS deployments (`TAMARAGNA_HTTPS=1` or Vercel), so the local HTTP
  production launcher keeps working.
- OG images use public static sprite URLs instead of the local proxy; Satori's SSRF
  protection rejects localhost image sources.
- `NEXT_PUBLIC_SITE_URL` supplies canonical/sitemap/share origins; without it the app falls
  back to `http://localhost:3000`.
- Feature flags now default on for every shipped track; set `FEATURE_*=0` to disable one.
- Live match input checksums normalize `{t,kind,index,side}` before hashing so JSONB key
  ordering cannot break replays.
- Live rooms are single-instance and in-memory; PartyKit/durable rooms remain the production
  follow-up.
- Added `web-push` and its types for VAPID delivery.
- The Vitest suite grew from 19 to 75 tests; Playwright now covers 7 flows.
- The production build is 1.03 MB client JS; the worker precaches 53 entries (~1.28 MB).
- The CSRF origin guard now accepts Render's `x-forwarded-host` and the configured
  `NEXT_PUBLIC_SITE_URL`, fixing `Invalid origin` on mutations behind the Render proxy.
- Render Free is the current public deployment target (single instance, sleeping); Supabase
  Free supplies the Postgres pooler. Durable rooms remain the production follow-up.

## [0.1.0] — 2026-10-31

First playable release. Every planned system is implemented, built and smoke-tested.

### Added

**Data**
- Pinned rAthena data pipeline (`d4b8e7b8f160`) parsing `mob_db.yml`,
  `mob_skill_db.txt`, `pre-re/mob_skill_db.txt`, `skill_db.yml`, `attr_fix.yml` and the
  `npc/re/mobs/**` spawn scripts.
- Shared combat-budget normalization so HP and attack scale together (2,675 parsed,
  867 playable species).
- 64 curated combat skills and per-element archetype kits; exactly four skills per species.
- Playability filter removing dummies, champion variants, summons and scripted structures.
- Idempotent bestiary validation with stat-band, kit-completeness and element-chart checks.

**Game**
- Hatching with Wild and Focused eggs, tier-weighted species selection, five rarity tiers,
  six IVs, and per-species skill levels.
- Three-pet roster with storage, slot assignment, renaming and mid-battle swaps.
- Tamagotchi care: hunger, mood, energy, friendship; lazy decay capped at 36 hours; sleep;
  feed/play/train actions and visible combat modifiers.
- Deterministic ATB battle engine at a 50 ms tick with casts, status effects, AoE skills,
  crits, shields, per-battle luck, faints, forced swaps and a 180 s timeout.
- Endless Tower with level-relative wave scaling, MVP boss waves, HP carry-over, persisted
  runs, deterministic wave seeds, and a leaderboard.
- Async PvP with ghost teams, ±150 rating matchmaking, Elo (K = 24), duel history, and
  automatic snapshot refreshes after team/care/battle changes.
- Bestiary browser with search, tier/element filters, pagination and detail pages,
  including practice battles.

**Platform**
- Next.js 16 App Router UI with Tailwind v4, responsive down to 390 px, bottom navigation.
- Anonymous device-cookie accounts with cloud saves.
- Deterministic server replay verification and checksum rejection for tampered results.
- Sprite/icon/map proxy with `ragassets` → `divine-pride` fallback and an opt-in
  self-hosted `zrenderer` provider.
- Drizzle schema with idempotent DDL for Postgres and embedded PGlite.
- One-click launchers: `Play TamaRagna.cmd` and `play.sh`.
- Vitest suite (19 tests) and end-to-end smoke scripts (`smoke`, `smoke:pvp`).
- Documentation set: README, STATUS, GAME-DESIGN, ARCHITECTURE, DATA-PIPELINE, OPERATIONS,
  NOTICE.

### Changed

- Adopted **npm** instead of pnpm because Corepack could not write to `Program Files`.
- Replaced the planned Supabase auth with anonymous device cookies, preserving cloud saves
  and async PvP without an account system.
- Chose embedded PGlite for local development and Postgres for production, sharing one
  schema.
- Switched species tiers from fixed level cutoffs to level-percentile cutoffs so renewal
  monsters distribute across all five tiers.
- The tower's auto/manual toggle now applies to an already-generated pending wave.

### Fixed

- Removed a 1.2 MB client-bundle leak caused by importing egg constants from a module that
  also loaded the species dataset (total client JS is now 0.83 MB).
- Fixed inverted AI flags that made "manual" control auto-play and vice versa.
- Moved the embedded database outside the project directory, stopping a dev-server reload
  loop triggered by database writes.
- Made the initial tower waves scale from the team's level so a fresh level-1 pet can clear
  them.
- Rebalanced damage and element multipliers to stop one-shot fights and near-certain
  element wins.
- Corrected the active-run wave display to show the wave being attempted.
- Duplicate battle submissions now return 409 before the rate-limit check.

### Known limitations

See [docs/STATUS.md](docs/STATUS.md#known-limitations). The main ones: replay verification is
a consistency check rather than cheat prevention, the defender's PvP team is a snapshot, and
third-party sprite hosts have no SLA.
