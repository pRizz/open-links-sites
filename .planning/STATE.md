# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** I can onboard or update a person's OpenLinks site with minimal manual editing, and the repo reliably handles extraction, generation, and centralized deployment for me.
**Current focus:** Phase 2 - Guided Operator CRUD

## Current Position

Phase: 2 of 5 (Guided Operator CRUD)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-03-17 — Captured Phase 2 context decisions for planning

Progress: [██░░░░░░░░] 20%

## Performance Metrics

- Total plans completed: 3
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

### Pending Todos

None yet.

### Blockers/Concerns

- Upstream still expects URI-shaped avatar and media fields; later phases should preserve or remove the current explicit materialization-time translation boundary intentionally.

## Session Continuity

Last session: 2026-03-17 03:09
Stopped at: Phase 2 context gathered
Resume file: .planning/phases/02-guided-operator-crud/02-CONTEXT.md
