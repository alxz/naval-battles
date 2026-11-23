import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    // Lets the iPad and the MacBook open the game over the local network.
    host: true,
    port: 5173,
  },
  build: {
    // Phaser is large; this silences the harmless "chunk too big" warning.
    chunkSizeWarningLimit: 1600,
  },
  test: {
    // Review 22 Nov: the scenario tests run several game minutes; on a slow machine (Brainbox) 5 s was too short.
    testTimeout: 20000,
  },
});
