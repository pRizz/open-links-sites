# Phase 2 Verification

**Status:** passed  
**Verified on:** 2026-03-17

## Goal Check

Phase goal: give the operator a single guided workflow for creating, updating, disabling, and archiving people without manual repo editing.

Result: passed.

## Must-Haves

1. The repo exposes one primary CRUD surface for create, update, disable, and archive operations.
Evidence:
- `.agents/skills/manage-person/SKILL.md`
- `scripts/manage-person.ts`
- `scripts/lib/manage-person/action-contract.ts`

2. Create works from only a name plus optional seed URL and surfaces remediation-friendly validation output.
Evidence:
- `scripts/lib/manage-person/create-person.ts`
- `scripts/scaffold-person.ts`
- `scripts/manage-person.test.ts`

3. Update applies scoped profile/site/orchestration edits and restores prior state on blocking validation failures.
Evidence:
- `scripts/lib/manage-person/update-person.ts`
- `scripts/lib/manage-person/update-tasks.ts`
- `scripts/lib/manage-person/mutation-session.ts`
- `scripts/manage-person.test.ts`

4. Disable/archive preserve source folders, use metadata state changes, and keep archived people hidden by default unless explicitly requested.
Evidence:
- `schemas/person.schema.json`
- `templates/default/person.json`
- `scripts/lib/manage-person/status-person.ts`
- `scripts/lib/manage-person/person-registry.ts`
- `scripts/lib/validate-person.ts`
- `scripts/manage-person.test.ts`

## Verification Commands

- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run validate`
- `bun test scripts/manage-person.test.ts --filter lifecycle-schema`
- `bun test scripts/manage-person.test.ts --filter lifecycle-actions`

## Residual Risk

Phase 2 keeps the CRUD surface intentionally narrow. Large migration-oriented edits, rich-link import flows, and crawl-assisted discovery still belong to Phase 3, so operators cannot yet bootstrap or revise full link inventories through this surface alone.
