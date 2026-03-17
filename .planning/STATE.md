# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** I can onboard or update a person's OpenLinks site with minimal manual editing, and the repo reliably handles extraction, generation, and centralized deployment for me.
**Current focus:** Phase 5 - Autonomous Upstream Sync and Release Ops

## Current Position

Phase: 5 of 5 (Autonomous Upstream Sync and Release Ops)
Plan: 0 of 3 in current phase
Status: Ready for context
Last activity: 2026-03-17 — Completed Phase 4 selective build/deploy implementation and verification

Progress: [████████░░] 80%

## Performance Metrics

- Total plans completed: 12
- Average duration: 30s
- Total execution time: 0.0 hours

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Initialization: Keep this repo as a thin orchestrator around upstream `open-links`.
- Initialization: Optimize v1 for a single engineer managing many people through guided automation.
- Phase 1: Use `people/*/person.json` discovery with required canonical files and per-person asset isolation.
- Phase 1: Keep public content files upstream-compatible and push shared content validation upstream over time.
- Phase 1: Keep starter JSON tokenized under `templates/default/` and route all later file creation through the shared contract module.
- Phase 1: Validate against vendored upstream content schemas while preserving local `assets/...` source references through explicit normalization.
- Phase 1: Use `generated/<id>/` as the disposable workspace boundary for translated `data/*.json` and staged public assets.
- Phase 2: Use one primary guided skill as the operator surface, with CLI commands underneath it.
- Phase 2: Keep create low-friction and write-first, then show validation-backed remediation summaries instead of forcing pre-write confirmation.
- Phase 2: Keep update flows task-based and scoped tightly to the requested change.
- Phase 2: Treat disable/archive as metadata state changes that preserve source folders, with archived people hidden by default.
- Phase 2: Require one explicit confirmation for status-changing lifecycle writes while keeping create/update write-first.
- Phase 3: Extend `manage-person` with import/bootstrap actions instead of creating a separate primary surface.
- Phase 3: Import should fill blanks, preserve source order, and avoid overwriting curated existing data by default.
- Phase 3: Run full upstream person-level enrichment automatically after intake, but skip unsupported domains with remediation instead of failing the whole import.
- Phase 3: Keep useful partial imports and enrichment outputs when possible, and reserve hard failure for fully blocked runs.
- Phase 3: Persist per-person helper cache and import artifacts under `people/<id>/cache/` and `people/<id>/imports/`, then replay them into `generated/<id>/` for upstream reruns.
- Phase 3: Keep the upstream integration thin by invoking upstream script files against generated workspaces instead of reimplementing enrichment locally.
- Phase 4: Build person pages by staging each materialized workspace into a temporary upstream `open-links` build root, keeping upstream rendering canonical without patching upstream source imports.
- Phase 4: Keep the root landing page local to this repo with isolated `landing-assets/` output under `generated/site/`.
- Phase 4: Detect changed people from git paths, restore the current live Pages artifact before targeted overlays, and fail open to a full rebuild when selection confidence is low.
- Phase 4: Finalize `generated/site/` with `deploy-manifest.json` and skip Pages deploys cleanly when the live manifest already matches the built artifact.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 5 needs a safe direct-to-main upstream sync flow that keeps the new selective Pages build/deploy path predictable in CI.

## Session Continuity

Last session: 2026-03-17 10:02
Stopped at: Phase 5 ready for context
Resume file: .planning/phases/04-selective-multi-site-build-and-deploy/04-VERIFICATION.md
