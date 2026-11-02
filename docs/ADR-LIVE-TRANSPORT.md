# ADR: Live PvP transport

**Status:** accepted for the single-instance release; PartyKit/durable rooms are the planned
production replacement.

## Context

Live PvP needs an authoritative tick loop, low-latency snapshots, reconnect, inputs, a
delayed spectator feed and tournament integration. The rest of the game is a Next.js app
running against PGlite locally or Postgres in production.

## Decision

Ship live PvP with:

- an in-process `Map` of authoritative rooms in `src/lib/live/rooms.ts`;
- the existing deterministic `BattleEngine` at 50 ms ticks;
- SSE for snapshot/event delivery (`/api/pvp/live/:id/stream`);
- HTTP inputs (`/api/pvp/live/:id/input`);
- HMAC player/spectator tickets (`LIVE_TOKEN_SECRET`);
- a five-second delayed spectator send;
- a canonical replay of the combined `{t,kind,index,side}` log on completion.

The room and ticket modules are deliberately isolated. A PartyKit or Cloudflare Durable
Objects implementation can own the same tick, input and snapshot contract.

## Consequences

- The feature runs end to end locally with no external realtime vendor.
- Active rooms do not survive a process restart; the deployment must run one instance.
- Serverless/multi-instance deployment must move the room loop before enabling live PvP.
- Spectator delay is a simple anti-cheat measure, not hidden-information filtering.
- The canonical replay keeps live battles shareable and verifiable.

## Follow-up

1. Move `LiveRoom` to a durable room provider.
2. Persist room state and allow reconnect across deploys.
3. Add load tests for concurrent rooms and queue pairing.
4. Add Playwright coverage for queue → live arena → spectator.
