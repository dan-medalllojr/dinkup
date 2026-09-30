import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { addDaysToDate, GAME_CAPACITY, gameEndsAt, manilaToIso, todayInManila, type GameFormat, type SkillLevel } from '@dinkup/shared';
import { prisma } from '../db.ts';
import { lockGame } from './games.ts';
import { toDbLevel } from './users.ts';

// Demo data so the app never looks empty to a first-time visitor (or a recruiter).
//
// - The *cast* are fake players who host and fill a rolling week of games.
// - *Visitors* are the throwaway accounts behind "Try the demo", one per click,
//   deleted after a day.
// Both are `is_demo`, and every demo game is labeled in the UI so no real
// player turns up at a court for a game that doesn't exist.
//
// `.invalid` is reserved (RFC 2606): these addresses can never receive mail.
const CAST_DOMAIN = 'demo.dinkup.invalid';
const castEmail = (key: string) => `cast.${key}@${CAST_DOMAIN}`;
const VISITOR_EMAIL_PREFIX = 'visitor.';

export const VISITOR_TTL_MS = 24 * 60 * 60 * 1000;
const DAYS_AHEAD = 7;
// Don't create a demo game that starts too soon to plausibly join.
const MIN_LEAD_MS = 60 * 60 * 1000;
// Keep ended demo games around briefly, then clear them out.
const KEEP_ENDED_MS = 24 * 60 * 60 * 1000;

const CAST = [
  { key: 'maria', name: 'Maria Santos', level: '3.5', format: 'doubles' },
  { key: 'jun', name: 'Jun Dela Cruz', level: '4.0', format: 'either' },
  { key: 'leah', name: 'Leah Tan', level: '3.0', format: 'doubles' },
  { key: 'paolo', name: 'Paolo Reyes', level: '4.5', format: 'singles' },
  { key: 'bea', name: 'Bea Villanueva', level: '3.5', format: 'either' },
  { key: 'carlo', name: 'Carlo Lim', level: '3.0', format: 'doubles' },
  { key: 'tricia', name: 'Tricia Go', level: '4.0', format: 'doubles' },
  { key: 'migs', name: 'Migs Fernandez', level: '3.5', format: 'singles' },
] as const satisfies readonly { key: string; name: string; level: SkillLevel; format: 'singles' | 'doubles' | 'either' }[];

type CastKey = (typeof CAST)[number]['key'];

type Slot = {
  time: string; // Manila wall clock
  court: string; // court slug
  format: GameFormat;
  min: SkillLevel | null;
  minutes: number;
  host: CastKey;
  fill: CastKey[]; // other cast already in the game
  comments?: [CastKey, string][];
};

