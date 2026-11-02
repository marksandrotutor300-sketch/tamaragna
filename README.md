# TamaRagna

A Tamagotchi-inspired Ragnarok monster collector for the browser. Hatch real Ragnarok
Online mobs, feed and raise them, climb an endless tower, and duel other trainers' saved
teams asynchronously.

**Status: v0.1.0 — playable end to end.** Every system described in
[docs/STATUS.md](docs/STATUS.md) is implemented, built and smoke-tested.

**Non-commercial fan project.** No game art is authored or redistributed — see
[NOTICE.md](NOTICE.md).

Source: <https://github.com/marksandrotutor300-sketch/tamaragna>

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/marksandrotutor300-sketch/tamaragna)

---

## Run it

### One click

- **Windows:** double-click **`Play TamaRagna.cmd`**.
- **macOS / Linux:** `./play.sh` (make it executable once with `chmod +x play.sh`).

The launcher installs dependencies on first run, builds the game, starts the server and
opens <http://localhost:3000>. Later launches start instantly because the build is cached.
Close the console window to stop the game.

### Manual

```bash
npm install
npm run dev
```

First run fetches rAthena data at a pinned commit, generates the bestiary, and creates an
embedded PGlite database at `~/.tamaragna/pglite`. No Docker, no accounts, no external
services.

### Install as an app

Open the production build in Chrome, Edge or Safari and choose **Install app** / **Add to
Home Screen**. The installed game opens straight to the ranch, caches the app shell, icons
and RO sprites, and shows an offline page when a screen has not been visited yet.

The service worker is intentionally disabled in `next dev`; test installability with
`npm run build && npm start`.

---

## What's in the box

- **2,675 monsters parsed from rAthena, 867 playable** field mobs and MVPs. Each species
  keeps its real element, race, size, spawn maps and a **six-skill kit** built from its
  actual `mob_skill_db` entries (64 curated combat skills); each pet equips four.
- **Individual rarity.** Every pet rolls a rarity tier (Common → Legendary) and six
  individual values (0–31). Rarity raises the IV floor, a flat stat multiplier and skill
  levels, so two Porings are never identical.
- **Genetics.** Eight natures, 1–5★ awakening, breeding with IV/nature/rarity inheritance,
  4-of-6 skill loadouts, nature rerolls, and team synergies (element focus, race bond,
  mixed company).
- **Season 1 living content.** Daily/weekly quests, a login streak, seasonal placements and
  rewards, three rotating featured species, and a tower draft with elite affixes.
- **ATB auto-battler.** Attack-speed gauges, four skills on cooldown, 3-pet roster with one
  active fighter, manual swaps, auto-battle or manual control.
- **Deterministic simulation.** The same TypeScript engine runs in the browser and on the
  server. Submitted input logs are replayed and rejected if the checksum differs.
- **Endless Tower.** Waves scale from your team's level, every 10th wave is an MVP, elite
  waves carry affixes, each cleared wave offers a run-scoped blessing, and there is a global
  leaderboard.
- **Async PvP.** Fight snapshots of other players' teams with placements, seasonal tiers,
  rewards and rating history.
- **Tamagotchi care.** Hunger, mood, energy and friendship decay in real time (capped at
  36h offline) and modify combat.
- **Real sprites with zero assets in the repo.** Sprites, skill icons and map backdrops are
  fetched at runtime through a caching proxy with a provider adapter.
- **Installable PWA.** Add it to your home screen; the shell, icons and sprites are cached,
  and an offline page explains what still needs a connection.
- **Shareable replays.** Create an unlisted replay link for any finished battle, watch it in
  the replay theater, and get an OG image from the static sprite. Public trainer cards and
  an opt-in defense log with revenge complete the loop.
- **Discoverable bestiary.** Every bestiary page has SSR metadata and JSON-LD; playable
  species and public trainer cards feed `sitemap.xml`, with `robots.txt` keeping replays and
  private routes out of search.
- **Versioned foundation.** Additive SQL migrations with `schema_migrations`, feature flags,
  a device/session actor seam and versioned battle payloads.
- **Accounts and recovery.** Email magic-link sign-in, revocable sessions, account-linked
  ranches, save export/import, Web Push care reminders and a Background Sync care outbox.
- **Progression.** 24 curated evolution families (48 edges), branching lines, inherited
  lineage records and per-skill mastery levels from verified battle casts.
- **Social and economy.** Guilds with shared raid bosses, a fixed-price pet auction house
  with a 5% fee, storage-pet expeditions, ranch habitats and public ranch visits.
- **Competitive circuit.** Ranked ladder, admin-scheduled cups linked to tournaments, and
  spectator winner picks with spectator points.
- **Long-term progression.** Legacy retirement marks that improve future breeding, plus a
  ghost dojo learned from your team or last opponent.
- **Live PvP.** Server-authoritative live rooms, matchmaking, reconnect-friendly SSE,
  delayed spectators, and single-elimination tournaments.
