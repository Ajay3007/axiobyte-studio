import { defineConfig } from 'vite';

// Relative base ('./') works for both https://<user>.github.io/ and
// https://<user>.github.io/<repo>/ with no changes. Set BASE_PATH to force an
// absolute base, e.g. BASE_PATH=/nic-3d/ npm run build
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    // video.html is a dev/render-only page (it pulls in timeline.json and the
    // voiceover from content/), so the published site stays exactly as it was.
    rollupOptions: { input: 'index.html' },
  },
});
