---
phase: 02-guided-operator-crud
plan: 01
subsystem: infra
tags: [skills, cli, registry, crud, operator]
requires:
  - phase: 01-foundation-and-data-contracts
    provides: Valid person layout, scaffold/validate primitives, and tested path rules
provides:
  - Repo-local `manage-person` project skill
  - Top-level `manage:person` CLI contract with explicit CRUD actions
  - Searchable person registry abstraction for later CRUD actions
affects: [02-02, 02-03, phase-3-import]
tech-stack:
  added: []
  patterns: [project-skill-shell, explicit-action-router, searchable-person-registry]
key-files:
  created:
    - .agents/skills/manage-person/SKILL.md
    - .agents/skills/manage-person/agents/openai.yaml
    - scripts/lib/manage-person/action-contract.ts
    - scripts/lib/manage-person/person-registry.ts
    - scripts/manage-person.ts
    - scripts/manage-person.test.ts
  modified:
    - package.json
    - README.md
key-decisions:
  - "Placed the repo-contained CRUD wizard under `.agents/skills/manage-person/` because GSD project skills are repo-local there."
  - "Kept the CLI deterministic and noninteractive, with the conversational wizard behavior living in the skill contract instead of the script implementation."
  - "Made the registry archive-aware from the start so later lifecycle work can hide archived people by default without replacing the lookup abstraction."
patterns-established:
  - "Skill-first CRUD pattern: the project skill is the primary surface and the CLI is the reusable execution backend."
  - "Registry pattern: person selection flows should go through `person-registry.ts` rather than re-reading folders ad hoc."
requirements-completed: [OPER-01]
duration: 23s
completed: 2026-03-17
---

# Phase 2 Plan 01: Design the operator-facing command and skill surface for create/update/disable flows Summary

**Repo-local `manage-person` skill, explicit CRUD CLI contract, and archive-aware person registry for later actions**

## Performance

- **Duration:** 23s
- **Started:** 2026-03-17T08:18:48Z
- **Completed:** 2026-03-17T08:19:11Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Added the repo-contained `manage-person` project skill as the preferred person CRUD surface.
- Added a top-level `manage:person` CLI router with an explicit action contract for `create`, `update`, `disable`, and `archive`.
- Added a searchable person registry with id/name lookup and future archive-awareness, then pinned the surface with tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Establish the project skill and operator surface contract** - `51e9be0` (feat)
2. **Task 2: Build the shared CLI router and person-registry primitives** - `a4ae3f6` (feat)
3. **Task 3: Pin the operator surface with tests and usage docs** - `e3d098c` (test)

**Plan metadata:** pending

## Files Created/Modified
- `.agents/skills/manage-person/SKILL.md` - Repo-local guided CRUD skill contract.
- `.agents/skills/manage-person/agents/openai.yaml` - UI-facing skill metadata for the project skill.
- `scripts/lib/manage-person/action-contract.ts` - Explicit CLI action set and invocation parsing.
- `scripts/lib/manage-person/person-registry.ts` - Parsed person lookup by id or display name with hidden archive support.
- `scripts/manage-person.ts` - Top-level deterministic CRUD CLI router.
- `scripts/manage-person.test.ts` - Surface-level tests for action parsing, registry lookup, and help/error routing.
- `package.json` - Added the `manage:person` script entrypoint.
- `README.md` - Documented the preferred CRUD surface and explicit action set.

## Decisions Made
- Adopted `.agents/skills/manage-person/` as the repo-owned skill location so the CRUD wizard ships with the project instead of living only in a user-global skills directory.
- Kept the CLI deliberately noninteractive so later automation and the project skill can drive it predictably.
- Let the person registry understand future archived state immediately, even though archive mutation arrives in a later plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
`02-02` can now plug real create and update mutations into one stable action contract and use the registry for name/id person selection.

## Self-Check: PASSED

---
*Phase: 02-guided-operator-crud*
*Completed: 2026-03-17*
