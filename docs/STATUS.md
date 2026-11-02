# Status

**Version:** 0.1.0
**Last updated:** 2026-10-31
**State:** playable end to end, production build green.

TamaRagna is a complete vertical slice of the game described in the original plan: pets,
rarity/IVs, care, a deterministic ATB battle engine, the endless tower, async PvP, the
bestiary, and the asset pipeline. It is feature-complete for v0.1.0 and ready to run, but
it is **not** hardened for adversarial scale — see [Known limitations](#known-limitations).

---

## Feature status

| Area | Status | Notes |
| --- | --- | --- |
| Bestiary data pipeline | ✅ Done | rAthena pinned at `d4b8e7b8f160`; 2,675 parsed, 867 playable, 64 skills |
| Sprite / icon / map proxy | ✅ Done | `ragassets` default, `divine-pride` fallback, `zrenderer` opt-in |
| Anonymous accounts | ✅ Done | httpOnly device cookie, cloud save in Postgres/PGlite |
| Hatching | ✅ Done | Wild and Focused eggs, species weighting, rarity + IV roll |
| Pet roster | ✅ Done | 3 team slots + storage, rename, bench/assign |
| Tamagotchi care | ✅ Done | Hunger/mood/energy/friendship, lazy decay, sleep, feed/play/train |
| Rarity & individual values | ✅ Done | 5 tiers, 6 IVs, rarity floor + multiplier + skill levels |
| Natures | ✅ Done | 8 natures, ±10% stats, rolled at hatch and inherited |
| Awakening | ✅ Done | 1–5★ duplicate fusion, +4% stats per star |
| Breeding | ✅ Done | Level 10+, 2 eggs + 250 coins, IV/nature/rarity inheritance |
| Team synergies | ✅ Done | Element focus, race bond, mixed company |
| Status resistance | ✅ Done | Derived from VIT/LUK; reduces enemy status chance |
| Daily/weekly quests + login streak | ✅ Done | UTC resets, idempotent claims, 4 daily + 3 weekly |
| Seasons, placements, rewards | ✅ Done | K=40 placements, tiers, roll script, claim UI |
| Featured species | ✅ Done | 3 per UTC day, 3× weight in Wild Eggs |
| Tower draft + elite affixes | ✅ Done | 3-of-5 blessings between waves; 1–2 affixes on elite/boss waves |
| Six-skill kits / 4-of-6 loadouts | ✅ Done | Six per species, four equipped per pet, validated on save |
| Nature reroll | ✅ Done | 300 coins; always lands on a different nature |
| ATB battle engine | ✅ Done | 50 ms ticks, 180 s cap, casts, statuses, swaps, AoE |
| Deterministic replay + verification | ✅ Done | Same engine client/server, FNV-1a checksum |
| Auto & manual control | ✅ Done | Toggle on Tower and Arena; manual input log recorded and replayed |
| Endless Tower | ✅ Done | Scaled waves, MVP every 10, HP carry-over, persisted runs |
| Tower leaderboard | ✅ Done | Highest wave, time tie-break |
| Async PvP | ✅ Done | Ghost teams, rating matchmaking, Elo, history |
| PvP snapshot freshness | ✅ Done | Refreshes on team edits, training, hatching and battle results |
| Bestiary browser | ✅ Done | Search, tier/element filters, pagination, detail pages, practice battles |
| One-click launcher | ✅ Done | `Play TamaRagna.cmd`, `play.sh` |
| Installable PWA / offline | ✅ Done | Serwist + Turbopack; manifest, icons, precached shell, offline fallback |
| Account transfer | ✅ Done | 10-char single-use code, 15 min TTL, hashed, moves the device cookie |
| Save export / import | ✅ Done | JSON download; import only into a fresh ranch |
| Shareable replays | ✅ Done | Unlisted tokens, deterministic replay theater, OG cards, revoke |
| Public trainer cards | ✅ Done | Opt-in slug, top three pets, rating/season, OG |
| Defense log + revenge | ✅ Done | Attacks against your ghost team, replay links, rematch |
| SSR bestiary + SEO | ✅ Done | Per-species metadata/JSON-LD, sitemap, robots, public cards |
| Migrations + feature flags | ✅ Done | `schema_migrations`, additive runner, actor seam, payload version |
| Accounts + sessions | ✅ Done | Magic links, revocable sessions, linked ranch, account deletion |
| Push + Background Sync | ✅ Done | VAPID subscription, cron reminders, care outbox with idempotency |
| Telemetry + balance | ✅ Done | Battle events, daily aggregates, outlier report, `/admin/balance` |
| Evolution + mastery | ✅ Done | 24 families / 48 edges, stage multipliers, lineage, 5 mastery levels |
| Live PvP + spectating | ✅ Done | Authoritative rooms, SSE, reconnect, delayed spectator feed |
| Tournaments | ✅ Done | Join, bracket generation, live match linking, automatic advancement |
| Guilds + co-op raids | ✅ Done | Guild roster, weekly 60k HP boss, server-resolved attacks, contribution board |
| Auction house | ✅ Done | Storage-pet fixed-price listings, 5% fee, buyout/cancel, pet locking |
| Expeditions | ✅ Done | Three timed routes, 1–3 storage pets, level/friendship rewards |
| Habitats + visits | ✅ Done | Four themes, material costs, public ranch visits and visit counts |
| Ranked circuit + picks | ✅ Done | Ladder, admin cups linked to tournaments, spectator winner picks |
| Legacy + ghost dojo | ✅ Done | Retirement marks/IV inheritance and team/last-opponent ghost sparring |
| Super-admin console | ✅ Done | Player search, wallet, pet create/edit/transfer, stat overrides, audit log |
| Render + Supabase config | ✅ Done | `render.yaml`, pooler-safe DB pool, free deployment guide |
| Security headers + CSRF | ✅ Done | CSP, nosniff, frame deny, referrer, permissions; Origin check on API mutations |
| Rate limits | ✅ Done | DB-backed fixed windows on hatch, care, matchmaking, claims and transfers |
| Health + E2E + load test | ✅ Done | `/api/health` + schema version; Playwright 7/7; p95 15–31 ms |
| Mobile layout | ✅ Done | Checked at 390 × 844; bottom nav, stacked cards |

## Data snapshot

| Metric | Value |
| --- | --- |
| Species parsed from rAthena | 2,675 |
| Playable species | 867 |
| Playable by tier (1→5) | 139 / 154 / 160 / 219 / 195 |
| Playable MVPs | 189 |
| Playable bosses | 281 |
| Playable with spawn maps | 730 |
| Curated combat skills | 64 |
| Skills per species | 6 (4 offensive + 2 support) |
| Tier cutoffs (level percentiles) | p25 = 59, p50 = 99, p75 = 128, p95 = 182 |
| rAthena revision | `d4b8e7b8f16061cc2496d377ac8f777ce72a4f39` |

The remaining 1,808 parsed monsters are excluded from play: test dummies, champion
variants (`C1_`, `S_`), scripted structures, and instance-only mobs with no spawn data and
no MVP flag. They remain available to the bestiary API by ID but cannot be hatched or
encountered in the tower.

## Verification

### Automated

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npx vitest run` | 75/75 passing |
| `npm run data:validate` | all checks passing |
| `npm run build` | compiled successfully; all static pages generated |
| PWA worker | `/serwist/sw.js` prerendered at build; 53 precache entries (~1.28 MB) |
| Client JS budget | 1.03 MB total, largest chunk 224 KB |

The tests cover:

- Identical seed + inputs produce identical checksums; different seeds diverge.
- A recorded manual input log replays to the same checksum on the server.
- A tampered result hash is rejected.
- RO element chart values (Water → Fire 1.5 raw; 1.275 after battle compression).
- Timeout awards the healthier team.
- A faint forces a swap; HP never goes negative.
- IV floors hold for every rarity across 500 rolls each.
- Hatch weight tables sum to 100; tier 5 never rolls below Rare.
- Offline care decay caps at 36 hours; sleeping restores energy.
- The EXP curve levels up and caps at 50.
- Loadouts always resolve to four unique available skills; invalid or duplicate selections
  fall back to the default.
- Nature reroll never returns the current nature.
- Share tokens/slugs reject malformed values; balance aggregation counts species/win/skill
  dimensions; evolution branches resolve; mastery thresholds/power scale; live tickets reject
  tampering.
- Expedition reward scaling and route lookup, habitat fallback, and legacy IV/trait rules.
- CSRF origin checks accept Render's forwarded host while still rejecting foreign origins.

### End-to-end (`npm run smoke`)

Profile → hatch → practice battle → deterministic replay → auto submission **200** →
recorded manual battle → manual submission **200** → tampered submission **400** →
tower start → tower submission **200** → next wave **200** → leaderboard **200** →
bestiary search **200**.

### PvP (`npm run smoke:pvp`)

Two isolated sessions: B registers a snapshot (first match returns 404 only when the table
is empty), A matches a nearby opponent, the battle is fetched, replayed and accepted, A's
rating moves by the Elo delta, history shows the result, and a duplicate submission returns
**409**.

### PWA (`/serwist/sw.js`)

- The production build prerenders `/serwist/sw.js` and `/serwist/sw.js.map` (shown as `●`
  in the route table), so the worker is never compiled per request.
- 34 entries (~1.07 MB) are precached, including `/offline`, the icon set and every app
  chunk.
- Chrome reports the worker controlling `/ranch`, the manifest linked at
  `/manifest.webmanifest`, and standalone display with three icons.
- Cache inspection: `/api/sprite/1002` lands in `tamaragna-ro-assets`; `/api/me` is never
  cached. Game state is network-only by design.
- With the **server stopped**, navigating to an uncached `/team` renders the precached
  "You're offline" page.

### Genetics (API)

- Hatch returned a rolled nature and `star: 1` (e.g. Jolly Hellhound).
- Seeded two level-20 Hellhounds: breeding produced a rarity-3 child with inherited 10/20
  IVs and an inherited Adamant nature, for 2 eggs + 250 coins.
- Awakening consumed the duplicate, raised the target to 2★, and charged 150 coins.
- A two-pet same-species team produced +5% ATK/MATK and +8% DEF/MDEF in the practice payload
  relative to the roster view.
- The duplicate row was deleted and the transaction left coins/eggs consistent.
- Tower wave 1 remained clearable after forcing Hardy/zero-IV enemies on waves 1–4.
- A pet exposed six `availableSkills` and four equipped `skills`; a valid loadout PATCH
  persisted and the practice payload used exactly those four IDs. An invalid/unknown
  loadout returned **400**.
- A nature reroll changed the nature (`modest → hardy`) and charged 300 coins.

### Season 1 (API)

- Quests: three feeds completed the care quest (3/3); claiming paid 60 coins. The login claim
  paid 60, and a hatch completed and paid the 50-coin hatch quest. Coins moved 1300 → 1410.
- Featured rotation returned three deterministic species (Golem, Kapha, Alice for the test
  date) and the hatch route applied 3× Wild Egg weight.
- A season roll wrote reward rows for every profile; claiming returned 300 coins and marked
  all rows claimed. New profiles joined the latest season instead of defaulting to 1.
- A seeded wave-2 draft offered Alacrity/Fury/Bulwark. Choosing Alacrity changed the team's
  ASPD from 566 to 509 and stored `{ wave: 2, id: "alacrity" }`; the next draft reported
  `pending: true`.
- A provisional PvP loss moved rating by −20, matching K=40.
- `smoke` and `smoke:pvp` pass on the final build.

### Launch readiness

- Security headers on `/`: CSP present with `script-src 'self' 'unsafe-inline'` and no
  `unsafe-eval` in production; `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`; no HSTS on localhost.
- Cross-origin `POST /api/hatch` returned **403 Invalid origin**; a same-origin request
  reached the route.
- Hatch rate limit: statuses `[200, 400, 400, 429]` for four rapid requests.
- Transfer: A created and hatched a pet, generated a code, and B redeemed it; B ended with
  1 pet, A's old cookie saw 0, and reusing the code returned **400**.
- Export/import: B's save exported 1 pet / 500 coins; a fresh profile imported it and ended
  with 1 pet / 500 coins; importing into a non-empty profile returned **400**.
- `/api/health` returned **200** with the rAthena SHA, generation timestamp and 2,675 species.
- Playwright: **7/7** tests passed (landing/bestiary, hatch → reveal → ranch, quests,
  account/transfer, public trainer card, share → replay → revoke, and the seven upgrade hub
  pages).
- Load test: 600 requests, 0 errors; p50 10–22 ms, p95 15–31 ms.
- `smoke` and `smoke:pvp` pass; provisional PvP again moved rating by 20 (K=40).

### M0/M1 share and replay

- `npm run db:status` applied `0001_share_replay`; a second run reported it applied, proving
  the migration is idempotent. `/api/health` returned `schemaVersion: "0001_share_replay"`.
- Practice battle → share token → public replay API/page → OG returned **200 image/png**
  (172 KB).
- Trainer card opt-in → public API/page/OG returned **200 image/png** (82 KB).
- Bestiary `/bestiary/1002` included JSON-LD and Poring metadata; `sitemap.xml` included the
  species URL; `robots.txt` disallowed `/replay/`.
- Fresh database: A created a snapshot, B matched and submitted, A's defense log returned
  **1** attack, and A's revenge created a new battle **200**.
- Revoking a share made the replay return **404**; the battle replay also refuses a
  checksum mismatch.
- OG images use the public static sprite URL because Satori's SSRF protection rejects
  localhost image URLs.

### M2–M6 program

- `/api/health` reports `schemaVersion: "0007_super_admin"` on a fresh database.
- Accounts: magic-link sign-in linked the existing device ranch (`linked profile: true`);
  `/api/auth/session` returned the email; push subscription stored; cron returned
  `configured: false` without VAPID keys.
- Evolution: dev boost set a Poring to Lv 50 / 2★; options returned **2**; evolve changed it
  to Poporing **stage 2**; `/api/me` returned mastery data.
- Care idempotency: the same `Idempotency-Key` twice returned 200 both times and spent coins
  once (480 → 480).
- Live PvP: two profiles queued, paired, both SSE streams connected, the match completed with
  a winner, the battle row carried the result, share + replay returned **200**, and a
  spectator ticket was issued.
- Tournaments: admin create, four joins, bracket start returned **3** matches, and a bracket
  live match start returned a ticket.
- Telemetry: aggregate rebuilt **32** balance rows; `/admin/balance?token=…` returned **200**.
- Live replay initially failed because JSONB reordered input object keys; checksums now
  normalize `{t, kind, index, side}` before hashing.

### Seven post-M6 upgrades

Fresh-database verification passed every step:

- **Guilds:** create, membership, weekly raid create, raid attack with >0 damage, and a
  contribution row visible on the guild detail.
- **Market:** move a Lv 50 pet to storage, list at 300 coins, see it in the public board, buy
  it from a second profile; the buyer receives the Lv 50 pet.
- **Habitats/social:** buy Ember Hollow with materials, publish a trainer card, and visit the
  ranch from another profile.
- **Legacy:** retire the bought Lv 50 pet; a trait and legacy points are written.
- **Dojo:** train a ghost from the current team and win/lose a server-side spar with a stored
  battle.
- **Expeditions:** start a Verdant Trail party; an immediate claim is correctly rejected as
  still travelling.
- **Ranked:** admin-create an 8-player cup, eight joins, start the bracket, and see the cup
  in `/api/ranked`.
- **Spectator picks:** pair a live match and submit a spectator pick successfully.

Playwright now also renders `/more`, `/guild`, `/market`, `/expeditions`, `/ranked`,
`/legacy` and `/dojo` (7/7 total).

### Manual browser checks

Landing page, ranch (empty and populated), hatch reveal, team/storage, bestiary grid,
bestiary detail, tower, arena in auto mode, arena in manual mode (four skills pressed,
player victory, inputs verified by the server), arena page, and a 390 px mobile viewport.
The genetics screens were checked with a seeded profile: `/team` shows nature, stars,
status resist, the awakening hint, both active synergies, the six-skill loadout editor with
4/4 equipped, and the reroll control; `/breed` shows the inheritance rules, cost and the
level-10 gate. Season 1 screens were also checked: `/quests` shows the login streak, daily
and weekly claims; `/hatch` shows the three featured species; `/pvp` shows the current
season, placement progress and tier; `/tower` shows the active run with its blessing badge.
The account and transfer screens are covered by Playwright: transfer code creation, export
and import controls, and the `/transfer` entry page. The share flow was checked end to end:
finish a practice battle, click **Share replay**, open the replay theater, and copy the
unlisted link. The account screen also publishes a trainer card and opens `/trainer/[slug]`.
The arena defense panel lists an incoming attack and starts a revenge battle.

The M2–M6 flows were exercised through the HTTP/SSE verification run: magic-link login and
ranch linking, push subscription and cron auth, evolution from Poring to Poporing, mastery
reads, care idempotency, two-player live queue/SSE/finish, live share/replay, spectator
ticket, tournament create/join/bracket/match start, balance aggregation and the admin
dashboard. The live arena and tournament pages remain API/SSE verified; Playwright now
covers seven flows, including the new upgrade hub pages (see limitation 52).

## Deviations from the original plan

| Plan | Shipped | Why |
| --- | --- | --- |
| pnpm | npm | Corepack could not write to `Program Files`; npm is equivalent here |
| Supabase auth | Anonymous device cookie | Keeps async/cloud-save behavior with zero setup; no vendor needed |
| Supabase Postgres | Postgres in production, embedded PGlite in dev | Same schema and SQL; local run needs no Docker |
| Fixed tier level cutoffs | Level-percentile cutoffs | Renewal levels are skewed (median 100); fixed cutoffs put 69% of mobs in one tier |
| `mvp-scraper-cli` for data | rAthena only | The scraper covers ~50 MVPs, needs an API key, and has no sprite names; rAthena supersedes it |
| No migration tool | Additive SQL + `schema_migrations` | The existing idempotent DDL becomes the baseline; no destructive down-migrations are needed |
| OG images from the local proxy | Public static `divine-pride` URLs | Satori's SSRF protection rejects `localhost` image URLs, including the app's own proxy |
| PartyKit live rooms | In-memory SSE rooms + HMAC tickets | Keeps the whole live feature runnable locally; the durable transport is the next production step |
| 30–50 evolution families | 24 families / 48 edges | Keeps curation and validation tractable; the graph is data-driven and expandable |
| Email/push provider setup | Resend adapter + VAPID API, dev magic links | Avoids vendor credentials in the repo; production supplies keys |
| Admin dashboard login | `ADMIN_TOKEN` query parameter | Minimal operator surface; sessions/admin roles are future work |
| Guild raids as live rooms | Server-resolved auto battles | Delivers the social loop without a second realtime mode; interactive raids are a later step |
| Auction bids | Fixed-price buyout | Keeps escrow and the 5% fee simple; bids need more fraud tooling |
| Ranked scheduler | Admin-created cups | No external cron dependency; startsAt is currently informational |
| Supabase Realtime | Supabase Postgres only on Render | Current SSE rooms already work on one Render instance; Realtime is not a game loop |
| Render Free | Single sleeping instance | The only free option that runs the current SSE live code without a rewrite |

## Known limitations

1. **Replay verification is a consistency check, not prevention.** A client can pre-simulate
   an optimal input log and submit it. Server-issued seeds and a 2-second submission
   cooldown raise the cost; a competitive deployment would add per-tick input validation
   and anomaly review.
2. **PvP defense is a snapshot, not a live opponent.** Snapshots refresh on team edits,
   training, hatching and battle results, but not continuously. A defender can be attacked
   with a team they no longer field until their snapshot updates.
3. **Third-party asset hosts have no SLA.** The default animated source is a community
   server. The static `divine-pride` fallback and the self-hosted `zrenderer` path exist for
   this reason; a production deployment should run one of those or accept occasional
   missing sprites.
4. **Accounts are magic-link only.** There is no password or OAuth login, and email delivery
   needs `RESEND_API_KEY`/`EMAIL_FROM`. `AUTH_DEV_MODE=1` exposes the link for local tests.
   One account owns at most one ranch; two ranches are never merged automatically.
5. **Auto-battler determinism favors stat edges.** A small consistent advantage wins most
   fights; the seeded ±8% per-battle luck roll keeps upsets possible but does not make
   matchups even. Matchmaking stays rating-based.
6. **Tower balance is first-pass.** Waves scale from the team's level and were tuned so a
   fresh level-1 pet can clear the opening waves, but late-wave difficulty has not been
   explored beyond manual testing and the headless sweep.
7. **`profiles.food` is unused.** Feed costs coins; the column is reserved for a future
   food inventory.
8. **Season history is not browsable.** Past rewards appear as a flat list on the arena
   screen; there is no per-season archive or leaderboard snapshot.
9. **Matchmaking may repeat opponents.** There is no recent-opponent exclusion.
10. **First production build needs network access** to fetch the pinned rAthena snapshot.
11. **No audio.**
12. **Serverless sprite caching is per-region.** Next's fetch cache works, but a global
    CDN/Blob layer would be better at scale.
13. **Offline is a shell, not an offline game.** Care timers, the roster, battles and PvP
    need a connection; `/api/**` is deliberately network-only. The offline page explains
    this instead of showing stale state.
14. **The service worker is disabled in `next dev`.** Test installability and offline
    behavior against `npm run build && npm start`.
15. **`skipWaiting` + `clientsClaim` update the worker immediately.** A deploy can replace
    it mid-session; a tab holding old chunks may need one reload.
16. **Enemy AI uses the default loadout.** Wild/tower enemies and PvP ghost teams use the
    default four skills; only player-owned pets get situational loadouts.
17. **Loadouts are per pet.** There are no saved presets or copy-between-pets tools yet.
18. **Nature reroll is random.** It costs 300 coins and always changes, but the player
    cannot choose the result.
19. **Breeding is same-owner only.** There is no trading or cross-player breeding.
20. **Quests and seasons use UTC.** There is no player timezone selection; daily resets
    happen at midnight UTC and weekly resets on Monday UTC.
21. **Season rollover is manual.** `npm run season:roll` requires the server to be stopped
    and must be run once per season; there is no scheduler or admin UI.
22. **Season rewards are claimed manually.** There is no notification, and rewards only
    appear after a rollover has written them.
23. **Tower draft is skipped when a wave is already pending.** A generated battle cannot
    retroactively receive a blessing; the player must finish or abandon it first.
24. **Elite affixes are stat-only.** They do not add new behaviors or skills.
25. **Featured species apply to Wild Eggs only.** Focused Eggs use their element filter and
    normal weights.
26. **Transfer codes are shown once.** There is no email recovery; if the code is lost, a new
    one must be generated on the old device (or a save exported first).
27. **Save import is fresh-ranch only.** It resets rating and placements, and refuses a
    ranch that already has pets. The transfer code is the full-profile path.
28. **CSP allows `'unsafe-inline'` scripts/styles.** A nonce-based CSP would break static
    caching and is a separate hardening step.
29. **Rate limits are fixed-window and DB-backed.** Each protected action writes one row; a
    small race at the window boundary can allow one extra request.
30. **HSTS is opt-in.** It is only sent when `TAMARAGNA_HTTPS=1` or on Vercel, so the local
    production launcher on `http://localhost` keeps working.
31. **No error tracker or metrics yet.** `/api/health` and process logs are the current
    observability surface.
32. **Replay links do not expire.** They are unlisted and revocable; sharing the battle again
    revokes the previous link. There is no per-link TTL.
33. **Public trainer cards expose the display name, rating, season and top pets.** Pet
    nicknames are included. Changing the slug makes the old card URL 404; disabling the card
    removes it from the API and sitemap.
34. **OG images require outbound network access.** Satori cannot fetch `localhost`, so OG
    routes use the static `divine-pride` sprite URL rather than the local sprite proxy.
35. **Canonical and sitemap URLs need `NEXT_PUBLIC_SITE_URL` in production.** Without it,
    `siteUrl()` falls back to `http://localhost:3000`.
36. **Feature flags now default on for every shipped track.** Set `FEATURE_SHARE`,
    `FEATURE_TELEMETRY`, `FEATURE_ACCOUNTS`, `FEATURE_EVOLUTION` or `FEATURE_LIVE_PVP` to `0`
    to disable one. Flags are process-wide, not per-player experiments.
37. **Migrations are additive only.** There are no down migrations; back up Postgres before
    deploying and keep the DDL additive.
38. **Live rooms are in-memory and single-instance.** A restart drops active matches and their
    tickets. The SSE room service is not PartyKit or a durable object yet.
39. **Live matches start when the queue pairs.** A disconnected or slow player still consumes
    the three-minute match clock; reconnect works only within the same server process.
40. **Live matchmaking favors the closest rating.** It does not enforce a hard ±150 band or
    exclude recent opponents.
41. **Spectators see a five-second delayed feed.** The delay is the only anti-cheat measure;
    there is no hidden-information filter.
42. **Tournaments require a full bracket.** There is no check-in, byes, scheduling or
    automated match start. A participant starts each bracket match from the detail page.
43. **Tournament advancement is driven by live-room completion.** If the process restarts
    mid-match, the bracket match remains active until manually resolved.
44. **Push delivery was not exercised against a real push service.** VAPID subscription
    storage, cron auth and the worker handlers are in place; generating `VAPID_*` keys and an
    installed PWA are deployment steps. Background Sync is unavailable in Safari.
45. **Care idempotency stores JSONB.** Duplicate requests are semantically identical, but the
    response key order can differ after a round-trip through `jsonb`.
46. **Evolution is a curated 24-family/48-edge graph.** It preserves level, IVs, nature and
    star, costs level 50 + stars + coins, and carries 50% of matching skill XP. Most of the
    867 playable species are not in an evolution family yet.
47. **Lineage only exists for bred pets.** Hatch-only pets have no parents; the lineage API
    returns an empty list.
48. **Balance dashboard access uses `ADMIN_TOKEN` in the query string.** It is excluded from
    indexing but can appear in browser history and referrer logs.
49. **Telemetry retention is a manual script.** `npm run telemetry:prune` removes raw events
    older than 90 days; schedule it externally if needed.
50. **The dev boost endpoint requires `ADMIN_TOKEN`.** It can set pet level/star/species and
    profile coins for seeding. Do not ship an admin token you do not need.
51. **Replay checksums changed when input objects were normalized.** Replays created before
    that change may return 404 even though the battle row is intact.
52. **Browser coverage is now seven flows.** Playwright covers the original game, sharing,
    trainer cards, revoke and the seven new hub pages. The deeper live/tournament/upgrade
    interactions are exercised through the HTTP verification script.
53. **No Sentry/metrics or nonce CSP yet.** `/api/health`, structured logs and the admin
    dashboard are the observability surface.
54. **Guild raids are server-resolved auto battles.** They are not interactive co-op rooms,
    and there is no guild chat, invite flow or role-management UI beyond leader/officer checks.
55. **The auction house is fixed-price and pet-only.** There are no bids, item trades, price
    history or anti-RMT review tools; the 5% fee is the only sink.
56. **Expeditions cannot be cancelled.** Routes are fixed (15/60/180 minutes), parties are
    storage-only, and rewards are computed at departure.
57. **Habitats are cosmetic.** There are four themes and no decoration editor, biome bonuses
    or visitor mini-game; visits only pay coins and increment a counter.
58. **Ranked cups are admin-created and manually started.** `startsAt` is informational; there
    is no scheduler. Spectator picks settle only when the in-process live room finishes.
59. **Legacy removes the pet permanently.** There is no retirement hall, undo or trait
    selection; breeding spends the newest mark automatically.
60. **Ghosts are private and auto-resolved.** There is no public dojo ladder, ghost sharing,
    manual control or reward beyond the coins/battle record.
61. **Render Free is a demo host.** It runs one instance, sleeps after 15 minutes without
    traffic and loses in-memory live rooms on sleep/restart. Supabase Free pauses after a week
    of inactivity. Do not use this tier for ranked or high-traffic play.
62. **The Render/Supabase deployment is configured, not provisioned.** `render.yaml` and the
    guide are in the repo; creating the services, setting the pooler URI and assigning the
    public URL require your Render and Supabase accounts.

## Next steps

M0–M6 and the seven post-M6 upgrades are implemented. Remaining work is production
hardening and depth:

1. **Provision the free deployment** — create the Supabase project and Render Blueprint,
   set `DATABASE_URL`/`NEXT_PUBLIC_SITE_URL`, and run the smoke checks in the deployment
   guide.
2. **Durable live transport** — move rooms to PartyServer/Cloudflare Durable Objects so
   Render restarts do not drop matches.
3. **Social depth** — guild chat/invites/role management and interactive co-op raid rooms.
4. **Market integrity** — bids, price history, escrow audits, anti-RMT/dupe tooling.
5. **Expedition/habitat content** — route choices, cancellation, decor editor and visitor
   interactions.
6. **Scheduled circuit** — cron-created cups, check-in, byes and abandoned-match resolution.
7. **Legacy/dojo depth** — trait selection, retirement hall, public ghost ladder and
   interactive sparring.
8. **Observability** — Sentry/metrics, nonce CSP and a query-safe admin auth flow.
6. **More Playwright** — live queue/spectator and tournament browser flows.
7. **Guilds/co-op raids** — the next social endgame after live PvP.
8. **Loadout presets** — save and copy four-skill loadouts between pets.
