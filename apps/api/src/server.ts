import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createPool, checkDatabase } from './db.js';
const config = readConfig(process.env);
const pool = createPool(config.DATABASE_URL);
const server = createApp(config, () => checkDatabase(pool)).listen(config.PORT, () => {
  console.log(`Coincela API listening on port ${config.PORT}`);
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(() => { void pool.end().then(() => { clearTimeout(timeout); process.exit(0); }); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
