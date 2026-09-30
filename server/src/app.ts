import path from 'node:path';
import express from 'express';
import { env } from './env.ts';
import { errorHandler, notFound, requireJson } from './middleware/errors.ts';
import { authRouter } from './routes/auth.ts';
import { commentsRouter } from './routes/comments.ts';
import { courtsRouter } from './routes/courts.ts';
import { gamesRouter } from './routes/games.ts';
import { usersRouter } from './routes/users.ts';
import { sessionMiddleware } from './session.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Hosts like Render/Railway terminate HTTPS at a proxy; trust it so
  // secure cookies and req.ip work.
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));
  api.use(requireJson);
  api.use(sessionMiddleware);
  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/courts', courtsRouter);
  api.use('/games/:id/comments', commentsRouter);
  api.use('/games', gamesRouter);
  api.use(notFound);
  app.use('/api', api);

  // In production Express also serves the built client: one deploy, one domain.
  if (env.NODE_ENV === 'production') {
    const clientDist = path.resolve(import.meta.dirname, '../../client/dist');
    app.use(
      express.static(clientDist, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            // Content-hashed filenames: safe to cache forever.
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            // sw.js, the manifest, and icons must be re-checked, or installed
            // apps get stuck on an old version.
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
