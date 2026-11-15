import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store.js';
import { getConfig } from '../src/config.js';
import { seedStore } from './seed.js';

const config = getConfig();
const store = new MemoryStore();
const session = await seedStore(store);
const app = await buildApp({ config, store });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close());
await app.listen({ host: config.host, port: config.port });
console.log(`Backup session: ${session.code}\nReport JSON: ${config.baseUrl}/sessions/${session.id}/report`);
