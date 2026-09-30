import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import {
  createCourtSchema,
  distanceKm,
  DUPLICATE_COURT_METERS,
  MAX_COURTS_ADDED_PER_DAY,
  updateCourtSchema,
  type Court,
} from '@dinkup/shared';
import { prisma } from '../db.ts';
import type { Court as DbCourt, Prisma } from '../generated/prisma/client.ts';
import { HttpError } from '../lib/http-error.ts';
import { requireAuth } from '../middleware/auth.ts';

type CourtRow = DbCourt & { addedBy: { id: string; name: string } | null };

function toCourt(c: CourtRow, upcomingGames: number): Court {
  return {
    id: c.id,
    name: c.name,
    address: c.address,
    city: c.city,
    lat: c.lat,
    lng: c.lng,
    courtCount: c.courtCount,
    setting: c.setting,
    notes: c.notes,
    addedBy: c.addedBy ? { id: c.addedBy.id, name: c.addedBy.name } : null,
    upcomingGames,
  };
}

const include = { addedBy: { select: { id: true, name: true } } } satisfies Prisma.CourtInclude;

/** Upcoming open games per court, for the map badges. */
async function upcomingCounts(courtIds?: string[]) {
  const rows = await prisma.game.groupBy({
    by: ['courtId'],
    where: { status: 'open', startsAt: { gt: new Date() }, ...(courtIds ? { courtId: { in: courtIds } } : {}) },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.courtId, r._count._all]));
}

function slugFor(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'court';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

export const courtsRouter = Router();

// Public: guests can browse courts. The list is small (Metro Cebu), so no paging.
courtsRouter.get('/', async (_req, res) => {
  const [courts, counts] = await Promise.all([prisma.court.findMany({ include, orderBy: { name: 'asc' } }), upcomingCounts()]);
  res.json({ courts: courts.map((c) => toCourt(c, counts.get(c.id) ?? 0)) });
});

courtsRouter.get('/:id', async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  const court = id.success ? await prisma.court.findUnique({ where: { id: id.data }, include }) : null;
  if (!court) throw new HttpError(404, 'Court not found');
  const counts = await upcomingCounts([court.id]);
  res.json({ court: toCourt(court, counts.get(court.id) ?? 0) });
});

// Players can add a court they know. It shows up for everyone right away,
// labeled "Added by a player", so the checks here guard against junk pins.
courtsRouter.post('/', requireAuth, async (req, res) => {
  const input = createCourtSchema.parse(req.body);
  const userId = req.session.userId!;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  // Demo accounts are throwaway; their pins would outlive them on a public map.
  if (user.isDemo) throw new HttpError(403, 'Sign up to add a court. Demo accounts can only use existing ones.');

  const addedToday = await prisma.court.count({
    where: { addedById: userId, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (addedToday >= MAX_COURTS_ADDED_PER_DAY) {
    throw new HttpError(429, `You can add up to ${MAX_COURTS_ADDED_PER_DAY} courts a day`);
  }

  // Same place as an existing court? Point the player at it instead.
  const existing = await prisma.court.findMany({ select: { id: true, name: true, lat: true, lng: true } });
  const dupe = existing.find((c) => distanceKm(c, input) * 1000 < DUPLICATE_COURT_METERS);
  if (dupe) {
    res.status(409).json({ error: `${dupe.name} is already on the map at that spot`, existingCourtId: dupe.id });
    return;
  }

  const court = await prisma.court.create({
    data: { ...input, slug: slugFor(input.name), source: 'Added by a player', addedById: userId },
    include,
  });
  res.status(201).json({ court: toCourt(court, 0) });
});

courtsRouter.patch('/:id', requireAuth, async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  const court = id.success ? await prisma.court.findUnique({ where: { id: id.data } }) : null;
  if (!court) throw new HttpError(404, 'Court not found');
  // Curated courts (addedById null) can't be edited from the app at all.
  if (court.addedById !== req.session.userId) throw new HttpError(403, 'Only the player who added this court can edit it');

  const input = updateCourtSchema.parse(req.body);
  const updated = await prisma.court.update({ where: { id: court.id }, data: input, include });
  const counts = await upcomingCounts([court.id]);
  res.json({ court: toCourt(updated, counts.get(court.id) ?? 0) });
});
