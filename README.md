# Dinkup

**Find a pickleball game in Cebu.** A PWA for finding opponents, posting games at local courts, and leveling up through confirmed wins.

Built as a vibe-coding portfolio project. See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and [`docs/log/`](docs/log/) for the step-by-step build log (prompts, what the AI got right, what had to be fixed).

## Stack

React + Vite + React Router · Express 5 · PostgreSQL + Prisma 7 · Zod (shared between client and server) · TypeScript · npm workspaces

```
client/   React app (Vite)
server/   Express API + Prisma
shared/   Zod schemas and constants used by both
docs/     plan + build log
```

## Running locally

Requires Node 22+ and Docker.

```bash
npm install
cp server/.env.example server/.env   # then set SESSION_SECRET
npm run db:up                         # Postgres on :5432 (creates dinkup + dinkup_test)
npm run db:migrate --workspace server
npm run dev                           # API on :3000, app on http://localhost:5173
```

The Vite dev server proxies `/api` to Express, so the app and API share one origin in development and production.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (tsx watch) + client (Vite) |
| `npm test` | API tests (Vitest + Supertest) against `dinkup_test` |
| `npm run typecheck` | Typecheck all workspaces |
| `npm run build` | Build client, then bundle server |
| `npm start` | Run the production server (serves the built client) |

## Security notes

- Sessions are stored in Postgres (`connect-pg-simple`), in an `httpOnly`, `SameSite=Lax` cookie that's `Secure` in production. The session ID is regenerated on login to prevent session fixation.
- Passwords are hashed with bcrypt (12 rounds). A wrong password and an unknown email take the same time and return the same error.
- Auth routes are rate-limited. Write requests must be JSON, which blocks cross-site form posts as a second layer of CSRF protection on top of `SameSite`.
- All input is validated with Zod on the server. The client runs the same schemas for instant feedback.
