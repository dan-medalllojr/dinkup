import { Router } from 'express';
import { z } from 'zod';
import type { Court } from '@dinkup/shared';
import { prisma } from '../db.ts';
import type { Court as DbCourt } from '../generated/prisma/client.ts';
import { HttpError } from '../lib/http-error.ts';

function toCourt(c: DbCourt): Court {
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
  };
}

export const courtsRouter = Router();

// Public: guests can browse courts. The list is small (Metro Cebu), so no paging.
courtsRouter.get('/', async (_req, res) => {
  const courts = await prisma.court.findMany({ orderBy: { name: 'asc' } });
  res.json({ courts: courts.map(toCourt) });
});

courtsRouter.get('/:id', async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  const court = id.success ? await prisma.court.findUnique({ where: { id: id.data } }) : null;
  if (!court) throw new HttpError(404, 'Court not found');
  res.json({ court: toCourt(court) });
});
