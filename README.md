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
```

## Source Of Truth

The Phase 1 contract is defined in:

- `schemas/person.schema.json`
- `templates/default/*.json`
- `scripts/lib/person-contract.ts`

Later phases will add validation, scaffold flows, and generated per-person
workspaces on top of this contract.
