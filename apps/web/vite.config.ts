import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // hosted deployments serve under a sub-path (e.g. VITE_BASE=/monitor/)
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: {
    port: 3000,
  },
});
