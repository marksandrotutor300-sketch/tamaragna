# Seven Upgrades

Post-M6 social, economy and long-term progression systems. All systems are
additive and use the existing profiles, pets, battles, tournaments and telemetry.

## 1. Guilds and co-op raids

- One guild per trainer, open join, up to 20 members. Founding costs 500 coins.
- Leaders/officers can open a weekly raid: a 60,000 HP boss with a seven-day
  window. There is one active raid per guild.
- Members attack with their current team. The server runs a real deterministic
  battle and converts the boss's missing HP into raid damage.
- Contributions track damage and attack count; the boss can be defeated by the
  guild. Attacks pay coins + materials; the defeat blow adds a larger bonus.
- Guilds have a tag, description, member roster and leader/officer roles.

## 2. Auction house

- Fixed-price pet listings only. Pets must be in storage and cannot be listed
  while on a team or expedition.
- Listing locks the pet (`pets.market_listed`). It cannot be assigned, bred,
  trained, evolved or fed while listed.
- Buyout checks the 30-pet ranch cap, moves the pet to the buyer's storage and
  pays the seller minus a 5% house fee.
- Sellers can cancel an active listing. Sold/cancelled rows remain as history,
  but only one active listing per pet is allowed.

## 3. Expeditions

| Route | Duration | Base coins | Materials | Egg | Minimum level |
| --- | --- | --- | --- | --- | --- |
| Verdant Trail | 15 min | 180 | 4 | — | 1 |
| Ember Pass | 60 min | 500 | 10 | — | 10 |
| Abyssal Rift | 180 min | 1,200 | 20 | 1 | 25 |

- Send 1–3 storage pets. They are locked from team/market/care actions while away.
- Rewards scale with pet levels and friendship, capped at +80%.
- Claim after the timer; claiming clears the lock and adds coins/eggs/materials.
- No cancel path yet; the party must return.

## 4. Ranch habitats and visits

- Four themes: Verdant Grove (free), Ember Hollow (120 materials), Tide Terrace
  (120), Astral Conservatory (250).
- The habitat is cosmetic and appears on the public trainer card.
- A visitor can visit a public trainer card once per action (rate-limited):
  host gets +10 coins, visitor gets +5. Visits are counted on the card.
- Requires an opt-in public trainer card and slug.

## 5. Ranked circuit and spectator picks

- `/ranked` shows the top 20 trainers by rating and scheduled cups.
- Admins create cups with `ADMIN_TOKEN`; a cup creates an 8-player tournament.
- Entrants join/start through the cup; the bracket is the existing tournament
  bracket and launches live matches from the bracket detail page.
- Spectators can pick the winner of an active live match. A correct pick pays
  10 spectator points when the room settles; players cannot pick their own match.
- Cup creation is manual/scheduled by `startsAt`; there is no cron scheduler yet.

## 6. Legacy

- Retire a level-50 pet (not listed, not away) to create a legacy mark.
- The trait is derived from the pet's element. Legacy points = 5 + star.
- Breeding with at least 10 legacy points spends them, gives the child +2 to
  every inherited IV (capped at 31) and attaches the newest mark as its legacy
  trait.
- The retired pet is removed from the ranch; the mark is permanent.

## 7. Ghost dojo

- Train up to 8 ghosts for 100 coins each from:
  - the current team, or
  - the most recent opponent's team from a completed battle.
- A ghost is a baked combatant snapshot with its own W/L record and difficulty.
- Sparring runs a server-side deterministic battle, stores a battle row and
  dojo run, awards coins (120 win / 35 loss), marks, telemetry and mastery.
- Ghosts are owner-only for now; public ghost sharing/dojo ladders are future work.

## API surface

| Method | Route | Purpose |
| --- | --- | --- |
| `GET/POST` | `/api/guilds` | List/found a guild |
| `GET/DELETE` | `/api/guilds/:id` | Detail / disband (leader) |
| `POST` | `/api/guilds/:id/join` / `leave` | Membership |
| `POST` | `/api/guilds/:id/raid` / `raid/attack` | Open/attack raid |
| `GET/POST` | `/api/market` | Browse/list a pet |
| `DELETE` | `/api/market/:id` | Cancel listing |
| `POST` | `/api/market/:id/buy` | Buyout |
| `GET/POST` | `/api/expeditions` | Routes/start |
| `POST` | `/api/expeditions/:id/claim` | Claim rewards |
| `PATCH` | `/api/account/habitat` | Buy/select habitat |
| `POST` | `/api/ranch/:slug/visit` | Visit a public ranch |
| `GET` | `/api/ranked` | Ladder and cups |
| `POST` | `/api/ranked/cups` | Admin create cup |
| `POST` | `/api/ranked/cups/:id/join` / `start` | Enter/start cup |
| `GET/POST` | `/api/pvp/live/:id/pick` | Spectator crowd pick/settle input |
| `GET` | `/api/legacy` | Marks and eligible pets |
| `POST` | `/api/pets/:id/retire` | Create a legacy mark |
| `GET/POST` | `/api/dojo/ghosts` | List/train ghosts |
| `POST` | `/api/dojo/ghosts/:id/spar` | Auto spar |

## Limitations

- Guild raids are server-resolved auto battles, not interactive co-op rooms.
- The market is fixed-price, pet-only and not an anti-RMT audit system.
- Expeditions and habitat visits have no cancel/decor editor yet.
- Ranked cups are admin-created and manually started; there is no scheduler.
- Spectator picks settle only for live rooms that finish in-process.
- Legacy removes the retired pet; there is no retirement hall/undo.
- Ghosts are private; no public dojo ladder or spectator runs yet.
- Render Free runs one instance and can spin down; Supabase Free pauses after
  inactivity. See `DEPLOY-RENDER-SUPABASE.md`.
