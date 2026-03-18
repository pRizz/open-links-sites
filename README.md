# open-links-sites

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
bun run manage:person -- --help
bun run scaffold:person -- --id alice-example --name "Alice Example"
bun run materialize:person -- --id alice-example
bun run build:person:site -- --id alice-example
bun run build:site
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

1. `bun run manage:person -- import --source-url "<linktree-like-url>"` crawls a source page and extracts profile/link candidates.
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

## Multi-Site Build Foundation

Phase 4 adds the first centralized site-generation layer on top of the existing
materialize/import contract:

1. `bun run build:person:site -- --id <id>` materializes one active person and
   asks the upstream `open-links` repo to build a self-contained site under
   `generated/site/<id>/`.
2. `bun run build:site` builds every active person into `generated/site/<id>/`
   and also generates the root landing page at `generated/site/index.html`.
3. Disabled or archived people are omitted from generated output.

The upstream renderer stays canonical for person pages. This repo owns the thin
orchestration layer around it plus the root landing page.

Selective-build helpers are now available too:

```bash
bun run changed:people -- --base-ref HEAD~1
bun run build:site -- --changed-paths-file .cache/changed-paths.txt --public-origin "https://USER.github.io/open-links-sites"
bun run deploy:pages:plan -- --site-dir generated/site --public-origin "https://USER.github.io/open-links-sites"
```

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

That workflow:

1. checks out this repo plus upstream `open-links`
2. refreshes `config/upstream-open-links.json` when upstream has moved
3. runs `bun run check` and `bun run validate`
4. commits and pushes one consolidated sync commit to `main` only if verification passed
