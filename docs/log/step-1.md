# Step 1 — Setup + auth

**Date:** 2026-09-30

## Prompt

> check this project plan … write the changes and start

The AI first reviewed the plan and suggested changes: guest browsing plus demo data for recruiters, a join table for match results, capacity and concurrency rules, a fixed timezone, lazy expiry, a clearer guard #4, and TypeScript with shared Zod schemas. It folded these into `docs/PLAN.md`, then scaffolded step 1.

## What was built

- npm workspaces monorepo: `client/`, `server/`, `shared/`
- Docker Compose Postgres 17, which creates both `dinkup` and `dinkup_test`
- Prisma 7 schema: `users` and `session`. The session table is owned by the Prisma migrations, so `migrate dev` doesn't report the store's table as drift.
- Express 5 API:
  - `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
  - `PATCH /api/users/me`, `GET /api/users/:id` (public profile, no email)
- React client: register, login, profile (edit name, level, format; points bar), public player page, 404
- 17 API tests (Vitest + Supertest) against a real test database

## Decisions worth explaining in an interview

- **Sessions over JWT.** One domain, so a cookie session is simpler and can be revoked by deleting a row. JWTs can't be revoked without extra machinery.
- **`session.regenerate()` on login and register** to prevent session fixation.
- **Dummy bcrypt compare** when the email doesn't exist, so response timing doesn't reveal which emails have accounts.
- **Relying on the unique index for duplicate emails** (catching Prisma `P2002`) instead of checking first and then inserting, which has a race.
- **`GET /me` returns `{ user: null }` for guests**, not 401, because browsing is public and guests shouldn't see console errors.
- **Prisma enums can't contain dots**, so skill levels are `L3_0`… in the Prisma schema with `@map("3.0")`, and a small mapping layer converts them at the API boundary.
- **`PATCH /users/me` uses a `.strict()` schema**, so `skillPoints` or `email` in the body is rejected with a 400 instead of silently ignored.

## What had to be fixed

- **Email normalization order (caught by a test).** `z.email().trim().toLowerCase()` validates *before* trimming, so `"  ANA@Example.com "` failed as an invalid email instead of matching the existing account. Fix: `z.string().trim().toLowerCase().pipe(z.email())`. The test `normalises email so case differences are the same account` caught it.
- **JSON-only guard vs. body-less POSTs.** `req.is('application/json')` returns `null` when a request has no body, which would have blocked logout. Switched to checking the `Content-Type` header directly.
- **Prisma CLI `latest` tag pointed at an 8.0 release candidate.** Pinned `prisma` and `@prisma/client` to 7.10.0 stable.

## Known follow-ups

- The client bundle is about 400 KB, mostly Zod. Consider `zod/mini` on the client, or lazy-loading routes, during PWA polish.
- `npm audit` flags issues in the Prisma CLI's own dependencies (dev-only, not shipped) and an esbuild dev-server issue that only affects Windows.
- Self-editing skill level gets locked in step 10 (see the plan).
