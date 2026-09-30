# Dinkup — Project Plan

**Find a pickleball game in Cebu.**

A vibe-coded portfolio project: a PWA for finding pickleball opponents, posting games with a location and time, and leveling up through confirmed wins.

Repo name: `dinkup`

## Goal

Build a real, deployed app to present when applying for vibe coder roles. The app matters, but so does the story of how it was built with AI: the prompts, the iterations, and where manual fixes were needed.

## Positioning

Apps like this already exist (e.g. Pickleheads), so the differentiator is a **local focus on Cebu**. Seed the app with real Cebu courts so it doesn't look empty when a recruiter opens it.

### First impression for recruiters

- **Guests can browse.** Games, courts, and game pages are readable without an account. Only posting, joining, commenting, and reporting results require login.
- **Demo data is always fresh.** A seed script creates demo users and upcoming games relative to "now", so the list is never empty or stale. Re-run on each deploy (or on a schedule). Demo users are flagged `is_demo`.
- **"Try the demo" button** logs into a shared demo account in one click.

## MVP Scope

**Profiles**
- Name, photo (initials avatar in v1; uploads later), skill level, preferred format (singles / doubles / either)
- Skill level is one ordered scale: `3.0, 3.5, 4.0, 4.5, 5.0`, shown with labels (3.0 = Beginner, 3.5 = Novice, 4.0 = Intermediate, 4.5 = Advanced, 5.0 = Expert)

**Post a game**
- Court picked on a map
- Date, start time, duration (default 90 min)
- Format: singles (capacity 2) or doubles (capacity 4). Capacity is total players **including the host**; the host auto-joins.
- Skill level wanted (min level, optional)

**Browse and join**
- List and map view of upcoming games nearby
- Filter by date and skill level, sort by distance
- Join / leave, with capacity limits and "full" status
- Host sees who has joined

**Game page**
- Players list
- Location with a directions link
- Simple comment thread ("running 10 min late")

### Out of scope for v1
Chat, tournaments, push notifications, photo uploads. Add later if the core works.

## Platform

**PWA first.** Installable from the phone browser, no app store needed. PWAs require HTTPS, so deploy on a host that provides it from day one.

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere |
| Monorepo | npm workspaces: `client`, `server`, `shared` |
| Frontend | React + Vite + React Router |
| PWA | `vite-plugin-pwa` (manifest, service worker, install prompt) |
| Backend | Node.js + Express (JSON API) |
| Database | PostgreSQL on Neon (dev, test, and prod) + Prisma |
| Auth | `express-session` + `connect-pg-simple` (Postgres session store), httpOnly `SameSite=Lax` cookie, bcrypt password hashing, `express-rate-limit` on auth routes |
| Validation | Zod schemas in `shared/`, used by both the API and client forms |
| Maps | Leaflet + OpenStreetMap via `react-leaflet` |
| Location | Browser Geolocation API; distance sort via haversine in JS (no PostGIS needed at this scale) |
| Tests | Vitest + Supertest against a test database |
| Hosting | Render / Railway / Fly.io for the Node app; Neon for Postgres (free: 0.5 GB, 100 CU-hours/month, sleeps after 5 min idle) |

## Project Layout

```
dinkup/
├── client/   # React + Vite app
├── server/   # Express API + Prisma
├── shared/   # Zod schemas + shared types/constants
└── docs/     # plan + portfolio log
```

In production, Express serves the built React files: one deploy, one domain, no CORS issues.

## Conventions

- All times stored as `timestamptz` (UTC). All display and "today" filtering uses `Asia/Manila`.
- The service worker must **not** cache `/api/*` responses (network-only), or users will see stale games. Only the app shell and the offline fallback page are cached.
- Every guard and concurrency-sensitive write lives on the server, inside a transaction.

## Data Model

| Table | Fields |
|---|---|
| `users` | id, name, email (unique), password_hash, photo_url (nullable), skill_level, preferred_format, skill_points, is_demo, created_at |
| `courts` | id, name, address, lat, lng, notes |
| `games` | id, host_id, court_id, starts_at, duration_min, capacity, min_skill_level, format, status (open / cancelled / completed), created_at |
| `game_players` | game_id, user_id, joined_at — **PK (game_id, user_id)** |
| `game_comments` | id, game_id, user_id, body, created_at |
| `match_results` | id, game_id (unique), reported_by, score, status (pending / confirmed / disputed / expired), confirmed_by, points_awarded, created_at, confirmed_at |
| `match_result_players` | result_id, user_id, side (winner / loser) — **PK (result_id, user_id)** |
| `session` | managed by `connect-pg-simple` |

Notes:
- **"Full" is derived**, not stored: `count(game_players) >= capacity`. Storing it would drift.
- Winners/losers live in `match_result_players` instead of arrays, so "wins vs. this opponent in the last 30 days" is a plain join.
- Game "end" = `starts_at + duration_min`.

## Build Order

Roughly one vibe-coding session per step. One commit (or PR) per step, with a matching `docs/log/step-N.md`.

