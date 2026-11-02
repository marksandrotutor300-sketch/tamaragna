# Notice & attribution

TamaRagna is a **non-commercial fan project**. It is not affiliated with, endorsed by, or
sponsored by Gravity Co., Ltd.

## Ragnarok Online

All Ragnarok Online related media and content are copyrighted © by **Gravity Co., Ltd.**
and **Lee Myoungjin (studio DTDS)**, all rights reserved.

This repository **does not contain or redistribute any Ragnarok Online artwork, sprites,
icons, maps, audio or other game assets**. Sprites, skill icons and map images are
requested at runtime from public community services through a caching proxy:

- `https://assets.latam-tools.com.br` — community sprite renderer
- `https://static.divine-pride.net` — community database CDN
- `https://www.divine-pride.net` — community database map images

The repository contains only code, plus game *data* (monster statistics, spawn tables,
element relationships) derived from rAthena, which is itself a community project.

If you run this publicly, you are responsible for how the assets are served in your
jurisdiction. The project is deliberately built so the art can be removed or redirected:

- `ASSET_PROVIDER=divine-pride` switches to static stills.
- `ASSET_PROVIDER=zrenderer` + `ZRENDERER_URL` points at your own
  [zrenderer](https://github.com/zhad3/zrenderer) instance rendering from a client you
  extracted yourself.
- Deleting `src/app/api/sprite`, `src/app/api/icon`, `src/app/api/map` removes all
  proxying; the UI degrades to placeholder tiles.

The game data pipeline reads rAthena from a pinned commit at build time.
See `scripts/rathena.pin.ts`.

## rAthena

Game data is derived from **rAthena** (<https://github.com/rathena/rathena>),
Copyright (C) rAthena Development Team, licensed under the
**GNU General Public License v3.0** (<https://www.gnu.org/licenses/gpl-3.0.html>).

- The pinned revision is `d4b8e7b8f16061cc2496d377ac8f777ce72a4f39`.
- `scripts/fetch-rathena.ts` downloads the required `db/re/**` and `npc/re/mobs/**` files.
- `scripts/build-bestiary.ts` derives `data/generated/*.json` from them.
- The generated data directory is **not committed**; it is rebuilt from the pinned source
  by `npm run data:build`.

If you redistribute generated data, comply with the GPL-3.0: retain the rAthena
attribution and make the corresponding source available.

## Fonts and UI

UI fonts are served by Google Fonts (Inter, Outfit) under the SIL Open Font License.
Icons are from [Lucide](https://lucide.dev), ISC licensed.

The PWA app icon is rendered from the Lucide `sparkles` glyph (ISC) by
`scripts/generate-icons.ts`. The generated PNGs contain no Ragnarok Online artwork.

## Code license

The original source code in this repository is provided for personal, non-commercial
use. Third-party dependencies retain their own licenses.
