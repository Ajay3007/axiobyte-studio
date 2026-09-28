import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every interactive representation is `<domain>/<concept>/index.html` with an
 * `experience.json` beside it. Adding a concept adds a folder — not a build,
 * not a workflow, not a deployment.
 */
function discover() {
  const out = [];
  for (const domain of fs.readdirSync(ROOT)) {
    const dDir = path.join(ROOT, domain);
    if (!fs.statSync(dDir).isDirectory() || ['node_modules', 'dist', 'test', 'public'].includes(domain)) continue;
    for (const concept of fs.readdirSync(dDir)) {
      const html = path.join(dDir, concept, 'index.html');
      const meta = path.join(dDir, concept, 'experience.json');
      if (!fs.existsSync(html)) continue;
      if (!fs.existsSync(meta)) throw new Error(`${domain}/${concept}: index.html without experience.json`);
      out.push({ domain, concept, html, meta: JSON.parse(fs.readFileSync(meta, 'utf8')) });
    }
  }
  return out;
}

const experiences = discover();
const domains = JSON.parse(fs.readFileSync(path.join(ROOT, 'domains.json'), 'utf8'));
for (const e of experiences) {
  if (!domains[e.domain]) throw new Error(`${e.domain}/${e.concept}: domain "${e.domain}" missing from domains.json`);
}

/** dist/manifest.json — what the website's /axiobyte/ hub and domain pages render from. */
function manifest() {
  return {
    name: 'axiobyte-manifest',
    generateBundle() {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
      const body = {
        version: pkg.version,
        domains: Object.entries(domains).map(([id, d]) => ({
          id,
          ...d,
          experiences: experiences
            .filter((e) => e.domain === id)
            .map((e) => ({ path: `${e.domain}/${e.concept}/`, domain: e.domain, ...e.meta })),
        })),
      };
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(body, null, 2) + '\n' });
    },
  };
}

// A relative base is what lets the same build serve at /axiobyte/<domain>/<concept>/
// on the website, at the root of `vite preview`, and under any test mount.
export default defineConfig({
  root: ROOT,
  base: './',
  plugins: [manifest()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(experiences.map((e) => [`${e.domain}/${e.concept}`, e.html])),
    },
  },
});
