# open-links-sites

## What This Is

`open-links-sites` is a control repo for managing many individual OpenLinks sites from one place. It stores per-person content and deployment metadata, bootstraps new people with minimal manual input, and uses automation to generate and deploy centralized path-based sites on GitHub Pages via the upstream `open-links` runtime.

The repo is intentionally thin: `open-links` remains the rendering/build system, while this repo owns person-level data, migration/bootstrap workflows, validation, orchestration, and deployment.

## Core Value

I can onboard or update a person's OpenLinks site with minimal manual editing, and the repo reliably handles extraction, generation, and centralized deployment for me.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Bootstrap a new person through a top-level skill or script that asks for minimal inputs and scaffolds the required repo structure.
- [ ] Import an existing Linktree-style page by crawling public data, extracting links and metadata, and seeding person files with as much useful information as possible.
- [ ] Run upstream `open-links` extractors and caching flows to enrich imported person data instead of maintaining a second extraction system.
- [ ] Store each person in an isolated, self-contained folder with separate orchestration metadata and site content.
- [ ] Validate person data and generate centralized path-based multi-site output for enabled people from one deployment.
- [ ] Automatically apply upstream `open-links` updates on a daily cadence, fail fast on breakage, and deploy site deltas through GitHub Actions.

### Out of Scope

- Custom domains — centralized path-based deployment is the v1 target.
- Per-person repos — a single control repo is simpler to operate and update.
- Web admin UI — v1 is intentionally engineer-operated through repo workflows and skills.
- Non-Git editing — the source of truth stays version-controlled in the repo.
- Ongoing third-party sync from Linktree-like services — v1 import is for bootstrap/migration, not continuous mirroring.

## Context

This project is a companion repo to `open-links`, which already follows a developer-first, version-controlled content model and already has validation plus GitHub Actions deployment patterns. The new repo should stay conceptually aligned with the upstream split between public profile content, public links, and site-level configuration, while adding a per-person orchestration layer for deployment and ownership metadata.

The initial operating model is single-maintainer: one engineer managing many people. That makes automation and low-touch onboarding more important than end-user editing workflows. The ideal experience is to run a repo-local skill, provide basic information such as the person's name and existing Linktree-like URL or link list, let the repo crawl and extract as much as possible, enrich the data through upstream `open-links` extractors, and then have GitHub Actions validate, build, and deploy if anything changed.

Daily upstream updates are part of the product shape, not a maintenance afterthought. This repo should be able to consume `open-links` in a way that supports automatic main-branch updates and fast recovery when upstream changes break orchestration. Because both repos are under the same ownership, cross-repo changes are acceptable when they simplify the overall system.

## Constraints

- **Operator model**: Engineer-operated only in v1 — there is no requirement for non-technical editing flows yet.
- **Deployment topology**: Centralized path-based multi-site output — v1 deploys many people from one GitHub Pages target.
- **Automation**: Daily autonomous upstream updates and nightly deploy behavior — the system should push directly to `main` and surface failures immediately.
- **Manual effort**: Minimize hand-editing of JSON or other repo files — onboarding and updates should be skill/script driven wherever possible.
- **Architecture**: Thin orchestrator over upstream `open-links` — reuse the upstream runtime, build system, extractors, and cache flows rather than forking them locally.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep `open-links` as the runtime/build system and make this repo a thin orchestrator | Reuses the existing data-driven build/deploy model and avoids duplicating the app layer | — Pending |
| Organize data as `people/<id>/...` with self-contained assets and a separate `person.json` | Improves reviewability, isolation, automation targeting, and future extensibility | — Pending |
| Target centralized path-based multi-site deployment for v1 | Simplest infrastructure and operations model for one maintainer managing many sites | — Pending |
| Prioritize skill/script-driven onboarding and migration over manual editing | The main product value is reducing repetitive operator work | — Pending |
| Apply upstream `open-links` updates automatically on a daily cadence directly to `main` | The owner controls both repos and prefers fast-forward automation with fast failure visibility | — Pending |

---
*Last updated: 2026-03-17 after initialization*
