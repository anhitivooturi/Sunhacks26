import { readFile, readdir } from 'node:fs/promises';
import { PgStore } from '../src/store.js';
import { getConfig } from '../src/config.js';

const { databaseUrl } = getConfig();
if (!databaseUrl) throw new Error('Set DATABASE_URL in server/live/.env before running migrations');
const store = new PgStore(databaseUrl);
const client = await store.pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(802426)');
  await client.query('CREATE TABLE IF NOT EXISTS pulse_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const directory = new URL('../migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter(n => n.endsWith('.sql')).sort()) {
    if ((await client.query('SELECT 1 FROM pulse_migrations WHERE name=$1', [name])).rowCount) continue;
    await client.query('BEGIN');
    try {
      await client.query(await readFile(new URL(name, directory), 'utf8'));
      await client.query('INSERT INTO pulse_migrations(name) VALUES($1)', [name]);
      await client.query('COMMIT');
      console.log(`Applied ${name}`);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(802426)');
  client.release(); await store.close();
}
