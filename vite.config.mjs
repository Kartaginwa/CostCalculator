import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'node',
    // e2e/ contient les tests Playwright (npm run test:e2e), pas des tests Vitest.
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
});
