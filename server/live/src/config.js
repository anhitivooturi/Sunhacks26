import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export function getConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  const threshold = Number(env.CONFUSION_THRESHOLD || 0.3);
  const aiTimeoutMs = Number(env.AI_TIMEOUT_MS || 20000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Invalid CONFUSION_THRESHOLD');
  if (!Number.isFinite(aiTimeoutMs) || aiTimeoutMs <= 0) throw new Error('Invalid AI_TIMEOUT_MS');
  const baseUrl = (env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
  if (!['http:', 'https:'].includes(new URL(baseUrl).protocol)) throw new Error('Invalid BASE_URL');
  return {
    port, baseUrl, threshold, aiTimeoutMs,
    host: env.HOST || '127.0.0.1', databaseUrl: env.DATABASE_URL || '',
    corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(x => x.trim()).filter(Boolean),
    logLevel: env.LOG_LEVEL || 'info',
  };
}
