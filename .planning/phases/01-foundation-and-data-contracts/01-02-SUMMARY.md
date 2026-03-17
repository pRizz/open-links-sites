---
phase: 01-foundation-and-data-contracts
plan: 02
subsystem: infra
tags: [validation, ajv, schemas, cli, fixtures]
requires:
  - phase: 01-foundation-and-data-contracts
    provides: Canonical person contract, starter templates, and tested path conventions
provides:
  - Deterministic `people/*/person.json` discovery
  - Structural and schema validation for person folders
  - Human-readable and JSON validation output with remediation guidance
affects: [01-03, phase-2-crud, phase-4-deploy]
tech-stack:
  added: [ajv, ajv-formats]
  patterns: [vendored-upstream-schemas, local-asset-normalization, realistic-temp-fixtures]
key-files:
  created:
    - schemas/upstream/profile.schema.json
    - schemas/upstream/links.schema.json
    - schemas/upstream/site.schema.json
    - scripts/lib/person-discovery.ts
    - scripts/lib/validate-person.ts
    - scripts/lib/validation-output.ts
    - scripts/validate.ts
    - scripts/validate.test.ts
  modified:
    - scripts/lib/person-contract.ts
    - package.json
    - README.md
key-decisions:
  - "Vendored snapshots of the upstream content schemas so local validation stays self-contained and deterministic."
  - "Normalized local `assets/...` references to synthetic HTTPS URLs only for schema validation, while enforcing the real asset-path rules separately."
  - "Kept placeholder values valid-but-visible through warnings and suggestions instead of silently rewriting them."
patterns-established:
  - "Schema boundary pattern: validate against upstream schema snapshots and layer repo-local structural rules around them."
  - "Operator-friendly validation pattern: machine-readable JSON output mirrors the same problem, warning, and suggestion model as human output."
requirements-completed: [DATA-02, DATA-03]
duration: 8s
completed: 2026-03-17
---

# Phase 1 Plan 02: Implement schema and structural validation for people, assets, and naming rules Summary

**Ajv-backed person validation with deterministic discovery, local-asset safety checks, and dual human/JSON output**

## Performance

- **Duration:** 8s
- **Started:** 2026-03-17T07:52:22Z
- **Completed:** 2026-03-17T07:52:30Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Added deterministic discovery for `people/*/person.json` and hard structural checks for required files, asset directories, and folder/id alignment.
- Reused vendored upstream OpenLinks schemas for `profile.json`, `links.json`, and `site.json` instead of inventing a second content schema.
- Added a real validation CLI with human and JSON output plus realistic end-to-end fixture coverage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build person discovery and structural validation** - `d79f7ae` (feat)
2. **Task 2: Add upstream-compatible content validation and remediation output** - `b5da019` (feat)
3. **Task 3: Cover valid and invalid fixtures end-to-end** - `7f10b21` (test)

**Plan metadata:** pending

## Files Created/Modified
- `schemas/upstream/profile.schema.json` - Local snapshot of the upstream profile schema.
- `schemas/upstream/links.schema.json` - Local snapshot of the upstream links schema.
- `schemas/upstream/site.schema.json` - Local snapshot of the upstream site schema.
- `scripts/lib/person-discovery.ts` - Scans `people/*/person.json` deterministically.
- `scripts/lib/validate-person.ts` - Structural, asset, placeholder, and schema validation engine.
- `scripts/lib/validation-output.ts` - Shared problem/warning/suggestion result model and formatters.
- `scripts/validate.ts` - CLI entrypoint for local and CI validation runs.
- `scripts/validate.test.ts` - Realistic temp-workspace coverage for valid and invalid person folders.
- `scripts/lib/person-contract.ts` - Expanded with asset normalization helpers for validation.
- `package.json` - Added the `validate` script entrypoint.
- `README.md` - Documented validation as part of the foundation workflow.

## Decisions Made
- Brought the upstream content schemas into this repo as snapshots so validation does not depend on a sibling checkout or live network fetch.
- Preserved local asset references in source data and only translated them to synthetic URIs inside the validator, keeping the compatibility boundary explicit.
- Treated unresolved placeholders as guidance instead of failures, while still failing hard on broken structure, bad schema shape, or asset isolation violations.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
`01-03` can now scaffold a real person folder and immediately validate it through `bun run validate`.

The main boundary to preserve is the validator's local-asset compatibility layer. Materialization should either reuse that translation step or make its own equivalent explicit.

## Self-Check: PASSED

---
*Phase: 01-foundation-and-data-contracts*
*Completed: 2026-03-17*
