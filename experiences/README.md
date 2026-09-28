# AxioByte experiences

The **interactive representations** of AxioByte concepts: the web target of the Three.js backend
([`renderers/three`](../renderers/three/README.md)), published on the public site under
**`https://ajay3007.github.io/axiobyte/<domain>/<concept>/`**.

| Page | Source | Scene |
|---|---|---|
| [`/axiobyte/networking/nic/`](https://ajay3007.github.io/axiobyte/networking/nic/) | `networking/nic/` | `@axiobyte/three/domains/networking/nic/world.js` — the same world the film `s01e03-what-is-a-nic` is rendered from |

An experience is a thin entry — HTML, a boot script, its UI — over a domain's world. The model,
its metadata and its camera presets live in the domain, so the page and the video can never drift
apart.

## Working on them

```bash
npm ci                     # once, at the repository root
abs web dev                # dev server → http://localhost:5173/networking/nic/
abs web build              # production build → experiences/dist/ (+ manifest.json)
abs web preview            # serve the build
abs web test               # smoke test: dist/ served under /axiobyte/, as the website does
```

(`abs web <x>` is `npm run <x>` at the repository root; either works.)

The build uses a **relative base**, so one build works at `/axiobyte/<domain>/<concept>/` on the
site, at the root of `vite preview`, and under the smoke test's mount. No URL in a page may be
root-relative (`/asset`) — the smoke test fails the build if one is requested.

## Adding an experience

1. `mkdir <domain>/<concept>` with an `index.html`, its entry script and an `experience.json`:

   ```json
   { "concept": "dma", "title": "DMA", "summary": "…", "episode": "s01e0N-…", "tags": ["DMA"] }
   ```

   Optional: `"video": "<url>"` once the film is published, `"docs": "/learning/…"` for prose.
2. If the domain is new, add it to `domains.json` (title and summary).
3. `abs web build && abs web test`.

That is all. The build discovers the folder, `manifest.json` lists it, the next release carries
it, and the website's `/axiobyte/` hub and domain pages render it from the manifest — no new
workflow, no new deployment, no change to the website.

## Releasing

Tag `experiences-vX.Y.Z` (matching `package.json`'s `version`). `.github/workflows/three.yml`
tests and builds it, then publishes `axiobyte-experiences-X.Y.Z.tar.gz` and its `.sha256` as a
GitHub release. The website picks it up when its pin is bumped — see
[`docs/deployment.md`](../docs/deployment.md).
