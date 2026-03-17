# Phase 2 Research: Guided Operator CRUD

**Date:** 2026-03-17  
**Phase:** 02-guided-operator-crud

## Question

What do we need to know to plan a single guided operator workflow for create, update, disable, and archive on top of the Phase 1 foundation?

## Sources Reviewed

- `scripts/scaffold-person.ts`
- `scripts/validate.ts`
- `scripts/lib/person-discovery.ts`
- `scripts/lib/validate-person.ts`
- `schemas/person.schema.json`
- `.planning/phases/01-foundation-and-data-contracts/01-03-SUMMARY.md`
- `.planning/phases/02-guided-operator-crud/02-CONTEXT.md`
- `/Users/peterryszkiewicz/.codex/get-shit-done/workflows/plan-phase.md`
- `/Users/peterryszkiewicz/.codex/skills/.system/skill-creator/SKILL.md`
- `/Users/peterryszkiewicz/Repos/open-links/docs/ai-guided-customization.md`
- `/Users/peterryszkiewicz/Repos/open-links/docs/openclaw-update-crud.md`

## Findings

### 1. Phase 1 already provides the right low-level primitives

The current repo already has deterministic building blocks:

- `scripts/scaffold-person.ts` creates a valid `people/<id>/` folder from templates and rolls back on blocking failure.
- `scripts/validate.ts` returns human or JSON output, and it already distinguishes blocking problems from warnings/suggestions.
- `scripts/lib/materialize-person.ts` turns one validated person into a disposable generated workspace.

Implication: Phase 2 should orchestrate these primitives rather than re-implement file generation or validation logic.

### 2. The preferred “wizard” surface should live in a project skill, not an interactive CLI

Phase 2 context locks the preferred operator surface as a skill first, CLI underneath. The local GSD planning docs explicitly recognize project skills under `.agents/skills/`, and this repo currently has no such directory.

Implication: Phase 2 should establish `.agents/skills/manage-person/` as the repo-contained guided workflow artifact, and keep the underlying CLI deterministic and noninteractive for reliable automation.

### 3. The current data model supports `enabled`, but not a real archive lifecycle

`schemas/person.schema.json` currently formalizes `id`, `displayName`, `enabled`, `source`, `notes`, and `custom`. Validation respects `enabled`, but there is no explicit archived lifecycle state, archived visibility policy, or metadata for archive reasons/timestamps.

Implication: disable can continue using build/deploy exclusion semantics, but archive needs an additive lifecycle extension in `person.json` plus validator awareness. This should remain backward-compatible with existing Phase 1 data.

### 4. Person discovery is structural today, not operator-friendly

`scripts/lib/person-discovery.ts` only returns folder/manifests. It does not parse manifests into a searchable registry by id, display name, enabled state, or future archive state.

Implication: Phase 2 needs a parsed person-registry layer so update/disable/archive can select by name or id, confirm the intended match, and hide archived entries by default.

### 5. Write-first CRUD needs transactional helpers for non-create operations

Create already has rollback behavior because scaffolding happens into a new directory that can be removed on failure. Update, disable, and archive will mutate existing files, so they need a small transaction/back-up layer if the flow is going to write first and only then report validation-backed remediation.

This is an inference from the current code and Phase 2 decisions.

Implication: Phase 2 should add shared mutation helpers that snapshot touched files, rerun validation after writes, and restore prior content on blocking problems.

### 6. Upstream CRUD docs reinforce the chosen task-based shape

The upstream `open-links` AI-guided customization and OpenClaw CRUD docs use:

- task- or batch-oriented flows instead of giant forms,
- post-write validation/check summaries,
- deterministic underlying commands/contracts,
- human confirmation only at selected checkpoints.

Implication: Phase 2 should use task-based update actions such as rename, change bio, switch theme, disable, and archive, rather than a full-form editor.

## Planning Implications

The clean breakdown is:

1. Establish the project skill surface, CLI router, and parsed person registry.
2. Implement create and update flows on top of scaffold + validation + transactional writes.
3. Extend lifecycle metadata and implement disable/archive semantics with regression coverage.

## Risks To Keep Explicit

- The current local-asset translation boundary remains in place; Phase 2 should not try to remove it while building CRUD.
- Archive semantics should be additive and should not break existing Phase 1 people or validator behavior.
- The project skill should stay thin and declarative; the real behavior should live in repo scripts so later automation can reuse it.

## Recommendation

Plan Phase 2 as three sequential waves:

- Wave 1: skill surface, action contract, and searchable person registry
- Wave 2: create/update flows with transactional mutation helpers
- Wave 3: lifecycle metadata, disable/archive actions, and end-to-end CRUD regression coverage