1. **Setup + auth:** monorepo, Postgres, Prisma schema for users, register / login / logout, profile page with skill level and format.
2. **Courts:** courts table, seed real Cebu courts (hand-curated — OSM has little pickleball data for Cebu), map showing them. Expect to fix Leaflet's default marker icons under Vite. ✅ Done with 4 verified pins; ~18 more venues listed in `server/prisma/data/courts.ts` waiting for coordinates.
3. **Post a game:** pick a court on the map, set date/time/duration, format, min skill level. Host auto-joins. ✅ Done, plus host cancel, a schedule-clash check, and a 5-upcoming-games cap.
4. **Browse games:** list + map view, filters by date and skill, sort by distance. Guest-readable.
5. **Join / leave:** capacity limits enforced in a transaction with a row lock on the game (`SELECT … FOR UPDATE`) so two people can't take the last spot at once. Tests for the race.
6. **Game page:** players list, directions link, comments.
7. **Demo data:** demo users + rolling upcoming games, "Try the demo" button.
8. **PWA polish:** manifest, icons, install prompt, offline fallback page, mobile layout check.
9. **Deploy:** go live and invite a few real players to try it.
10. **Results + leveling:** result reporting, loser confirmation, skill points, level-ups, and anti-boosting guards (see below). Test every guard.
    Also lock self-editing of skill level once a player has any confirmed result (until then it's a self-assessment). Otherwise anyone could skip the leveling system from the profile page.

## Feature: Results and Leveling

Players move up a skill level by winning games, but a win only counts once the **losing opponent confirms it**.

### Flow

1. After a game ends, a winner reports the result and score, naming the winning and losing side.
2. A losing player (or either player on the losing pair, in doubles) sees a pending result to **confirm** or **dispute**.
3. Only confirmed results can earn points.
4. Unanswered results expire and count for nothing, so no one levels up by being ignored.

Expiry is **lazy**: whenever results are read or acted on, any pending result past its deadline is marked `expired` first. No cron job needed.

### Leveling

- Levels: `3.0 → 3.5 → 4.0 → 4.5 → 5.0`. Level up at **5 points**; points reset to 0 on level-up. No level-downs in v1.
- Points per confirmed win:
  - **1 point** if the losing side's level ≥ the winner's level
  - **0 points** if the losing side's level is lower (no farming beginners)
  - Doubles: the losing side's level is the **average** of the two losers' levels; each winner is compared individually.
- Doubles: both winners get credit. Singles ships first; doubles results after.

### Result validation

- Every named player must be in `game_players` for that game.
- Winner and loser sides can't overlap.
- Side sizes must match the format (1v1 singles, 2v2 doubles).

### Anti-Boosting Guards

Enforced on the server so they can't be bypassed from the frontend.

1. **Results only for real, scheduled games.** The game must have been posted in Dinkup, its end time must have passed, and all players must have joined through the app before it started. One result per game (unique `game_id` in `match_results`).
2. **Same-opponent cap.** Only 2 wins against the same opponent count toward points in any 30-day window (per winner–loser pair of individuals). Extra results are saved to match history but earn 0 points.
3. **The confirmer must be a real loser.** The confirmer must be on the losing side and can't be the person who reported the result.
4. **No throwaway accounts.** A confirmation only earns points if the loser's account is at least 7 days old and has at least 3 **confirmed results** in past games. (Counting merely joined games is fakeable — a booster could post throwaway games for their alt.)
5. **Time limits.** Results must be reported within 24 hours after the game ends and confirmed within 48 hours of reporting; otherwise they expire.

### Awarding Points

When the loser confirms, the server does everything in **one database transaction**:

1. Lock the result row; verify it's still `pending` and not expired.
2. Verify the game, participants, and that the confirmer is on the losing side and isn't the reporter.
3. Count confirmed wins between each winner–loser pair in the last 30 days.
4. Check the loser's account age and confirmed-results count.
5. Award points (or 0), record `points_awarded`, and level up winners who cross the threshold.

Using a single transaction with a row lock prevents double-counting if two confirmations arrive at the same time.

### Known limitations (put these in the README)

- **Collusion rings:** N colluding accounts can rotate opponents to get around the per-pair cap. Guards 4 and 5 slow this down but don't stop it. A future fix: weight points by opponent diversity, or flag clusters of accounts that only play each other.
- **Honest-loser assumption:** a loser can refuse to confirm a real loss. It just expires and costs nothing, which is the safe failure.

## Watch-outs

Express doesn't include auth, validation, or migrations the way Laravel does. When vibe coding, ask the AI to explain its choices for:
- Authentication and session handling
- Input validation
- Error handling
- The join transaction and the points transaction + guard checks

These are where generated Express code is most often sloppy, and being able to explain them is a strong interview point.

## Portfolio Log

Keep a running log in `docs/log/step-N.md` as you build:
- The prompt used for each step
- What the AI got right
- What had to be fixed, and why
- Before/after screenshots for tricky parts

This becomes the README and the story for interviews. Include a section on **"How Dinkup prevents rating abuse"**, including the known limitations, to show you thought about how real users might game the system.
