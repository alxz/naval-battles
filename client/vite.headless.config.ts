// Builds the headless arena (headless/arena.ts) into one file for Node: `npm run headless-arena`.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'headless/arena.ts',
    outDir: '.headless',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
  },
  logLevel: 'warn',
});
