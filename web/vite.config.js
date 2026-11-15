import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The backend (Person A) runs on :3000 in dev. Vite proxies REST and WebSockets to it.
const API = process.env.PULSE_API || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@fixtures': fileURLToPath(new URL('../fixtures', import.meta.url)) } }, // shared mock data (Person D)
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/sessions': API,
      '/health': API,
      '/notes': API,
      '/api': process.env.PULSE_ATLAS || 'http://localhost:3001', // student settings, notes, questions (MongoDB Atlas). server/atlas listens on :3001
      '/ws': { target: API.replace('http', 'ws'), ws: true },
    },
  },
});
