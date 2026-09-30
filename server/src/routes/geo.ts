import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../env.ts';
import { reversePlace, searchPlaces } from '../lib/geocode.ts';
import { HttpError } from '../lib/http-error.ts';

export const geoRouter = Router();

// On top of the global 1 request/second to Nominatim: stop one client from
// hogging that shared budget.
const geoLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many searches. Wait a moment and try again.' },
  skip: () => env.NODE_ENV === 'test',
});

geoRouter.use(geoLimiter);

async function upstream<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (err) {
    console.error('Geocoding failed', err);
    throw new HttpError(502, "Place search isn't available right now. You can still drop a pin on the map.");
  }
}

geoRouter.get('/search', async (req, res) => {
  const { q } = z.object({ q: z.string().trim().min(3, 'Type at least 3 characters').max(100) }).parse(req.query);
  res.json({ places: await upstream(() => searchPlaces(q)) });
});

geoRouter.get('/reverse', async (req, res) => {
  const { lat, lng } = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) }).parse(req.query);
  res.json({ place: await upstream(() => reversePlace(lat, lng)) });
});
