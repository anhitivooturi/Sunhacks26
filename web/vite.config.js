import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend (Person A) runs on :3000 in dev. Vite proxies REST and WebSockets to it.
const API = process.env.PULSE_API || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/sessions': API,
      '/health': API,
      '/notes': API,
      '/ws': { target: API.replace('http', 'ws'), ws: true },
    },
  },
});
