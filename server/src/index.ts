import { createApp } from './app.ts';
import { pool } from './db.ts';
import { env } from './env.ts';
import { ensureDemoData } from './lib/demo.ts';

const server = createApp().listen(env.PORT, () => {
  console.log(`Dinkup API listening on http://localhost:${env.PORT}`);
});

function shutdown() {
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
}
// Keep a rolling week of demo games. Runs on boot (free hosts sleep and wake
// on the next visit, so this covers them without a cron job) and hourly.
if (env.DEMO_MODE) {
  const refreshDemo = () =>
    ensureDemoData()
      .then((r) => console.log(`Demo data: +${r.created} games, -${r.removedGames} old games, -${r.removedVisitors} expired visitors`))
      .catch((err) => console.error('Demo data refresh failed', err));
  void refreshDemo();
  setInterval(refreshDemo, 60 * 60 * 1000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
