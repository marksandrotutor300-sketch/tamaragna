# Operations

Running, configuring and deploying TamaRagna.

---

## 1. Requirements

- **Node.js 20 or newer** (developed on Node 24).
- **npm** (the project is developed with npm; pnpm/yarn work but are untested).
- Network access on the **first run**, to download the pinned rAthena snapshot.
- A **production build** (`npm run build && npm start`) to test the service worker; it is
  intentionally disabled in `next dev`.
- No Docker, database server, or API keys are required for local play.

---

## 2. Running

### One-click

- **Windows:** double-click `Play TamaRagna.cmd`.
- **macOS / Linux:** `chmod +x play.sh && ./play.sh`.

The launcher:

1. verifies Node ≥ 20,
2. runs `npm install` only when `node_modules` is missing,
3. runs `npm run build` only when the build or generated data is missing,
4. starts the production server,
5. polls `http://localhost:3000` and opens the browser,
6. detects an already-running server on port 3000 and just opens the browser.

Set `TAMARAGNA_NO_BROWSER=1` to suppress the browser (useful for headless/CI).

### Development

```bash
npm install
npm run dev
```

`predev` runs `scripts/ensure-data.ts`, which fetches and builds the bestiary if
`data/generated/species.json` is missing.

### Production

```bash
npm run build
npm start
```

`prebuild` also ensures the data exists. The server listens on port 3000 by default.

---

## 3. Environment variables

Copy `.env.example` to `.env` to override defaults.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | unset | Postgres connection string. When unset, embedded PGlite is used |
| `POSTGRES_MAX` | `5` (`1` on Vercel) | Postgres pool size; use `1` with Supabase’s shared session pooler |
| `PGLITE_DIR` | `~/.tamaragna/pglite` | Embedded database directory |
| `ASSET_PROVIDER` | `ragassets` | `ragassets`, `divine-pride` or `zrenderer` |
| `ZRENDERER_URL` | unset | Base URL of a self-hosted zrenderer instance |
| `ZRENDERER_TOKEN` | unset | Access token for zrenderer |
| `TAMARAGNA_HTTPS` | unset | Set to `1` on a self-hosted HTTPS deployment to send HSTS |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Public origin for canonical URLs, sitemap, OG and share links |
| `FEATURE_SHARE` / `FEATURE_TELEMETRY` / `FEATURE_ACCOUNTS` / `FEATURE_EVOLUTION` / `FEATURE_LIVE_PVP` | `1` | Set a flag to `0` to hide that system |
| `AUTH_DEV_MODE` | unset | Set to `1` to return magic links in the API response for local tests |
| `RESEND_API_KEY` / `EMAIL_FROM` | unset | Magic-link delivery; without them the link is logged |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | unset | Web Push delivery |
| `CRON_SECRET` | unset | Required by `POST /api/cron/reminders` |
| `ADMIN_TOKEN` | unset | Gates `/admin/balance`, aggregation and the dev seed helper |
| `LIVE_TOKEN_SECRET` | dev fallback | HMAC secret for live player/spectator tickets |

Recommended for production: `DATABASE_URL` plus either the default asset provider or a
self-hosted renderer.

---

## 4. Database

### Embedded (default, local)

PGlite stores the database in `~/.tamaragna/pglite`. It is a full Postgres compiled to
WASM, persisted to disk, and created idempotently on first connection.

Important constraints:

- **One process at a time.** Do not run dev and production servers simultaneously against
  the same directory.
- **Not for serverless.** Use Postgres when deploying.
- Keep the directory **outside the project**. Database writes inside the project directory
  trigger Next's file watcher and cause reload loops.

### Postgres (production)

Set `DATABASE_URL` and the same DDL is executed on first connection. Any Postgres 13+ works
(Neon, Supabase, RDS, a local server). No migration tool is required for a fresh database;
`drizzle.config.ts` is included if you prefer `drizzle-kit`.

