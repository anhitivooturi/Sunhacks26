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
  const publicUrl = new URL(baseUrl);
  if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash || publicUrl.pathname !== '/') throw new Error('BASE_URL must be an HTTP(S) origin without a path or credentials');
  const loopback = /^(localhost|0\.0\.0\.0|127\..*|\[?::1\]?)$/i.test(publicUrl.hostname) || publicUrl.hostname.endsWith('.localhost');
  if (env.NODE_ENV === 'production' && (publicUrl.protocol !== 'https:' || loopback)) throw new Error('Set BASE_URL to your public HTTPS domain before starting production');
  return {
    port, baseUrl, threshold, aiTimeoutMs,
    host: env.HOST || '127.0.0.1', databaseUrl: env.DATABASE_URL || '',
    corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(x => x.trim()).filter(Boolean),
    logLevel: env.LOG_LEVEL || 'info',
  };
}
