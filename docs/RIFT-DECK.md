# Rift Deck

Rift Deck is TamaRagna's three-act roguelike card side game. It is inspired by the
turn-based, three-champion energy combat of Axie Infinity and the branching run/deck/relic
loop of Slay the Spire, but it uses original names, rules and content. It does not copy
Axie/Slay-the-Spire code, art, card names or assets.

## Access

- Primary nav: **Cards** (`/cards`).
- Secondary link: **More → Rift Deck**.
- Team and Ranch show a Rift Deck shortcut when three team pets are ready.

## Run setup

- Requires exactly three team pets (`pets.slot` 1–3). A different team size returns 422.
- The three pets become champions; their four equipped skills make a **12-card starter deck**.
- The run snapshots level, IVs, nature, stars, evolution, mastery and team synergy at start.
- Editing a pet during a run does not alter that run's snapshot.
- Deck max: 40 cards. Cards are bound to their champion; if a champion dies, its cards are
  exhausted.

## Combat

- Turn-based, three champions vs. one to three enemies.
- Start with 5 cards and 3 energy. Draw 5 at the start of each turn; hand cap 10.
- Play cards, spend energy, then end turn. Enemy intents are visible.
- Block is per champion and clears at the start of the player's turn.
- Statuses: poison, stun, slow, haste, atkUp, defUp, defDown, shield, weak, vulnerable, frail.
- The fight is lost when all champions are down. A wipe ends the run.

## Map and activities

- Three acts: Verdant Rift, Ember Rift, Astral Rift.
- 10–12 floors per act; 1–3 nodes per floor; boss at the end of each act.
- Node types: battle, elite, event, rest, shop, treasure, boss.
- Rest: heal 30% or upgrade a card.
- Shop: cards, one relic, card removal, paid with run gold.
- Events: six original events with risk/reward choices.
- Relics: 18 passive relics with combat, element, draw, rest/shop and healing effects.
- Run gold is separate from main coins. Main rewards are granted only when the run ends.

## Content

- **80 cards**: all 64 curated species skills converted into skill cards, plus 16 original
  neutral cards.
- **18 relics**, **12 normal encounter kits**, **6 elite kits**, **3 bosses**.
- Original boss names (Rootbound Colossus, Cinder Regent, Null Archon); existing species
  sprites and skill icons are reused.
- No new art is authored for this mode.

## Server authority

Card mode is PvE only. The server owns the run map, deck, relics, champions and battle state.

- `GET /api/cards` — hub and leaderboard.
- `POST /api/cards/runs` — start/resume.
- `GET /api/cards/runs/[id]` — run view.
- `POST /api/cards/runs/[id]/enter` — enter a reachable node.
- `POST /api/cards/runs/[id]/reward` — card/relic/skip.
- `POST /api/cards/runs/[id]/rest|shop|event` — resolve non-combat nodes.
- `POST /api/cards/runs/[id]/abandon`.
- `GET /api/cards/leaderboard`.
- `GET /api/cards/battles/[id]`.
- `POST /api/cards/battles/[id]/action` — play a card or end turn.

Every battle action increments a version, is applied inside a transaction, and rejects stale
versions. The client receives state, not the run seed or future draw pile. Reloading a battle
resumes the exact server state.

## Persistence

- `card_runs` — seed, status, act/node, map, deck, relics, champions, run gold, pending
  reward, score, season, reward ledger and timestamps.
- `card_battles` — run/node, seed, current server state, action log, result/checksum, version
  and status.
- Schema migration: `0009_card_crusade`.
- One active run per profile via a partial unique index.

## Rewards

- Win: 450 coins, 8 materials, 1 egg, 120 EXP per squad pet.
- Loss: 120 coins, 3 materials, 40 EXP per squad pet.
- Abandon: no main rewards.
- Daily cap: 1,350 coins, 24 materials, 1 egg.
- Rewards are granted once through `rewarded_at`, in a transaction.
- Card quests: daily **Rift skirmish** (1 battle win); weekly **Rift delver** (10 rooms) and
  **Rift conqueror** (complete one run).

## Feature flag and verification

- `FEATURE_CARDS=0` disables the API with 404.
- Unit tests: `src/lib/cards/engine.test.ts`.
- End-to-end manual/HTTP flow: start → enter battle → play actions → claim reward → rest/shop/
  event → boss → act transition → terminal result.
- Health: `GET /api/health` should report `0009_card_crusade`.
