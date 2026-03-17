# Phase 1 Verification

**Status:** passed  
**Verified on:** 2026-03-17

## Goal Check

Phase goal: establish the canonical person layout, schema validation, asset isolation rules, and reusable defaults so every managed site has a consistent source shape.

Result: passed.

## Must-Haves

1. Canonical per-person source contract exists and is explicit.
Evidence:
- `scripts/lib/person-contract.ts`
- `schemas/person.schema.json`
- `templates/default/*.json`

2. Validation fails on missing files, folder/id mismatches, schema violations, and asset isolation breaches.
Evidence:
- `scripts/lib/validate-person.ts`
- `scripts/validate.ts`
- `scripts/validate.test.ts`

3. The repo can scaffold a valid person folder without hand-authoring files.
Evidence:
- `scripts/scaffold-person.ts`
- `scripts/scaffold-person.test.ts`

4. The repo can materialize a generated single-person workspace outside the source tree.
Evidence:
- `scripts/lib/materialize-person.ts`
- `scripts/materialize-person.ts`
- `scripts/materialize-person.test.ts`

## Verification Commands

- `bun test scripts/lib/person-contract.test.ts scripts/validate.test.ts scripts/scaffold-person.test.ts scripts/materialize-person.test.ts`
- `bun run typecheck`
- `bun run validate`
- `bun run scaffold:person -- --id fixture-user --name "Fixture User"`
- `bun run materialize:person -- --id fixture-user`
- `bun run validate`

Temporary `fixture-user` source and generated artifacts were removed after the end-to-end CLI verification.

## Residual Risk

The current materialization layer rewrites local `assets/...` references to `file://` URIs inside generated workspaces. That boundary is intentional, but later phases should either preserve it deliberately or upstream-generalize the corresponding `open-links` fields.
