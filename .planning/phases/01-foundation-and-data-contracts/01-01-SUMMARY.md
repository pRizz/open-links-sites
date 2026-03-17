---
phase: 01-foundation-and-data-contracts
plan: 01
subsystem: infra
tags: [bun, typescript, templates, schemas, contract]
requires: []
provides:
  - Canonical per-person file and directory contract for `people/<id>/`
  - Reusable default templates for `person.json`, `profile.json`, `links.json`, and `site.json`
  - Bun + TypeScript tooling baseline for later validator and scaffold scripts
affects: [01-02, 01-03, phase-2-crud]
tech-stack:
  added: [bun, typescript, biome]
  patterns: [central-contract-module, tokenized-json-templates, local-asset-placeholder]
key-files:
  created:
    - package.json
    - tsconfig.json
    - biome.json
    - schemas/person.schema.json
    - scripts/lib/person-contract.ts
    - scripts/lib/person-contract.test.ts
    - templates/default/person.json
    - templates/default/profile.json
    - templates/default/links.json
    - templates/default/site.json
  modified:
    - README.md
    - .gitignore
key-decisions:
  - "Kept the repo on Bun + TypeScript to stay aligned with upstream open-links tooling."
  - "Stored starter JSON as tokenized templates so later scaffold flows can fill deterministic defaults instead of hand-authoring files."
  - "Used a local `assets/avatar-placeholder.svg` reference in `profile.json`, keeping the upstream avatar URI mismatch explicit for later validation/materialization work."
patterns-established:
  - "Contract-first foundation: later scripts must import `scripts/lib/person-contract.ts` instead of re-deriving paths or filenames."
  - "Template-driven scaffolding: starter JSON is defined once under `templates/default/` and hydrated through explicit token replacement."
requirements-completed: [DATA-01, OPER-02]
duration: 1m 16s
completed: 2026-03-17
---

# Phase 1 Plan 01: Define the canonical person file layout, manifest fields, and template defaults Summary

**Bun tooling, tokenized starter templates, and a single contract module for per-person OpenLinks source folders**

## Performance

- **Duration:** 1m 16s
- **Started:** 2026-03-17T07:45:54Z
- **Completed:** 2026-03-17T07:47:10Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments
- Bootstrapped the repo as a Bun + TypeScript tooling project with deterministic package metadata, lockfile, and baseline directories.
- Defined one authoritative source contract in `scripts/lib/person-contract.ts` plus a repo-local `person.json` schema.
- Added reusable default templates, including a placeholder avatar asset, and pinned the contract with focused tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bootstrap the repo runtime and canonical directory layout** - `bdd15c8` (chore)
2. **Task 2: Codify the person contract and default templates** - `464e2ba` (feat)
3. **Task 3: Add contract-level tests and invariants for later plans** - `1f915bc` (test)

**Plan metadata:** pending

## Files Created/Modified
- `package.json` - Bun/TypeScript/biome tooling baseline for later scripts.
- `tsconfig.json` - Shared compiler settings for CLI and test code.
- `biome.json` - Formatting and lint configuration for repository scripts.
- `schemas/person.schema.json` - Repo-local orchestration schema for `person.json`.
- `scripts/lib/person-contract.ts` - Canonical file, directory, discovery, and template contract.
- `scripts/lib/person-contract.test.ts` - Invariants for IDs, paths, and template hydration.
- `templates/default/person.json` - Tokenized orchestration starter template.
- `templates/default/profile.json` - Upstream-aligned profile starter with explicit local avatar placeholder.
- `templates/default/links.json` - Valid one-link starter shape for future migrations.
- `templates/default/site.json` - Strong default site config with path-based base URL token.
- `templates/default/assets/avatar-placeholder.svg` - Default local avatar asset copied into scaffolded people later.
- `README.md` - Repo-root documentation for the Phase 1 source contract.
- `.gitignore` - Ignore rules for dependencies, caches, and generated outputs.

## Decisions Made
- Stayed on Bun + TypeScript instead of introducing a second runtime stack, because the control repo will depend directly on upstream `open-links` scripts and schemas.
- Kept starter `profile.json` on a local asset reference (`assets/avatar-placeholder.svg`) and made that divergence explicit in the contract instead of hiding it behind an implicit conversion.
- Added a real placeholder avatar asset so scaffolded people can be structurally complete without requiring an immediate manual asset drop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored broad ignore coverage after bootstrap**
- **Found during:** Post-task review
- **Issue:** The initial bootstrap edit replaced the existing stock Node/TS ignore rules with a much narrower file, which would have exposed caches, build output, and local tooling state to git.
- **Fix:** Restored the useful ignore patterns and kept the new `generated/*` handling layered on top.
- **Files modified:** `.gitignore`
- **Verification:** Reviewed the previous tracked ignore file and confirmed the restored rules still preserve `generated/.gitkeep`.
- **Committed in:** `cde168a`

---

**Total deviations:** 1 auto-fixed (1 rule-1 bug)
**Impact on plan:** No scope creep. The fix preserved the intended bootstrap outcome and prevented repository hygiene regressions.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
`01-02` can now build discovery and validation on top of one tested contract module and one starter template set.

The remaining explicit boundary is local asset references such as `profile.avatar`. Validation and materialization must preserve this source-repo convention while staying compatible with upstream `open-links` expectations.

## Self-Check: PASSED

---
*Phase: 01-foundation-and-data-contracts*
*Completed: 2026-03-17*
