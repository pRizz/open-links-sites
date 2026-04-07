# Coding and Architecture Requirements Audit Trail

<!-- coding-and-architecture-requirements-managed-file: coding-and-architecture-requirements.audit.md -->

This file records that this repository is using the Bright Builds coding and architecture requirements and shows where the managed adoption files came from.

## Current installation

- Source repository: `https://github.com/bright-builds-llc/coding-and-architecture-requirements`
- Version pin: `main`
- Exact commit: `3694c498dde6c69345aed37a930a051794f93465`
- Canonical entrypoint: `https://github.com/bright-builds-llc/coding-and-architecture-requirements/blob/main/standards/index.md`
- Managed sidecar path: `AGENTS.bright-builds.md`
- AGENTS integration mode: `append-only managed block`
- Audit manifest path: `coding-and-architecture-requirements.audit.md`
- Auto-update: `enabled`
- Auto-update reason: `trusted repo owner pRizz`
- Last operation: `update`
- Last updated (UTC): `2026-04-07T14:40:15Z`

## Managed files

- `AGENTS.md (managed block)`
- `AGENTS.bright-builds.md`
- `CONTRIBUTING.md`
- `.github/pull_request_template.md`
- `coding-and-architecture-requirements.audit.md`
- `README.md (managed badges block)`
- `scripts/bright-builds-auto-update.sh`
- `.github/workflows/bright-builds-auto-update.yml`

## Why this exists

- It provides a visible paper trail for install, update, and uninstall operations.
- The installer manages a bounded block inside `AGENTS.md`, a bounded README badge block when applicable, and marked whole-file managed surfaces such as the sidecar, audit trail, contribution guide, PR template, and optional auto-update files.
- `standards-overrides.md` remains repo-local and is preserved during update and uninstall.
- It helps humans and tools debug which standards revision a repository is pinned to.
