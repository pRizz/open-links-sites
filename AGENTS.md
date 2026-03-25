<!-- coding-and-architecture-requirements-managed:begin -->
# Bright Builds Standards

- Study `AGENTS.bright-builds.md` as part of the repository instructions.
- Maintain and study a `## Repo-Local Guidance` section elsewhere in this file for recurring repo-specific workflow facts, commands, and links.
- Study `standards-overrides.md` for deliberate repo-specific exceptions and override decisions.
- If instructions elsewhere in `AGENTS.md` conflict with `AGENTS.bright-builds.md`, follow the repo-local instructions and treat them as an explicit local exception.
<!-- coding-and-architecture-requirements-managed:end -->

## Cursor Cloud specific instructions

### Overview

`open-links-sites` is a control repo that manages per-person OpenLinks link pages. It orchestrates the upstream [`open-links`](https://github.com/pRizz/open-links) renderer to build static sites deployed to GitHub Pages. Tech stack: Bun 1.3.9, TypeScript 5.9, SolidJS (landing page), Vite 7, Biome (lint/format).

### External dependency: upstream `open-links` repo

Many commands (`bun run dev`, `bun run build:site`, `bun run build:person:site`, import/enrichment, cache refresh) require a local checkout of `pRizz/open-links`. The pinned commit is tracked in `config/upstream-open-links.json`. Resolution order: `OPEN_LINKS_REPO_DIR` env var, `~/Repos/open-links`, `~/open-links`. The env var is set in `~/.bashrc` pointing to `~/Repos/open-links`.

### Key commands

All commands are documented in `README.md`. Quick reference:

- `bun run check` — combined typecheck + lint + test (CI-equivalent gate)
- `bun run validate` — validates all person data against JSON schemas
- `bun run dev` / `bun run preview` — builds all person sites + landing page, serves at `http://127.0.0.1:4173/`
- `bun run manage:person -- <action> [options]` — preferred CRUD surface for person management

### Caveats

- `bun run dev` does a one-shot build then serves; there is no watch/hot-reload. Restart the server after changes.
- The `generated/` directory is gitignored and created at build time; do not hand-edit it.
- No databases, Docker, or external services needed — everything is file-based and static.
