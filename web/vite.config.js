import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The backend (Person A) runs on :3000 in dev. Vite proxies REST and WebSockets to it.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API = env.PULSE_API || 'http://localhost:3000';
  const proxy = target => ({ target, changeOrigin: true });
  return {
    plugins: [react()],
    resolve: { alias: { '@fixtures': fileURLToPath(new URL('../fixtures', import.meta.url)) } }, // shared mock data (Person D)
    server: {
      port: 5173,
      fs: { allow: ['..'] },
      proxy: {
        '/sessions': proxy(API),
        '/health': proxy(API),
        '/notes': proxy(API),
        '/api': proxy(env.PULSE_ATLAS || API), // student settings (Atlas). server/atlas/dev-server.js listens on :3001
        '/ws': { ...proxy(API.replace(/^http/, 'ws')), ws: true },
      },
    },
  };
});
