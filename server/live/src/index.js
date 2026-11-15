import { buildApp } from './app.js';
import { getConfig } from './config.js';
import { registerTranscription } from '../../transcribe/index.js';

const config = getConfig();
const app = await buildApp({ config, register: registerTranscription });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  app.close().catch(error => { app.log.error(error); process.exitCode = 1; });
});
try { await app.listen({ port: config.port, host: config.host }); }
catch (error) { app.log.error(error); await app.close(); process.exitCode = 1; }
