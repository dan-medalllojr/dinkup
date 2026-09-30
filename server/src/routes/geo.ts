import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../env.ts';
import { LinkError, resolveMapsLink, reversePlace, searchPlaces } from '../lib/geocode.ts';
import { HttpError } from '../lib/http-error.ts';

export const geoRouter = Router();

// Per-client cap on top of the per-provider queues. Search-as-you-type sends
// a request per pause in typing (debounced in the app), so this allows a few
// searches a minute.
const geoLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
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
    if (err instanceof LinkError) throw new HttpError(422, err.message);
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

geoRouter.get('/link', async (req, res) => {
  const { url } = z.object({ url: z.string().trim().min(8).max(2000) }).parse(req.query);
  res.json({ location: await upstream(() => resolveMapsLink(url)) });
});
