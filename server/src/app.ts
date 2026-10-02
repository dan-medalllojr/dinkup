import path from 'node:path';
import express from 'express';
import { env } from './env.ts';
import { errorHandler, notFound, requireJson } from './middleware/errors.ts';
import { authRouter } from './routes/auth.ts';
import { commentsRouter } from './routes/comments.ts';
import { courtsRouter } from './routes/courts.ts';
import { feedbackRouter } from './routes/feedback.ts';
import { gamesRouter } from './routes/games.ts';
import { geoRouter } from './routes/geo.ts';
import { notificationsRouter } from './routes/notifications.ts';
import { resultsRouter } from './routes/results.ts';
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
  api.use('/geo', geoRouter);
  api.use('/feedback', feedbackRouter);
  // Paths like /games/:id/result and /users/:id/results: mounted after the
  // games and users routers, which don't match them and pass them on.
  api.use(resultsRouter);
  api.use(notificationsRouter);
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
    // A file under /assets that isn't there is an old build's chunk (an
    // installed app that hasn't updated yet). Say so with a 404: answering with
    // index.html made the browser try to run HTML as JavaScript, and the
    // service worker cached that HTML under the script's name.
    app.use('/assets', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.status(404).type('text/plain').send('Not found');
    });
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
