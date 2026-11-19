// `npm run build:test`: one HTML file with everything inside (code, pictures, sounds, fonts),
// for testers. It opens from the disk with a double click: no web server, no Python, no Node.
// No tuning panel; the version shows in a corner. Output: dist-test/naval-battles-test-<date>.html
import { readFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const two = (n: number): string => String(n).padStart(2, '0');
const now = new Date();
const stamp = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}`;
// The step name comes from the arena log's build label (view/arenaLog.ts), e.g. "M3 step 6d".
const label = /BUILD_LABEL = '([^(']*)/.exec(readFileSync('src/view/arenaLog.ts', 'utf8'))?.[1]?.trim() ?? 'test';
const info = `${label} · ${stamp.slice(0, 10)} ${stamp.slice(11, 13)}:${stamp.slice(13)}`;

export default defineConfig({
  define: {
    'import.meta.env.VITE_TEST_BUILD': JSON.stringify('1'),
    'import.meta.env.VITE_BUILD_INFO': JSON.stringify(info),
  },
  resolve: {
    alias: [{ find: /^\.\/assetSource$/, replacement: fileURLToPath(new URL('./src/assetSource.inline.ts', import.meta.url)) }],
  },
  // The assets are inside the page; the public folder is not copied next to it.
  publicDir: false,
  build: {
    outDir: 'dist-test',
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    chunkSizeWarningLimit: 20000,
    sourcemap: false,
  },
  plugins: [
    viteSingleFile(),
    {
      name: 'name-the-test-page',
      closeBundle() {
        renameSync('dist-test/index.html', `dist-test/naval-battles-test-${stamp}.html`);
        console.log(`\n  test build: dist-test/naval-battles-test-${stamp}.html  (${info})\n`);
      },
    },
  ],
});