The DDL also adds `pets.nature`, `pets.star`, `pets.loadout`, `pets.evolution_stage`,
`pets.parent_a_id`, `pets.parent_b_id`, `pets.market_listed`, `pets.expedition_id`,
`pets.legacy_trait`, `profiles.placement_matches`, `profiles.user_id`,
`profiles.public_slug`, `profiles.public_card`, `profiles.legacy_points`,
`profiles.spectator_points`, `profiles.habitat`, `profiles.materials` and
`tower_runs.blessings`, and creates `seasons`, `quest_states`, `season_rewards`,
`transfer_codes`, `rate_limits`, `schema_migrations`, `battle_shares`, `users`, `sessions`,
`email_tokens`, `push_subscriptions`, `notification_log`, `idempotency_keys`,
`analytics_events`, `balance_daily`, `pet_skill_mastery`, `live_matches`, `matchmaking_queue`,
`tournaments`, `tournament_entries`, `tournament_matches`, `guilds`, `guild_members`,
`guild_raids`, `guild_contributions`, `market_listings`, `expeditions`, `ranch_visits`,
`ranked_cups`, `spectator_picks`, `legacy_marks`, `dojo_ghosts` and `dojo_runs`. Existing
pets default to Hardy, 1★, stage 1 and the first three attacks plus one support; no manual
migration is needed. New profiles join the highest season in use. `ensure-data` detects stale
four-skill data and generates the evolution graph when missing.

The current schema version is **`0007_super_admin`**.

### Versioned migrations

The idempotent DDL remains the baseline. `getDb()` applies it, then runs every numbered
migration in `src/lib/db/migrations.ts` that is not recorded in `schema_migrations`, inside a
transaction. Migrations are additive (`CREATE TABLE/INDEX IF NOT EXISTS`, nullable columns);
there are no down migrations.

```bash
npm run db:status   # applies pending migrations, then prints applied/pending
npm run db:migrate  # alias for the same runner
```

Back up Postgres before deploying a schema change, run one instance for the first boot after
an upgrade, and keep the PGlite data directory out of the project tree.

### Reset local data

```bash
rm -rf ~/.tamaragna/pglite      # macOS/Linux
rmdir /s /q %USERPROFILE%\.tamaragna\pglite   # Windows
```

This deletes all profiles, pets, runs and ratings. Generated game data is unaffected.

### Backup

- Postgres: standard `pg_dump`.
- PGlite: copy the directory while the server is stopped.

---

## 5. Deploying

### Vercel + Postgres

1. Push the repository, import it in Vercel.
2. Set `DATABASE_URL` to a Postgres instance.
3. Keep outbound network enabled during the build — the build regenerates the bestiary from
   the pinned rAthena commit if `data/generated` is absent.
4. Deploy. Routes use the Node runtime because of the database and proxy.

No cron jobs, queues or additional services are needed.

### Other hosts

Any Node host that can run `next build && next start` works. Ensure:

- a persistent Postgres (not PGlite),
- outbound HTTPS to the configured asset hosts and to GitHub during the build,
- a writable `data/generated` during the build (or commit a build step that generates it).

### Asset hosts

If you want zero third-party dependency at runtime:

