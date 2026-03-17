# Phase 1: Foundation and Data Contracts - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the canonical source shape for each person and the rules that make scaffolded person data valid. This phase covers folder structure, file ownership, defaults, and validation behavior; import, enrichment, build, and deployment behaviors stay in later phases.

</domain>

<decisions>
## Implementation Decisions

### File contract and directory shape
- Every enabled person must have `person.json`, `profile.json`, `links.json`, `site.json`, and `assets/`.
- People are discovered by scanning `people/*/person.json`; a root index is not the source of truth in v1.
- All person-specific assets live under `people/<id>/assets/`.
- Folder name must equal `person.id`, and renames should be supported through a guided workflow.

### Data ownership boundaries
- `person.json` owns orchestration metadata.
- Limited duplicated convenience fields in `person.json` are acceptable only when they materially simplify operator workflows.
- `profile.json`, `links.json`, and `site.json` should mirror upstream `open-links` as closely as possible.
- Theme or preset selection lives in `site.json`.
- Local asset references should default to relative paths such as `assets/avatar.jpg`.

### Defaults and scaffolding behavior
- New-person scaffolding should create fully populated starter files with sane placeholders and defaults.
- Linktree-style bootstrap should write partial data when extraction is incomplete and explicitly mark gaps for later review.
- Helper artifacts beyond canonical source files are acceptable when they reduce operator friction.
- `site.json` should start from one strong default theme/config in v1.

### Validation policy
- Required file, schema, and naming violations are hard errors.
- Disabled people still validate against the full canonical source shape.
- Explicit placeholders are allowed to pass validation.
- Validation output should include human-readable and machine-readable details, plus problems, warnings, and suggestions to support automated remediation.

### Upstream boundary
- This repo should store upstream-compatible `profile.json`, `links.json`, and `site.json` directly with minimal or no translation.
- When schema shape needs to evolve, the default move is to update or generalize upstream `open-links` when reasonable.
- Repo-specific structural validation should live here, while shared content validation should trend upstream.
- The system should fail fast on `main` when upstream changes break compatibility, so fixes can happen quickly.

### Claude's Discretion
- The exact helper artifacts generated alongside canonical source files.
- Which convenience fields, if any, are duplicated into `person.json`.
- Whether asset path handling needs a small adjustment if upstream compatibility requires it.

</decisions>

<specifics>
## Specific Ideas

- Keep v1 discovery simple: scan `people/*/person.json` rather than introducing a source-of-truth root manifest.
- Guided rename support matters because folder name and `person.id` must stay aligned over time.
- Validation output should be remediation-friendly enough that later automation can act on suggestions, not just failures.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation-and-data-contracts*
*Context gathered: 2026-03-17*
