import { PgStore } from '../src/store.js';
import { getConfig } from '../src/config.js';
import { seedStore } from './seed.js';

const { databaseUrl, baseUrl } = getConfig();
if (!databaseUrl) throw new Error('Set DATABASE_URL first. For a temporary memory demo use: npm run demo');
const store = new PgStore(databaseUrl);
try {
  const session = await seedStore(store);
  console.log(JSON.stringify({ id: session.id, code: session.code, reportUrl: `${baseUrl}/sessions/${session.id}/report` }, null, 2));
} finally { await store.close(); }
