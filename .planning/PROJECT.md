# open-links-sites

## What This Is

`open-links-sites` is a control repo for managing many individual OpenLinks sites from one place. It stores per-person content and deployment metadata, bootstraps new people with minimal manual input, and uses automation to generate and deploy centralized path-based sites on GitHub Pages via the upstream `open-links` runtime.

The repo is intentionally thin: `open-links` remains the rendering/build system, while this repo owns person-level data, migration/bootstrap workflows, validation, orchestration, and deployment.

## Core Value

I can onboard or update a person's OpenLinks site with minimal manual editing, and the repo reliably handles extraction, generation, and centralized deployment for me.

## Current State

- Shipped `v1.0 Control Repo MVP` on 2026-03-18.
- The repo now includes the canonical `people/<id>/` contract, guided `manage-person` CRUD and import flows, upstream-compatible enrichment and cache persistence, centralized multi-site Pages builds, and autonomous upstream sync plus release verification.
- Current stack: Bun + TypeScript orchestration scripts, vendored schema validation, a local SolidJS landing page, GitHub Actions deployment workflows, and upstream `open-links` as the canonical renderer and extractor runtime.

## Requirements

### Validated

- ✓ Bootstrap and manage people through guided repo-local workflows instead of manual JSON editing — `v1.0`
- ✓ Import Linktree-style pages or pasted manual links, then enrich them through upstream `open-links` flows — `v1.0`
- ✓ Store each person in an isolated validated source folder with separate orchestration and public content files — `v1.0`
- ✓ Generate centralized path-based multi-site output and deploy it through one GitHub Pages target — `v1.0`
- ✓ Keep the repo synchronized with upstream `open-links` and fail fast on broken release automation — `v1.0`

### Active

- [ ] Define the next milestone from real operator usage and the residual risks recorded in `milestones/v1.0-MILESTONE-AUDIT.md`.
- [ ] Decide whether the next milestone should focus on richer operator UX, stronger import coverage, or expanded deployment capabilities.
- [ ] Convert selected v2 candidate features into fresh milestone-scoped requirements with `$gsd-new-milestone`.

### Out of Scope

- Custom domains — not part of shipped v1 unless a later milestone explicitly promotes them.
- Per-person repos — the centralized control repo remains the simpler operating model.
- Web admin UI — deferred until a future milestone chooses to prioritize it.
- Non-Git editing — version-controlled files remain the source of truth for now.
- Ongoing third-party sync from Linktree-like services — bootstrap import is still sufficient today.

## Context

This repo shipped its first milestone as a thin orchestrator around upstream `open-links`. It now has 5 completed phases, 15 completed plans, and a passed milestone audit covering 16 v1 requirements.

The operating model is still single-maintainer: one engineer managing many people. The shipped workflow is intentionally repo-driven and low-touch. The operator can create or import a person, let the repo enrich and cache the data through upstream flows, and rely on centralized CI plus release automation to validate, build, and deploy changes.

The most important post-v1 context is operational rather than architectural. Residual risks are known and documented: provider-specific import depth may need to improve, selective deploy performance may eventually need optimization, and the shared `release:verify` gate should stay authoritative even if future work makes it faster.

## Constraints

- **Operator model**: Engineer-operated only in v1 — there is no requirement for non-technical editing flows yet.
- **Deployment topology**: Centralized path-based multi-site output — v1 deploys many people from one GitHub Pages target.
- **Automation**: Daily autonomous upstream updates and nightly deploy behavior — the system should push directly to `main` and surface failures immediately.
- **Manual effort**: Minimize hand-editing of JSON or other repo files — onboarding and updates should be skill/script driven wherever possible.
- **Architecture**: Thin orchestrator over upstream `open-links` — reuse the upstream runtime, build system, extractors, and cache flows rather than forking them locally.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep `open-links` as the runtime/build system and make this repo a thin orchestrator | Reuses the existing data-driven build/deploy model and avoids duplicating the app layer | ✓ Shipped in v1.0 |
| Organize data as `people/<id>/...` with self-contained assets and a separate `person.json` | Improves reviewability, isolation, automation targeting, and future extensibility | ✓ Shipped in v1.0 |
| Target centralized path-based multi-site deployment for v1 | Simplest infrastructure and operations model for one maintainer managing many sites | ✓ Shipped in v1.0 |
| Prioritize skill/script-driven onboarding and migration over manual editing | The main product value is reducing repetitive operator work | ✓ Shipped in v1.0 |
| Apply upstream `open-links` updates automatically on a daily cadence directly to `main` | The owner controls both repos and prefers fast-forward automation with fast failure visibility | ✓ Shipped in v1.0 |
| Use generated single-person workspaces as the shared seam for upstream import and build behavior | Keeps enrichment and rendering canonical without forking upstream logic locally | ✓ Shipped in v1.0 |
| Gate sync and deploy workflows behind one shared `release:verify` contract | Keeps “releasable” semantics consistent across daily sync and nightly deploy automation | ✓ Shipped in v1.0 |

## Next Milestone Goals

- Define the next milestone explicitly instead of carrying forward a generic v2 bucket.
- Choose whether the next phase of value should center on operator UX, richer source-specific extraction, or expanded deployment capabilities.
- Preserve the thin-orchestrator architecture and shared release gate while planning whatever comes next.

---
*Last updated: 2026-03-18 after v1.0 milestone completion*
