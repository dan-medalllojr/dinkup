# Dinkup

**Find a pickleball game in Cebu.** Live at **https://dinkup.onrender.com**

A PWA for finding opponents, posting games at local courts, and leveling up through confirmed wins.

Built as a vibe-coding portfolio project. See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and [`docs/log/`](docs/log/) for the step-by-step build log (prompts, what the AI got right, what had to be fixed).

## Stack

React + Vite + React Router · Express 5 · PostgreSQL (Neon) + Prisma 7 · Zod (shared between client and server) · MapLibre GL + OpenFreeMap · TypeScript · npm workspaces

```
client/   React app (Vite)
server/   Express API + Prisma
shared/   Zod schemas and constants used by both
docs/     plan + build log
```

## Running locally

Requires Node 22+ and a free [Neon](https://neon.com) Postgres project.

```bash
npm install
cp server/.env.example server/.env    # fill in the Neon URLs and SESSION_SECRET
npm run db:deploy --workspace server  # create tables
npm run db:seed --workspace server    # real Cebu courts
npm run dev                           # API on :3000, app on http://localhost:5173
```

`server/.env` needs three connection strings from Neon:

| Variable | Which Neon string | Used by |
|---|---|---|
| `DATABASE_URL` | Pooled (host contains `-pooler`) | The running app |
| `DIRECT_URL` | Direct | Prisma CLI: migrations, Studio |
| `TEST_DATABASE_URL` | Direct, to a separate `dinkup_test` database | Tests (must end in `_test`; they wipe every table) |

The Vite dev server proxies `/api` to Express, so the app and API share one origin in development and production.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (tsx watch) + client (Vite) |
| `npm run db:deploy --workspace server` | Apply migrations without prompts (Neon / production) |
| `npm run db:seed --workspace server` | Upsert courts from `server/prisma/data/courts.ts` (safe to re-run) |
| `npm test` | API tests (Vitest + Supertest) against the `dinkup_test` database |
| `npm run typecheck` | Typecheck all workspaces |
| `npm run build` | Build client, then bundle server |
| `npm start` | Run the production server (serves the built client) |

## Maps and place search

Everything here is free with no API keys:

| What | Service | Notes |
|---|---|---|
| Map engine | [MapLibre GL](https://maplibre.org) | Runs in the browser (WebGL). Lazy-loaded on map pages only and cached on first use. |
| Map tiles and styles | [OpenFreeMap](https://openfreemap.org) | **Liberty** (light), **Fiord** (dark). No key, no request limits. |
| Search as you type | [Photon](https://photon.komoot.io) | Via `/api/geo/search`, limited to Cebu, 24 h cache. |
| Address for a dropped pin | [Nominatim](https://nominatim.org) | Via `/api/geo/reverse`, 1 request/second per its usage policy. |
| Pasted Google Maps links | Parsed on the server | Via `/api/geo/link`. Short links are followed only within Google Maps domains (SSRF guard). No Google API is called. |

Courts can be added by players (public, labeled "Added by …"). See [`docs/log/change-1-maps.md`](docs/log/change-1-maps.md) and [`docs/log/change-2-maplibre.md`](docs/log/change-2-maplibre.md), including why the Google Places API wasn't used: its data may only be shown on a Google map, and its coordinates can be kept for only 30 days.

## Deploying (Render + Neon)

Two Neon branches keep real data away from development:

| Neon branch | Used by |
|---|---|
| `production` | The live site on Render |
| `dev` | Local development (`server/.env`) and tests (its `dinkup_test` database) |

The app is deployed to Render with the Blueprint in [`render.yaml`](render.yaml): one free web service in Singapore, the same region as the database. On every push to `main`, Render installs, builds, runs migrations, runs the idempotent seed (courts + demo data), and starts Express. Express serves both the API and the built app on one HTTPS domain.

Set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) for the `production` branch in the Render dashboard. Render generates `SESSION_SECRET`.

Free-tier note: the Render service and the Neon database both sleep when idle, so the first visit after a quiet spell takes a little longer.

## Demo mode

With `DEMO_MODE=true` (the default), the server keeps a rolling week of demo games hosted by a fake cast. It fills them in on startup and every hour, and clears out old ones. **Try the demo** on the home and login pages logs a visitor into a fresh throwaway account, deleted after 24 hours. Demo games and players are always labeled "Demo" so real players never travel to a court for a game that doesn't exist. Set `DEMO_MODE=false` to turn all of this off.

## Security notes

- Sessions are stored in Postgres (`connect-pg-simple`), in an `httpOnly`, `SameSite=Lax` cookie that's `Secure` in production. The session ID is regenerated on login to prevent session fixation.
- Passwords are hashed with bcrypt (12 rounds). A wrong password and an unknown email take the same time and return the same error.
- Auth routes are rate-limited. Write requests must be JSON, which blocks cross-site form posts as a second layer of CSRF protection on top of `SameSite`.
- All input is validated with Zod on the server. The client runs the same schemas for instant feedback.
