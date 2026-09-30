import type { RequestHandler } from 'express';
import { HttpError } from '../lib/http-error.ts';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) throw new HttpError(401, 'You need to log in first');
  next();
};
