---
phase: 01-foundation-and-data-contracts
plan: 03
subsystem: infra
tags: [scaffold, materialize, generated-workspace, cli, assets]
requires:
  - phase: 01-foundation-and-data-contracts
    provides: Canonical contract, validated templates, and validation CLI
provides:
  - Deterministic person scaffolding from default templates
  - Disposable generated single-person workspaces under `generated/<id>/`
  - Tested scaffold -> validate -> materialize foundation flow
affects: [phase-2-crud, phase-3-import, phase-4-deploy]
tech-stack:
  added: []
  patterns: [template-hydration, validate-after-write, file-uri-materialization]
key-files:
  created:
    - scripts/lib/fill-templates.ts
    - scripts/scaffold-person.ts
    - scripts/lib/materialize-person.ts
    - scripts/materialize-person.ts
    - scripts/scaffold-person.test.ts
    - scripts/materialize-person.test.ts
  modified:
    - package.json
    - README.md
key-decisions:
  - "Kept Phase 1 scaffolding non-interactive and deterministic so later guided CRUD can build on a stable low-level primitive."
  - "Validated scaffolded output immediately after write and failed hard only on blocking problems, allowing placeholder warnings to remain visible."
  - "Materialized local asset references into file URIs inside generated workspaces so the source tree stays unchanged while the translation boundary remains explicit."
patterns-established:
  - "Scaffold-first operator flow: create the canonical folder, then let the validator surface remaining placeholder work."
  - "Generated-workspace isolation: source-of-truth stays in `people/`, disposable build inputs live under `generated/`."
requirements-completed: [OPER-02, DATA-01]
duration: 6s
completed: 2026-03-17
---

# Phase 1 Plan 03: Wire the repository foundation for generated output, validation entrypoints, and upstream integration boundaries Summary

**Deterministic person scaffolding and generated single-person workspaces built on top of the Phase 1 validator**

## Performance

- **Duration:** 6s
- **Started:** 2026-03-17T07:55:18Z
- **Completed:** 2026-03-17T07:55:24Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Added a low-level scaffold command that creates `people/<id>/` from templates and copies placeholder assets.
- Added materialization into `generated/<id>/` with `data/*.json` and staged public assets, keeping the source tree untouched.
- Proved the intended foundation flow with dedicated scaffold/materialize tests plus the exact root-level CLI commands from the plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement deterministic scaffolding from the default templates** - `605c7b3` (feat)
2. **Task 2: Implement the generated single-person workspace boundary** - `0b05de9` (feat)
3. **Task 3: Prove the end-to-end foundation flow** - `5b5f359` (test)

**Plan metadata:** pending

## Files Created/Modified
- `scripts/lib/fill-templates.ts` - Turns scaffold input into fully rendered default JSON files.
- `scripts/scaffold-person.ts` - Creates `people/<id>/`, copies placeholder assets, and validates the result.
- `scripts/lib/materialize-person.ts` - Builds disposable generated workspaces from validated source folders.
- `scripts/materialize-person.ts` - CLI entrypoint for single-person materialization.
- `scripts/scaffold-person.test.ts` - Verifies scaffolding produces a valid canonical person folder.
- `scripts/materialize-person.test.ts` - Verifies generated output stays outside the source tree and preserves source files.
- `package.json` - Added scaffold and materialize script entrypoints.
- `README.md` - Documented the Phase 1 foundation workflow.

## Decisions Made
- Kept the scaffold command intentionally simple and non-interactive in Phase 1 so it can act as a stable primitive underneath richer operator skills later.
- Made scaffolded output pass validation with warnings and suggestions rather than forcing every placeholder to be resolved at creation time.
- Rewrote local asset references to file URIs only in generated workspaces, which keeps the local-asset compatibility boundary visible instead of burying it in source data.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
Phase 1 now has a reproducible low-level flow: scaffold a person, validate the source folder, then materialize a generated workspace for later upstream integration.

Phase 2 can build the higher-level operator-facing skill/CLI experience on top of these primitives instead of re-implementing file creation or validation rules.

## Self-Check: PASSED

---
*Phase: 01-foundation-and-data-contracts*
*Completed: 2026-03-17*