1. Extract a Ragnarok client with `zextractor` (see
   [zrenderer](https://github.com/zhad3/zrenderer)).
2. Run zrenderer (Docker or CLI).
3. Set `ASSET_PROVIDER=zrenderer`, `ZRENDERER_URL`, and optionally `ZRENDERER_TOKEN`.

The game will never render placeholders for missing art; sprites are always real assets from
one of the providers.

---

## 6. Smoke tests

With the server running:

```bash
npm run smoke       # profile, hatch, auto + manual battles, tamper rejection, tower
npm run smoke:pvp   # two accounts, matchmaking, replay, Elo, duplicate submission
```

These create throwaway profiles in the configured database. Use a local database when
running them against production.

`npm test` also covers natures, star bonuses, breeding inheritance, skill loadouts, nature
rerolls, quests, season tiers, featured rotation, blessings, affixes, status resistance and
team synergy math.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Launcher says Node is too old | Node < 20 | Install Node 20+ from nodejs.org |
| `EADDRINUSE` on port 3000 | Another server is running | Close it, or let the launcher open the existing instance |
| First launch takes a minute | rAthena snapshot download + build | Expected; later launches are instant |
| Build fails with fetch errors | No outbound network | Connect to the network and rebuild |
| Sprites show `?` | Both asset providers failed for that species | Try `ASSET_PROVIDER=divine-pride`; check the console for proxy 404s |
| Sprites load slowly on the bestiary | 60 cards requesting the community renderer at once | Lazy loading is enabled; wait or switch providers |
| All API routes return 500 | Database failed to open | Check that only one process uses PGlite, or set `DATABASE_URL` |
| Page reloads in a loop in dev | `PGLITE_DIR` points inside the project | Move it outside the project |
| `smoke` fails to connect | Server is not running | Start it with `npm run dev` or `npm start` |
| Typecheck fails after changing data | Stale generated JSON | `npm run data:build` |
| Ratings look reset | New browser profile (cookie cleared) | Identity is the `tr_device` cookie; there is no account recovery yet |
| `nature` or `star` column missing | The database predates the genetics update | Restart the server once so the idempotent DDL runs |
| Awaken button disabled | Fodder must be the same species, in storage, star ≤ target, and you need `150 × star` coins | Hatch a duplicate, bench it, then retry |
| Breed button disabled | Both parents must be level 10+, with 2 eggs + 250 coins | Train the parents or clear more tower waves |
| Skill loadout save disabled | Exactly four skills must be equipped | Select a fourth skill; the counter shows `n/4` |
| Old four-skill data | Generated data predates the six-skill rebuild | Restart dev/build (`ensure-data` rebuilds) or run `npm run data:build` |
| Reroll nature disabled | Rerolls cost 300 coins | Earn coins from tower/PvP or wait |
| Transfer code invalid or expired | Codes last 15 minutes and work once | Generate a new code on the old device |
| Transfer refused: device already has a ranch | The receiving browser already has pets | Use a private window or clear the site cookies first |
| `403 Invalid origin` on an API call | The `Origin` host does not match the app host | Call the API same-origin, or omit `Origin` for CLI clients |
| `429` on a game action | Per-route fixed-window rate limit | Wait for the window; limits are documented below |
| `/api/health` returns 503 | DB check failed | Check `DATABASE_URL` / PGlite lock and process logs |
| Save import refused | Import only works on a ranch with no pets | Use a transfer code for a full profile, or a fresh browser |
| Replay returns 404 | Token revoked, unknown, or the stored checksum no longer verifies | Share the battle again; never edit battle rows manually |
| Trainer card returns 404 | Card hidden, slug changed, or `FEATURE_SHARE=0` | Enable it on `/account` and open the current slug |
| Share/replay API returns 404 | `FEATURE_SHARE=0` | Re-enable the feature or hide the share controls |
| Trainer slug returns 409 | Another profile owns that slug | Pick a different slug on `/account` |
| OG image returns an empty reply or 500 | Satori blocks localhost and needs outbound access to the static sprite | Use the public static sprite URL and verify the server can reach it |
| Sitemap/OG links use localhost | `NEXT_PUBLIC_SITE_URL` is unset | Set it to the public origin and rebuild/restart |
| Migration fails halfway | The transaction rolls back; the version is not recorded | Fix the SQL, back up Postgres, rerun `db:status` |
| `db:status` still shows pending | The connection failed before the runner or the migration threw | Read the server error, fix, run `db:status` again |
| Playwright cannot find Chrome | `channel: "chrome"` requires Google Chrome | Install Chrome, or switch the config to downloaded Chromium |
| Magic link not arriving | No `RESEND_API_KEY`/`EMAIL_FROM`, or `AUTH_DEV_MODE` is off | Check the server log; enable dev mode locally |
| Session not linked to the ranch | The device cookie was missing when opening the magic link | Open the link in the same browser that owns the ranch |
| Push subscription configured but no notification | VAPID keys missing, PWA not installed, or notifications blocked | Set all three `VAPID_*` values and allow notifications |
| Cron returns configured=false | VAPID keys are missing | Configure VAPID or skip push |
| Live queue never matches | No second player or no team on one account | Queue two profiles with teams; one server process must own both |
| Live match disappears after a deploy | Rooms are in-memory | Reconnect/restart the match; durable rooms are the next production step |
| Live replay 404 after a battle | The input log predates checksum normalization or was tampered with | Share a newly completed battle; do not edit battle rows |
| Evolution button disabled | Requires stage +1, Lv 50, the star target and coins | Check the option card for exact requirements |
| Lineage is empty | Hatch-only pets have no parents | Breed a child from two parents to record lineage |
| Tournament bracket won't start | It needs the full player count | Fill the bracket or create a smaller one |
| Balance dashboard 404 | `ADMIN_TOKEN` is unset or the query token is wrong | Set `ADMIN_TOKEN` and reopen `/admin/balance?token=…` |
| Balance dashboard empty | Aggregates have not been rebuilt | `npm run balance:aggregate` or `POST /api/admin/balance/aggregate` |
| Market listing rejected | Pet is on a team, expedition or already listed | Move it to storage and cancel/claim the other state |
| Expedition claim rejected | The timer has not finished | Check `endsAt`; the party must return |
| Guild raid attack does nothing | No active raid, expired raid or no team | Open a raid as leader/officer and set a team |
| Render health check fails | `DATABASE_URL` is missing, paused or the migration failed | Check Supabase status and the Render build log |
| Supabase pooler error | Prepared statements/pool size | Use the shared session pooler URI, `prepare:false` (already) and `POSTGRES_MAX=1` |
| Legacy retire button disabled | Pet is below Lv 50, listed or away | Return it to storage and reach Lv 50 |
| PGlite hangs on startup after a crash | A stale `postmaster.pid` survived a forced kill | Stop everything and run `npm run db:unlock`; it refuses if port 3000 is still in use |
| Draft choices not shown | A battle for the next wave is already pending | Finish or abandon the pending wave; the draft appears when no battle is pending |
| Quest progress not moving | Progress is per UTC day/week | Check the reset text on `/quests`; only care, hatches, wins and tower clears count |
| Season roll prints but does not exit | An older script kept the PGlite worker alive | Use the current script or kill it and remove the stale lock |
| Install prompt never appears | Worker only runs in production, or the page is not on HTTPS/localhost | Use `npm run build && npm start`; check Application → Manifest and Service Workers |
| Old UI after a deploy | A tab is holding pre-deploy chunks | Close other tabs and reload, or unregister the worker in DevTools |
| Offline page appears instead of a page | The document was never visited, or the network failed | Expected: only visited documents are cached, and `/api/**` is never cached |
| `/serwist/sw.js` returns 404 | The build did not prerender the worker route | Rebuild; the route table should show `● /serwist/sw.js`, not `ƒ` |

---

## 8. Monitoring and logs

- Server errors are written to the process output via `console.error` in the API wrapper
  (`src/lib/api.ts`).
- No metrics or tracing are wired in. A production deployment should add request logs and
  an error tracker around the route handlers.
- Battle verification failures return 400 and do not log the submitted log; add logging there
  if you intend to investigate cheating.

---

## 9. Security notes

- Identity is a bearer cookie. Treat it like a session token; it is httpOnly and SameSite=Lax,
  and `Secure` in production.
- All mutations are validated with Zod and scoped to the cookie's profile.
- The server never trusts a client battle result; it replays the input log.
- Submission is rate-limited to one per 2 seconds per profile.
- The asset proxies only fetch allow-listed URLs derived from validated IDs and map names;
  no user-supplied URL is fetched.
- Cookies are httpOnly and SameSite=Lax; JSON-only mutations plus the origin check below are
  the CSRF mitigation. A nonce-based CSP is a future hardening step.
- **Headers.** Responses set CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy` and COOP. HSTS is only sent when `TAMARAGNA_HTTPS=1` or on Vercel.
- **CSRF.** `src/proxy.ts` rejects non-GET `/api/**` requests whose `Origin` host differs
  from the app host.
- **Rate limits.** Fixed windows are persisted in `rate_limits`: hatch 3/10s, care 20/10s,
  matchmaking 2/10s, quest claims 10/10s, season claims 3/min, transfer creation 3/min,
  redemption 5/10min per IP, export/import 3/min, tower starts 5/10s, share creation 10/min,
  revenge 2/10s, trainer-card changes 5/min, auth email 5/10min, auth verify 20/10min, push
  subscription 10/min, evolution 5/min, live queue 12/min, spectator tickets 20/min,
  tournament actions 10/min, guild creation 3/10min, guild attacks 12/min, market list/buy
  10/20 per 10min, expedition starts 6/10min, ranch visits 20/10min, ranked joins 10/10min,
  spectator picks 20/10min, retirement 5/10min and dojo train/spar 6/20 per 10min.
- **Share tokens.** 12-character base62, unlisted, revocable, and only issued for completed
  battles owned by the caller. The public reader re-simulates and rejects a checksum mismatch.
- **Public surfaces.** Trainer cards are opt-in and expose display name, rating, season and
  three pet summaries. Replays are `noindex`; `/api/`, `/account`, `/admin/`, `/replay/` and
  `/transfer` are disallowed in `robots.txt`.
- **Transfer codes.** 50-bit codes, SHA-256 at rest, 15-minute TTL, single use, and a device
  with an existing ranch cannot redeem one.
- **Migrations.** The DDL is additive and idempotent, applied on the first connection. Back up
  Postgres before deploying schema changes and run one instance for the first boot after an
  upgrade. PGlite is single-process.

---

## 10. PWA and offline

### Test installability

1. `npm run build && npm start`.
2. Open <http://localhost:3000> in Chrome or Edge.
3. DevTools → Application:
   - **Manifest:** name, start URL `/ranch`, three icons, no errors.
   - **Service Workers:** `/serwist/sw.js` is activated and controlling the page.
4. Use the browser's install control (address-bar icon or menu → **Install app**).

The worker is disabled in `next dev`, so offline behavior cannot be tested there.

### What is cached

- **Precached at build:** app chunks, CSS, the icon set and `/offline` (34 entries,
  ~1.07 MB).
- **Cached at runtime:** `/api/sprite`, `/api/icon` and `/api/map` (cache-first, 600
  entries / 30 days).
- **Never cached:** every other `/api/**` route. Care, roster, battles and PvP are
  server-authoritative.
- **Documents:** network-first with a 4 s timeout; an uncached document falls back to
  `/offline`.

To verify the fallback, stop the server and navigate to a page you have not visited in that
browser session. The offline page should appear instead of a browser error.

### Updating the worker

`skipWaiting` and `clientsClaim` are enabled, so a new production build takes over on the
next load. If a tab looks stale after a deploy, reload it. If the worker itself is stuck:

1. DevTools → Application → Service Workers.
2. **Unregister** the worker.
3. Reload.

### Icons

The manifest icons live in `public/icons/` and are generated from the Lucide `sparkles`
glyph (ISC licensed) by:

```bash
npm run icons
```

Re-run it after changing `scripts/generate-icons.ts`. The PNGs are committed because
install prompts require stable same-origin icons.

### Caveats

- The worker scope is `/`; the route response sets `Service-Worker-Allowed: /`.
- `localhost` counts as a secure context; production requires HTTPS.
- Background sync, Web Push and periodic sync are not implemented yet.

---

## 11. Season rollover

1. Stop the server (`Ctrl+C` or close the console).
2. Run `npm run season:roll`.
3. Restart with `npm start` or `npm run dev`.

The script:

- computes each profile's tier from its final rating and adds 5 coins per best tower wave
  (capped at 300),
- writes one `season_rewards` row per profile/season,
- resets ratings to 1000 and placement matches to 0,
- opens the next season and closes the previous one in `seasons`,
- updates PvP snapshots and ends active tower runs.

Run it **once per season**. The current season is the highest season in use; new profiles
join it automatically. There is no scheduler or admin UI yet, so rollover is a manual
operator action. PGlite is single-process, which is why the server must be stopped first.

---

## 12. Account recovery

### Move to a new device

1. On the old device, open **Account** and choose **Create transfer code**.
2. On the new device, open `/transfer` and enter the code.
3. The code expires in 15 minutes, works once, and is stored only as a SHA-256 hash.

The receiving browser must not already have a ranch with pets. If it does, use a private
window or clear its site cookies. After redemption, the old device's cookie no longer points
at the profile.

### Export / import

- `/account` → **Download save** writes a JSON snapshot of the trainer and pets.
- **Import save** restores that snapshot **only into a ranch with no pets**. It resets rating
  and placements. Use the transfer code to move a full profile instead.
- Saves exclude battles, quests and season rewards.

---

## 13. Health, E2E and load tests

- `GET /api/health` returns `200` with the pinned rAthena SHA, generation timestamp, species
  count and `schemaVersion`, or `503` if the DB check fails. It is `no-store` and
  unauthenticated.
- `npm run e2e` runs Playwright against `http://localhost:3000`; it reuses a running server
  or starts `npm run dev`. It uses the installed Google Chrome via `channel: "chrome"`.
- `npm run load` sends 200 requests per public target (`/api/health`, `/api/bestiary`,
  `/api/featured`) at concurrency 10 and prints p50/p95/max plus errors. It requires a
  running server. Authenticated write traffic needs a separate seeded run.
- `npm test` remains the fast unit suite; E2E and load are pre-release checks.

---

## 14. Sharing and public cards

- **Share a replay.** After a completed battle, use **Share replay** in the result overlay or
  on the completed battle page. The link is unlisted, 12 characters, and works until revoked
  or replaced. Sharing again revokes the previous active link.
- **Replay theater.** `/replay/<token>` is public and unauthenticated. It re-simulates from
  the stored seed/input log server-side before serving; the viewer renders read-only.
- **Trainer cards.** `/account` → **Public trainer card** opt-in, choose a slug, save. The
  card is public at `/trainer/<slug>`; changing the slug breaks the old URL, and unchecking
  the box removes it from the API/sitemap. It never includes email, device ID or full roster.
- **Defense log.** `/pvp` shows recent attacks against your ghost snapshots. **Watch** opens
  an attacker-shared replay if one exists; **Revenge** creates a fresh battle against the
  attacker's current snapshot.
- **OG images.** Replay and trainer OG routes use the public static `divine-pride` sprite URL
  because Satori's SSRF protection rejects localhost. The server needs outbound network
  access for OG rendering.
- **Discovery.** `/sitemap.xml` covers static routes, all playable species and public trainer
  slugs; `/robots.txt` excludes private/replay paths. Set `NEXT_PUBLIC_SITE_URL` so both use
  the public origin.

---

## 15. Accounts, email and push

- **Magic-link sign-in.** `POST /api/auth/magic-link` returns a generic response and stores a
  hashed token for 15 minutes. Resend sends the link when configured; otherwise it is logged.
  `AUTH_DEV_MODE=1` also returns `devLink` in the response for local testing.
- **Sessions.** `tr_session` is httpOnly, hashed at rest and expires after 30 days. `POST
  /api/auth/logout` revokes it; `/api/auth/revoke-others` keeps only the current session.
  `DELETE /api/auth/account` removes the account but unlinks (does not delete) the ranch.
- **Linking.** Opening the link with the device cookie links that ranch if the account has
  none. An account with an existing ranch keeps it; the device ranch is not merged.
- **Push.** Generate VAPID keys (`npx web-push generate-vapid-keys`), set
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`, then enable reminders on
  `/account` after installing the PWA. Schedule `POST /api/cron/reminders` with
  `x-cron-secret: $CRON_SECRET` (Vercel Cron, GitHub Actions or crontab).
- **Background Sync.** The worker sends queued care actions with an `Idempotency-Key`; the
  care route stores the first response. Safari lacks Background Sync; retry manually or on
  the next load.

## 16. Telemetry and evolution

- Battle completions write `analytics_events`. Rebuild daily rows with
  `npm run balance:aggregate` or `POST /api/admin/balance/aggregate` (admin token). Raw rows
  are pruned with `npm run telemetry:prune` (90 days).
- `/admin/balance?token=$ADMIN_TOKEN` shows win/pick dimensions and outliers; set
  `ADMIN_TOKEN` to a strong value and do not expose the URL publicly.
- Evolution is data-driven: edit `data/evolution.yaml`, run `npm run data:evolution`, and the
  validator rejects unknown/non-playable species, duplicate edges and cycles. It requires
  Lv 50, the target star and coins; stage adds +8% base stats and carries 50% matching
  mastery XP.
- `POST /api/dev/boost` is an admin-token seed helper for local evolution/live/upgrade setup
  (`petId`, `level`, `star`, `coins`, `speciesId`, `eggs`, `materials`, `legacyPoints`).
  Remove `ADMIN_TOKEN` when not needed.
- `/admin?token=$ADMIN_TOKEN` opens the super-admin console (or use a signed-in account
  flagged by `npm run admin:promote -- <email>`). It supports player search, wallet edits,
  pet creation/editing/transfer, stat overrides and the audit log. Keep `ADMIN_TOKEN` private.

## 17. Live PvP and tournaments

- Live rooms run in the Node process at 50 ms ticks and broadcast SSE snapshots every
  100 ms. Run **one** application instance for live PvP; a process restart abandons active
  rooms. The room/ticket boundary is ready for a PartyKit/Durable Objects swap.
- `LIVE_TOKEN_SECRET` signs player and spectator tickets (2-hour expiry). Set it in
  production; the dev fallback is intentionally weak.
- Queue from `/pvp/live`; a second queued profile pairs automatically. The other player's
  poll returns its seat/ticket. Spectators open `/watch/<matchId>` and receive a five-second
  delayed feed.
- Tournaments are created by an admin (`ADMIN_TOKEN`) from `/tournaments`. Entrants join a
  draft; once full, any entrant can generate the bracket. Each bracket match creates a live
  room; completion advances the winner to the next round.
- Match results update both ratings, placements, snapshots and rewards, and write telemetry.
  Live battles can be shared as replays after completion.

## 18. Seven upgrade systems

- **Guilds/raids.** `/guild`; founding costs 500 coins, one guild per trainer, 20 members.
  Leaders/officers open a 60k HP weekly boss; attacks are server-resolved auto battles and
  contribute damage/coins/materials.
- **Auction house.** `/market`; storage pets only. Listings lock the pet, buyout transfers it
  in a transaction and charges a 5% seller fee. The ranch cap is 30 pets.
- **Expeditions.** `/expeditions`; 15/60/180-minute routes, 1–3 storage pets, rewards scale
  with level/friendship. Pets are locked until claim.
- **Habitats/visits.** `/ranch`; four themes bought with expedition materials. Public card
  visitors earn coins and increment the host’s visit count.
- **Ranked/picks.** `/ranked`; admin cups create 8-player tournaments. Spectators pick live
  match winners for 10 points; players cannot pick their own match.
- **Legacy.** `/legacy`; retire a Lv 50 pet for a trait + points. Breeding spends 10 points
  for +2 IVs and attaches the newest mark.
- **Dojo.** `/dojo`; train up to eight ghosts from the team or last opponent, then spar for
  coins and a stored battle. Server-side auto battle.

All seven are covered by the fresh-DB verification run and `/more` Playwright test. See
[UPGRADES.md](UPGRADES.md).

## 19. Render Free + Supabase Free deployment

- `render.yaml` creates one free Node web service. Set `DATABASE_URL` to Supabase’s **shared
  session pooler** URI (port `5432`) with `sslmode=require`; keep `POSTGRES_MAX=1`.
- The build runs `npm ci --include=dev && npm run build && npm run db:migrate`. Render Free
  does not support `preDeployCommand` (paid services only); move the migrate command there
  if you upgrade. Set `NEXT_PUBLIC_SITE_URL` to the Render URL after the first deploy, then
  redeploy.
- Render Free sleeps after 15 minutes without traffic and runs one instance. Active live
  rooms are lost on sleep/restart; do not scale the service.
- Supabase Free has a 500 MB database, pauses after a week of inactivity and has no automated
  backups. Use it for a demo/small community, not ranked production.
- Full steps and smoke checks: [DEPLOY-RENDER-SUPABASE.md](DEPLOY-RENDER-SUPABASE.md).

## 20. Super-admin console

`/admin` accepts two credentials:

- `https://<host>/admin?token=$ADMIN_TOKEN` — the shared token, kept in the URL exactly like
  `/admin/balance`. The page forwards it as `x-admin-token` on every API call.
- A signed-in account whose `users.is_super_admin` is true — just open `/admin`. Such accounts
  also get an “Admin console” card on `/more`.

Grant the role once (the account must already exist from a magic-link sign-in):

```bash
npm run admin:promote -- you@example.com
npm run admin:promote -- you@example.com --revoke
```

The console can search players by display name, public slug or profile UUID; edit coins, eggs,
food, materials, legacy points and spectator points; generate pets (custom or random roll) with
species, rarity, nature, level, stars and IVs; edit any pet's stored stats plus raw stat
overrides; and gift any pet to another player. Gifting respects the 30-pet ranch cap and clears
team slot, market listing and expedition state.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/admin/players?q=` | GET | player search |
| `/api/admin/players/:id` | GET / PATCH | detail / wallet |
| `/api/admin/pets` | POST | generate a pet |
| `/api/admin/pets/:id` | PATCH | stored stats and overrides |
| `/api/admin/pets/:id/transfer` | POST | gift to another player |
| `/api/admin/species?q=` | GET | playable species picker |
| `/api/admin/audit` | GET | last 50 admin actions |

Admin API calls use `x-admin-token` or the session cookie and fail with the same masked 404 as
the other admin routes. Every mutation inserts an `admin_audit_log` row; the console renders the
latest entries at the bottom. With `ADMIN_TOKEN` unset and no flagged account, `/admin` is
unreachable.

Raw overrides are final values: `hpMax`, `atk`, `matk`, `def`, `mdef`, `aspdMs`, `critChance`,
`critMult` and `statusResist` replace the computed numbers after nature, stars, care and
evolution are applied, in both the roster view and battle combatants. Leave a field blank to
keep the derived value.