- **Telemetry.** Battle outcome events, daily balance aggregates, outlier reporting and an
  admin dashboard.
- **Admin console.** Super-admin account or `ADMIN_TOKEN` access for player search, wallet
  edits, pet creation/editing/transfer, stat overrides and an audit log.
- **Deployable free.** `render.yaml` and `docs/DEPLOY-RENDER-SUPABASE.md` run the app on
  Render Free with Supabase Free Postgres. The repo is deployed from
  `main`; Render's `autoDeployTrigger: commit` rebuilds and migrates on every push.

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/STATUS.md](docs/STATUS.md) | Implementation status, verification results, known limitations, next steps |
| [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md) | Exact mechanics, formulas, rarity tables, battle rules, tower scaling, economy |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, module map, data flow, database schema, API surface, integrity model |
| [docs/DATA-PIPELINE.md](docs/DATA-PIPELINE.md) | rAthena sources, normalization math, skill-kit construction, playability filter |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Running, deploying, environment variables, troubleshooting |
| [docs/UPGRADES.md](docs/UPGRADES.md) | Guilds, auction house, expeditions, habitats, circuit, legacy, dojo |
| [docs/DEPLOY-RENDER-SUPABASE.md](docs/DEPLOY-RENDER-SUPABASE.md) | Free live deployment on Render + Supabase |
| [docs/ADR-LIVE-TRANSPORT.md](docs/ADR-LIVE-TRANSPORT.md) | Live room transport decision and production path |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [NOTICE.md](NOTICE.md) | Copyright, attribution and asset policy |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Drizzle ORM ·
Postgres or embedded PGlite · TanStack Query · Serwist (PWA) · Vitest.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (generates game data first if missing) |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | 75 unit tests: engine, genetics, sharing, telemetry, evolution, mastery, live tickets, expeditions, habitats, legacy, CSRF origin |
| `npm run balance` | Headless battle pacing sweep |
| `npm run smoke` | End-to-end API + server replay check (server must be running) |
| `npm run smoke:pvp` | Two-account matchmaking, replay and Elo check |
| `npm run data:build` | Regenerate the bestiary from the cached rAthena snapshot |
| `npm run data:validate` | Assert species/skill/stat invariants |
| `npm run data:refresh` | Re-fetch rAthena at the pinned commit |
| `npm run data:evolution` | Rebuild the curated evolution graph |
| `npm run balance:aggregate` | Rebuild daily balance aggregates from battle events |
| `npm run telemetry:prune` | Delete raw analytics events older than 90 days |
| `npm run icons` | Regenerate the PWA icon set from the Lucide glyph |
| `npm run season:roll` | Close the season, write rewards, reset ratings, open the next |
| `npm run db:unlock` | Remove a stale PGlite lock after a forced shutdown |
| `npm run db:migrate` / `db:status` | Apply and inspect additive schema migrations |
| `npm run e2e` | Playwright end-to-end tests (uses installed Chrome) |
| `npm run load` | 200 requests per public endpoint at concurrency 10 |
| `npm run typecheck` / `npm run lint` | Static checks |

Live duels use a single Node process for authoritative rooms. Run one instance (or move the
room service to PartyKit) before enabling live PvP across multiple instances.

For a free public demo, use the Render Blueprint (`render.yaml`) with a Supabase Free
Postgres pooler URI. Render Free is a single sleeping instance; read
[docs/DEPLOY-RENDER-SUPABASE.md](docs/DEPLOY-RENDER-SUPABASE.md) before inviting players.

## Project layout

```
scripts/                 rAthena fetch, bestiary build + validation, balance sweep, smoke tests
src/lib/game/            species loading, stats, rarity, care, hatch, tower, PvP, views
src/lib/sim/             deterministic battle engine + server replay
src/lib/assets/          sprite provider adapter (ragassets / divine-pride / zrenderer)
src/lib/db/              Drizzle schema, Postgres/PGlite bootstrap, anonymous auth
src/app/api/             REST surface (pets, hatch, battles, tower, PvP, asset proxies)
src/app/(game)/          ranch, team, hatch, tower, arena, bestiary
src/app/sw.ts            Serwist service worker (precache + runtime caching)
src/app/manifest.ts      web app manifest
src/app/offline/         offline fallback document
src/app/serwist/         prerendered /serwist/sw.js route
src/components/          battle stage, pet sprites, radar, care panel, UI primitives
docs/                    status, design, architecture, pipeline, operations
```

## Legal

This is a non-commercial fan project. Ragnarok Online assets are © Gravity Co., Ltd. &
Lee Myoungjin (studio DTDS). No game assets are committed to this repository; sprites and
icons are loaded at runtime from public community sources. Game data is derived from
rAthena (GPL-3.0). Read [NOTICE.md](NOTICE.md) before deploying publicly.
