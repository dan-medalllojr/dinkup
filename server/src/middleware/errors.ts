import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import { HttpError } from '../lib/http-error.ts';

// Rejects cross-site "simple" requests (HTML forms, text/plain beacons) on
// mutating routes. SameSite=Lax cookies already block most CSRF; this is
// defence in depth, since browsers can't send application/json cross-site
// without a CORS preflight, which we never approve.
export const requireJson: RequestHandler = (req, _res, next) => {
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  // Checked on the header (not req.is) so body-less POSTs like logout still pass.
  const isJson = /^application\/json\b/i.test(req.headers['content-type'] ?? '');
  if (mutating && !isJson) {
    throw new HttpError(415, 'Requests must be sent as JSON');
  }
  next();
};

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid input', fields: z.flattenError(err).fieldErrors });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // body-parser errors (malformed JSON, payload too large) carry a safe 4xx status.
  if (err?.expose && typeof err.status === 'number' && err.status < 500) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
};
