# open-links-sites

[![OpenLinks Site](https://openlinks.us/badges/openlinks.svg)](https://openlinks.us/)

`open-links-sites` is the control repo for many individual OpenLinks sites.
It keeps per-person source data in one place, then later phases build and deploy
path-based multi-site output through the upstream
[open-links](https://github.com/pRizz/open-links) runtime.

## Phase 1 Contract

Every managed person lives under `people/<id>/` and follows one canonical source
shape:

```text
people/
  <id>/
    person.json
    profile.json
    links.json
    site.json
    assets/
```

- `person.json` stores orchestration metadata for this repo.
- `profile.json`, `links.json`, and `site.json` mirror upstream OpenLinks as
  closely as possible.
- Person-specific assets stay inside `people/<id>/assets/`.
- Generated workspaces live under `generated/` and are never hand-edited.

## Repo Layout

```text
.
├── .agents/
├── generated/
├── people/
├── schemas/
├── scripts/
│   └── lib/
└── templates/
    └── default/
```

## Tooling

This repo uses Bun + TypeScript so the operator, validation, and materialization
scripts can stay close to the upstream `open-links` toolchain.

```bash
bun install
bun run typecheck
bun test
bun run validate
bun run preview
bun run dev
bun run manage:person -- --help
bun run refresh:people:caches -- --person staci-costopoulos
bun run refresh:people:caches -- --all
bun run scaffold:person -- --id alice-example --name "Alice Example"
bun run materialize:person -- --id alice-example
bun run build:person:site -- --id alice-example
bun run build:site
OPEN_LINKS_SITES_PUBLIC_ORIGIN="https://USER.github.io/open-links-sites" bun run release:verify
```

## Source Of Truth

The Phase 1 contract is defined in:

- `schemas/person.schema.json`
- `schemas/upstream/*.schema.json`
- `templates/default/*.json`
- `scripts/lib/person-contract.ts`

Later phases will add validation, scaffold flows, and generated per-person
workspaces on top of this contract.

## Preferred CRUD Surface

The preferred operator workflow is the repo-local `manage-person` skill at:

- `.agents/skills/manage-person/SKILL.md`

That skill drives the underlying CLI surface:

```bash
bun run manage:person -- <action> [options]
```

Supported actions:

- `create`
- `import`
- `update`
- `disable`
- `archive`

Phase 2/3 examples:

```bash
bun run manage:person -- create --name "Alice Example"
bun run manage:person -- create --name "Bob Example" --seed-url "https://linktr.ee/bob"
bun run manage:person -- import --source-url "https://linktr.ee/alice"
bun run manage:person -- import --person "alice-example" --manual-links $'GitHub https://github.com/alice\nWebsite https://alice.dev'
bun run manage:person -- import --person "alice-example" --source-url "https://linktr.ee/alice" --full-refresh
bun run manage:person -- update --person "alice-example" --headline "Builder and operator"
bun run manage:person -- update --person "Alice Example" --site-title "Alice Example | Links"
bun run manage:person -- disable --person "alice-example" --confirm
bun run manage:person -- archive --person "alice-example" --confirm --reason "Offboarded"
```

Direct JSON editing remains the low-level fallback, not the preferred CRUD path.

## Foundation Flow

Phase 1 establishes a deterministic low-level flow:

1. `bun run scaffold:person -- --id <id> --name "<Name>"` creates `people/<id>/`
   from the default templates and copies placeholder assets.
2. `bun run validate` checks structure, schema compatibility, asset isolation,
   and placeholder guidance.
3. `bun run materialize:person -- --id <id>` writes a disposable
   `generated/<id>/` workspace with `data/*.json` and staged public assets.

## Import And Enrichment

Phase 3 extends `manage-person` into the migration/bootstrap path:

1. `bun run manage:person -- import --source-url "<linktree-url>"` calls the upstream `open-links` Linktree extractor and imports profile, social-link, and content-link candidates.
2. `bun run manage:person -- import --manual-links "<freeform text>"` normalizes pasted URLs when there is no crawlable source.
3. Imported data merges conservatively: curated source-of-truth data wins, placeholder scaffold content is replaced, source order is preserved, and obvious duplicate URLs are skipped.
4. After source write, the repo materializes `generated/<id>/`, runs upstream `open-links` enrichment/cache scripts there, then syncs stable artifacts back into `people/<id>/cache/`.

Per-person helper artifacts now live alongside the canonical files:

```text
people/
  <id>/
    cache/
      rich-metadata.json
      rich-enrichment-report.json
      rich-public-cache.json
      profile-avatar.json
      profile-avatar.runtime.json
      content-images.json
      content-images.runtime.json
      profile-avatar/
      content-images/
      rich-authenticated/
    imports/
      source-snapshot.json
      last-import.json
```

These helper artifacts support incremental reruns. They do not replace the canonical required files under `people/<id>/`.

## Cache-Only Refresh

The cache-refresh surface rebuilds helper caches without rerunning the full
`manage:person import` mutation path:

```bash
bun run refresh:people:caches -- --person staci-costopoulos
bun run refresh:people:caches -- --all
```

Behavior:

1. The command materializes each selected active person into `generated/<id>/`.
2. It runs the upstream enrichment/cache steps with a forced refresh.
3. It syncs only `people/<id>/cache/**` back into the repo.
4. Disabled or archived people are skipped during `--all` refreshes.
5. Targeted refreshes require an active person.
6. The command exits non-zero if any selected person's refresh fails.

Safety contract:

- allowed writes: `people/<id>/cache/**`
- blocked writes: `people/<id>/person.json`, `profile.json`, `links.json`, `site.json`
- any out-of-scope write is treated as a blocking failure and the person is
  restored to its pre-refresh state before the command exits

## Multi-Site Build Foundation

Phase 4 adds the first centralized site-generation layer on top of the existing
materialize/import contract:

1. `bun run build:person:site -- --id <id>` materializes one active person and
   asks the upstream `open-links` repo to build a self-contained site under
   `generated/site/<id>/`.
2. `bun run build:site` builds every active person into `generated/site/<id>/`
   and also generates the root landing page at `generated/site/index.html`.
3. Disabled or archived people are omitted from generated output.
4. `bun run preview` runs a full local build once and serves `generated/site/`
   at `http://127.0.0.1:4173/` by default for browser checks.
5. `bun run dev` is a convenience alias for the same preview flow; it does not
   currently run a watch or hot-reload loop.

The upstream renderer stays canonical for person pages. This repo owns the thin
orchestration layer around it plus the root landing page.

Selective-build helpers are now available too:

```bash
bun run changed:people -- --base-ref HEAD~1
bun run build:site -- --changed-paths-file .cache/changed-paths.txt --public-origin "https://USER.github.io/open-links-sites"
bun run build:site -- --public-origin "https://links.example.com"
bun run build:site -- --public-origin "https://cdn.example.com/apps/links" --canonical-origin "https://links.example.com/apps/links"
bun run deploy:pages:plan -- --site-dir generated/site --public-origin "https://USER.github.io/open-links-sites"
```

Supported deployment shapes:

- GitHub Pages project path: `--public-origin "https://USER.github.io/open-links-sites"`
- Custom-domain root deploy: `--public-origin "https://links.example.com"`
- Arbitrary subpath deploy with separate canonical origin: `--public-origin "https://cdn.example.com/apps/links" --canonical-origin "https://links.example.com/apps/links"`

## Autonomous Upstream Sync

Phase 5 starts tracking the upstream `open-links` revision explicitly in:

- `config/upstream-open-links.json`

That file is the pinned upstream contract for release operations. The first
automation entrypoint is:

```bash
bun run sync:upstream -- --root "$PWD"
```

By default it compares the tracked upstream commit to the currently resolved
`open-links` checkout, updates the tracked state file when upstream has moved,
and prints a stage-based summary. It never pushes by itself.

The scheduled workflow for this lives at:

- `.github/workflows/upstream-sync.yml`

That workflow runs every hour and starts with a cheap `git ls-remote`
preflight against `pRizz/open-links` `main`. If the pinned commit already
matches upstream, it exits before cloning upstream or installing dependencies.

When upstream has moved, it:

1. checks out this repo plus upstream `open-links`
2. refreshes `config/upstream-open-links.json` when upstream has moved
3. runs `bun run check` and `bun run validate`
4. commits and pushes one consolidated sync commit to `main` only if verification passed

The main deploy workflow now also treats that file as build-relevant input:

- push-triggered deploys build against the pinned upstream commit from `config/upstream-open-links.json`
- nightly scheduled deploys rebuild current `main` against that same pinned upstream commit and only deploy when `deploy-manifest.json` differs from the live Pages site

## Daily Cache Refresh

Rich-profile cache refresh now has its own daily workflow:

- `.github/workflows/refresh-people-caches.yml`

That workflow:

1. checks out this repo plus the pinned upstream `open-links` commit
2. runs `bun run refresh:people:caches -- --all`
3. runs `bun run check`, `bun run validate`, and `bun run release:verify`
4. commits only `people/*/cache/**` when cache artifacts changed
5. manually dispatches `deploy.yml` after a successful cache-only push because
   pushes made with `GITHUB_TOKEN` do not trigger downstream workflows

## Release Verification

Phase 5 also adds one shared release gate:

```bash
bun run release:verify -- --root "$PWD" --public-origin "https://USER.github.io/open-links-sites"
bun run release:verify -- --root "$PWD" --public-origin "https://cdn.example.com/apps/links" --canonical-origin "https://links.example.com/apps/links"
```

That command is now reused by both scheduled upstream sync and the deploy
workflow. It runs:

1. `bun run check`
2. `bun run validate`
3. a Pages-ready site build for the current mode
4. Pages artifact planning
5. lightweight smoke checks against `generated/site/`

Deployment notes:

- `publicOrigin` controls emitted asset URLs and the path where the site is actually served.
- `canonicalOrigin` is optional and defaults to `publicOrigin`.
- Person builds now emit deployment-safe manifests with relative icon paths, so the same output works on GitHub Pages, custom domains, and arbitrary reverse-proxied subpaths.

Operational posture for v1:

- relevant release workflows share the same non-overlap concurrency group
- failures stop before publish and surface in concise stage-based summaries
- recovery is fix-forward on `main`; no automatic rollback is attempted