// A 7-day cycle of slots. Written so no cast member is ever in
// two overlapping games (a test checks this) and every host meets the minimum.
// Some games are left with open spots so visitors have something to join.
const WEEK: Slot[][] = [
  [
    { time: '18:30', court: 'pumpd-pickleball-cebu', format: 'doubles', min: null, minutes: 90, host: 'maria', fill: ['jun'],
      comments: [['jun', 'I can bring extra balls'], ['maria', 'Perfect, see you at 6:30!']] },
    { time: '20:00', court: 'zions-pickleball', format: 'singles', min: '3.5', minutes: 60, host: 'paolo', fill: [] },
  ],
  [
    { time: '06:30', court: 'nickleball-avenue', format: 'doubles', min: null, minutes: 90, host: 'leah', fill: ['carlo', 'bea'],
      comments: [['carlo', 'Early one! Anyone want coffee after?']] },
    { time: '17:30', court: 'niceserve-pickleball-court', format: 'doubles', min: '3.5', minutes: 90, host: 'tricia', fill: ['migs'] },
    { time: '19:30', court: 'pumpd-pickleball-cebu', format: 'singles', min: '4.0', minutes: 60, host: 'jun', fill: [] },
  ],
  [
    { time: '18:00', court: 'zions-pickleball', format: 'doubles', min: '4.0', minutes: 120, host: 'paolo', fill: ['tricia', 'jun'] },
    { time: '19:30', court: 'pumpd-pickleball-cebu', format: 'doubles', min: null, minutes: 90, host: 'carlo', fill: ['leah'] },
  ],
  [
    { time: '06:00', court: 'niceserve-pickleball-court', format: 'singles', min: null, minutes: 60, host: 'migs', fill: ['maria'] },
    { time: '18:30', court: 'pumpd-pickleball-cebu', format: 'doubles', min: '3.5', minutes: 90, host: 'bea', fill: ['maria'],
      comments: [['bea', 'Beginners welcome to watch, we rotate every game']] },
  ],
  [
    { time: '17:00', court: 'nickleball-avenue', format: 'doubles', min: null, minutes: 90, host: 'leah', fill: [] },
    { time: '19:00', court: 'zions-pickleball', format: 'doubles', min: '3.5', minutes: 90, host: 'tricia', fill: ['paolo', 'jun', 'bea'] },
  ],
  [
    { time: '07:00', court: 'pumpd-pickleball-cebu', format: 'doubles', min: null, minutes: 90, host: 'jun', fill: ['maria', 'carlo'],
      comments: [['maria', 'Weekend dink session!'], ['carlo', 'Bringing my new paddle']] },
    { time: '09:00', court: 'zions-pickleball', format: 'doubles', min: '4.0', minutes: 120, host: 'paolo', fill: ['tricia'] },
    { time: '16:00', court: 'niceserve-pickleball-court', format: 'singles', min: '3.0', minutes: 60, host: 'carlo', fill: [] },
  ],
  [
    { time: '08:00', court: 'nickleball-avenue', format: 'doubles', min: null, minutes: 90, host: 'bea', fill: ['migs', 'leah'] },
    { time: '18:00', court: 'pumpd-pickleball-cebu', format: 'doubles', min: '3.5', minutes: 90, host: 'maria', fill: [] },
  ],
];

/**
 * The slots for a calendar date. Keyed on the date itself (days since epoch),
 * not "days from today": otherwise tomorrow's run would lay today's pattern
 * over games created for that date yesterday, duplicating games and
 * double-booking the cast.
 */
export function slotsFor(date: string): Slot[] {
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return WEEK[dayNumber % WEEK.length]!;
}

// Exported for tests.
export const DEMO_WEEK = WEEK;
export const DEMO_CAST = CAST;

export const isVisitorEmail = (email: string) => email.startsWith(VISITOR_EMAIL_PREFIX) && email.endsWith(`@${CAST_DOMAIN}`);

// Nobody logs in as the cast, so their password is random and discarded.
const unusablePasswordHash = () => bcrypt.hash(randomBytes(32).toString('hex'), 10);

async function ensureCast(now: Date) {
  const ids = new Map<CastKey, string>();
  for (const c of CAST) {
    const user = await prisma.user.upsert({
      where: { email: castEmail(c.key) },
      update: {},
      create: {
        email: castEmail(c.key),
        name: c.name,
        passwordHash: await unusablePasswordHash(),
        skillLevel: toDbLevel(c.level),
        preferredFormat: c.format,
        isDemo: true,
        // Established accounts, so later anti-abuse rules (account age) behave realistically.
        createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      },
    });
    ids.set(c.key, user.id);
  }
  return ids;
}

/**
 * Idempotent: creates any missing demo games for the next week, then removes
 * old demo games and expired visitor accounts. Safe to run on every boot and
 * hourly. Never touches real users or their games.
 */
