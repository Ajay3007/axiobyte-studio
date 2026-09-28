# Deployment — from this repository to `ajay3007.github.io/axiobyte/`

Two repositories, one direction, no copying:

```
axiobyte-studio (this repo)                               Ajay3007.github.io
───────────────────────────                               ──────────────────
experiences/ + renderers/three/                           axiobyte.json  { tag, asset, sha256 }
        │  push to main / PR                                     │
        ▼                                                        │
.github/workflows/three.yml                                      │
  npm ci · vitest · build · smoke test under /axiobyte/          │
  · determinism (two sessions)                                   │
        │  tag experiences-vX.Y.Z                                │
        ▼                                                        ▼
GitHub release  axiobyte-experiences-X.Y.Z.tar.gz   ──────►  deploy.yml
                + .sha256                  (public download)   node scripts/fetch-axiobyte.mjs
                                                               → verify sha256 → public/axiobyte/
                                                               → astro build (hub pages read
                                                                 manifest.json) → pagefind
                                                               → check-links → GitHub Pages
                                                                        │
                                                                        ▼
                                              https://ajay3007.github.io/axiobyte/
                                              https://ajay3007.github.io/axiobyte/networking/
                                              https://ajay3007.github.io/axiobyte/networking/nic/
```

- **Nothing built is committed anywhere.** The website fetches a released build at deploy time;
  `public/axiobyte/` is gitignored there.
- **Every website build is reproducible.** It pins an exact tag *and* its sha256; a release asset
  that changed would fail the build rather than ship.
- **No secrets.** The release is created with the workflow's own `GITHUB_TOKEN`; the website
  downloads a public asset anonymously.

## Local development

```bash
# this repo
npm ci
abs web dev                      # experiences, live → http://localhost:5173/networking/nic/
abs web build && abs web test    # production build, smoke-tested under /axiobyte/

# the website, against that local build (no release needed)
cd ../Ajay3007.github.io
AXIOBYTE_LOCAL=../axiobyte-studio/experiences/dist npm run axiobyte
npm run dev                      # → http://localhost:4321/axiobyte/
```

## Releasing a new version of the experiences

1. Bump `experiences/package.json` → `"version": "X.Y.Z"` and commit it to `main`.
2. `git tag experiences-vX.Y.Z && git push origin experiences-vX.Y.Z`.
3. `three.yml` tests, builds and publishes the release. Its notes print the three values to pin.
4. In **Ajay3007.github.io**, set `axiobyte.json` → `tag`, `asset`, `sha256`, and push to
   `master`. `deploy.yml` fetches, verifies, builds and publishes.

Step 4 is a one-line, reviewable change on purpose: the site never changes unless its own
history says so. (It can be automated later — see below.)

## What you must configure by hand

| Where | Setting | Why |
|---|---|---|
| Ajay3007.github.io → Settings → Pages | Source: **GitHub Actions** (already set) | `deploy.yml` publishes with `deploy-pages` |
| axiobyte-studio → Settings → Actions → General | Workflow permissions may stay **read-only** | `three.yml` asks for `contents: write` only in its release job |
| — | **No secrets** | the default flow needs none |

### Optional: automatic pin bump

If a release should open the website PR itself, add a job to `three.yml` that edits
`axiobyte.json` in Ajay3007.github.io and opens a pull request. That needs a
**fine-grained personal access token** scoped to *only* `Ajay3007/Ajay3007.github.io`, with
*Contents: read and write* and *Pull requests: read and write*, stored in this repository as the
secret `SITE_REPO_TOKEN`. Not set up; nothing here depends on it.

## The film is not deployed this way

Videos are publishing output (YouTube, or a release asset), not part of the site build.
`abs render` + `abs compose` produce `episodes/<id>/out/<id>.mp4`; an experience links to its
video through the optional `"video"` field in `experience.json`, and the hub shows it.
