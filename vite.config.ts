import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // relative asset paths so the build works from any sub-path (e.g. GitHub Pages /<repo>/)
  base: './',
  server: { port: 5199 },
});