export async function ensureDemoData(now = new Date()) {
  const cast = await ensureCast(now);
  const courts = new Map((await prisma.court.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));
  const today = todayInManila(now);
  let created = 0;

  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const date = addDaysToDate(today, offset);
    for (const slot of slotsFor(date)) {
      const startsAt = new Date(manilaToIso(date, slot.time));
      const courtId = courts.get(slot.court);
      if (!courtId || startsAt.getTime() < now.getTime() + MIN_LEAD_MS) continue;

      const hostId = cast.get(slot.host)!;
      // A demo game is identified by its host and start time.
      const exists = await prisma.game.findFirst({ where: { hostId, startsAt }, select: { id: true } });
      if (exists) continue;

      const playerIds = [hostId, ...slot.fill.map((k) => cast.get(k)!)];
      await prisma.game.create({
        data: {
          hostId,
          courtId,
          startsAt,
          durationMin: slot.minutes,
          format: slot.format,
          capacity: GAME_CAPACITY[slot.format],
          minSkillLevel: slot.min && toDbLevel(slot.min),
          players: { create: playerIds.map((userId, i) => ({ userId, joinedAt: new Date(now.getTime() - (playerIds.length - i) * 3600_000) })) },
          comments: {
            create: (slot.comments ?? []).map(([by, body], i) => ({
              userId: cast.get(by)!,
              body,
              createdAt: new Date(now.getTime() - ((slot.comments?.length ?? 0) - i) * 20 * 60_000),
            })),
          },
        },
      });
      created++;
    }
  }

  const castIds = [...cast.values()];
  const endedBefore = new Date(now.getTime() - KEEP_ENDED_MS);
  // Can't filter on starts_at + duration in Prisma directly; the longest game
  // is 240 min, so anything that started that much earlier has certainly ended.
  const removedGames = await prisma.game.deleteMany({
    where: { hostId: { in: castIds }, startsAt: { lt: new Date(endedBefore.getTime() - 240 * 60_000) } },
  });
  const removedVisitors = await prisma.user.deleteMany({
    where: { isDemo: true, email: { startsWith: VISITOR_EMAIL_PREFIX, endsWith: `@${CAST_DOMAIN}` }, createdAt: { lt: new Date(now.getTime() - VISITOR_TTL_MS) } },
  });

  return { created, removedGames: removedGames.count, removedVisitors: removedVisitors.count };
}

/**
 * A fresh throwaway account for one "Try the demo" click, joined to the
 * soonest demo game with room, so their profile has something in it.
 */
export async function createDemoVisitor(now = new Date()) {
  const suffix = randomBytes(2).readUInt16BE(0).toString().padStart(4, '0').slice(-4);
  const visitor = await prisma.user.create({
    data: {
      email: `${VISITOR_EMAIL_PREFIX}${randomBytes(8).toString('hex')}@${CAST_DOMAIN}`,
      name: `Demo Visitor ${suffix}`,
      passwordHash: await unusablePasswordHash(),
      skillLevel: toDbLevel('3.5'),
      preferredFormat: 'either',
      isDemo: true,
    },
  });

  const candidates = await prisma.game.findMany({
    where: {
      status: 'open',
      host: { isDemo: true, email: { startsWith: 'cast.' } },
      startsAt: { gt: new Date(now.getTime() + MIN_LEAD_MS) },
      OR: [{ minSkillLevel: null }, { minSkillLevel: { in: ['L3_0', 'L3_5'] } }],
    },
    include: { players: true },
    orderBy: { startsAt: 'asc' },
    take: 10,
  });
  // Leave at least one spot for the next visitor.
  const target = candidates.find((g) => g.capacity - g.players.length >= 2);
  if (target) {
    await prisma.$transaction(async (tx) => {
      await lockGame(tx, target.id);
      const count = await tx.gamePlayer.count({ where: { gameId: target.id } });
      if (count < target.capacity) await tx.gamePlayer.create({ data: { gameId: target.id, userId: visitor.id } });
    });
  }

  return visitor;
}

/** For tests and diagnostics: every demo game's players and time range. */
export async function demoSchedule() {
  const games = await prisma.game.findMany({ where: { host: { email: { endsWith: `@${CAST_DOMAIN}` } } }, include: { players: true } });
  return games.map((g) => ({ ...g, endsAt: gameEndsAt(g.startsAt, g.durationMin) }));
}
