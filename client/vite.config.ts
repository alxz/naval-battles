import { defineConfig } from 'vite';

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
});
