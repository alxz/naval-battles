// The single-file test build only (vite.test.config.ts): every asset as a data URL, keyed by the
// path the code asks for ('assets/ships/sloop-player-32.png'). See src/assets.ts.
const files = import.meta.glob<string>('../public/assets/**/*.{png,wav,woff2}', { query: '?inline', import: 'default', eager: true });

export const INLINE: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace('../public/', ''), url]),
);
