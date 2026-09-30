import { createApp } from './app.ts';
import { pool } from './db.ts';
import { env } from './env.ts';

const server = createApp().listen(env.PORT, () => {
  console.log(`Dinkup API listening on http://localhost:${env.PORT}`);
});

function shutdown() {
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
