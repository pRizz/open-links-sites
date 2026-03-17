# Roadmap: open-links-sites

## Overview

`open-links-sites` starts by defining a stable per-person data model and thin integration points around upstream `open-links`, then layers guided operator workflows on top so onboarding and management stay low-touch. Once bootstrap and enrichment flows work, the project adds selective multi-site generation, centralized GitHub Pages deployment, and finally the autonomous update/deploy automations that keep the repo current with upstream changes.

## Phases

- [ ] **Phase 1: Foundation and Data Contracts** - Define the person folder structure, schemas, defaults, and validation rules that every later workflow depends on.
- [ ] **Phase 2: Guided Operator CRUD** - Add the top-level skill/CLI flows that let the operator create, update, disable, and scaffold people without manual JSON editing.
- [ ] **Phase 3: Import and Enrichment Pipeline** - Bootstrap people from Linktree-like sources or manual links, then enrich and cache data through upstream `open-links` extraction flows.
- [ ] **Phase 4: Selective Multi-Site Build and Deploy** - Generate path-based output for enabled people and deploy only changed sites through centralized CI.
- [ ] **Phase 5: Autonomous Upstream Sync and Release Ops** - Automate daily upstream updates, nightly deployment checks, and fail-fast operational feedback on `main`.

## Phase Details

### Phase 1: Foundation and Data Contracts
**Goal**: Establish the canonical person layout, schema validation, asset isolation rules, and reusable defaults so every managed site has a consistent source shape.
**Depends on**: Nothing (first phase)
**Requirements**: [DATA-01, DATA-02, DATA-03, OPER-02]
**Success Criteria** (what must be TRUE):
  1. Operator can create a valid `people/<id>/` folder structure from reusable defaults without hand-authoring raw files.
  2. Validation fails when required files, schema rules, or folder/id conventions are violated.
  3. Person assets are isolated under that person's directory and included in validation/build inputs.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Define the canonical person file layout, manifest fields, and template defaults.
- [ ] 01-02: Implement schema and structural validation for people, assets, and naming rules.
- [ ] 01-03: Wire the repository foundation for generated output, validation entrypoints, and upstream integration boundaries.

### Phase 2: Guided Operator CRUD
**Goal**: Give the operator a single guided workflow for creating, updating, disabling, and archiving people without manual repo editing.
**Depends on**: Phase 1
**Requirements**: [OPER-01, OPER-03, OPER-04]
**Success Criteria** (what must be TRUE):
  1. Operator can run one top-level command or skill to create a person from basic prompts.
  2. Operator can update a person's core data through guided prompts instead of editing JSON directly.
  3. Operator can disable or archive a person through orchestration metadata while keeping source data intact.
**Plans**: 3 plans

Plans:
- [ ] 02-01: Design the operator-facing command and skill surface for create/update/disable flows.
- [ ] 02-02: Implement create and update workflows on top of the validated person model.
- [ ] 02-03: Implement disable/archive handling and regression checks for operator flows.

### Phase 3: Import and Enrichment Pipeline
**Goal**: Support low-touch onboarding by importing public link pages or manual links, then enriching the results through upstream `open-links` extractors and cache flows.
**Depends on**: Phase 2
**Requirements**: [IMPT-01, IMPT-02, IMPT-03, IMPT-04]
**Success Criteria** (what must be TRUE):
  1. Operator can bootstrap a person from a Linktree-style URL and get seeded links plus profile metadata.
  2. Operator can bootstrap a person from a manual link list when no crawlable source exists.
  3. Imported person data is enriched and cached through upstream-compatible extraction flows.
  4. Validation distinguishes between source import failures and downstream enrichment failures.
**Plans**: 3 plans

Plans:
- [ ] 03-01: Build the initial import pipeline for Linktree-style URLs and manual link input.
- [ ] 03-02: Integrate upstream `open-links` extraction and caching for person-level enrichment.
- [ ] 03-03: Add observability and failure handling for crawl, extract, and cache steps.

### Phase 4: Selective Multi-Site Build and Deploy
**Goal**: Generate centralized path-based output for enabled people and deploy only the sites affected by content changes.
**Depends on**: Phase 3
**Requirements**: [DEPL-01, DEPL-02]
**Success Criteria** (what must be TRUE):
  1. Enabled people build into a centralized multi-site output structure suitable for GitHub Pages path routing.
  2. CI can detect which people changed and limit generation/deployment work to those deltas when applicable.
  3. Generated output is reproducible and never treated as hand-edited source.
**Plans**: 3 plans

Plans:
- [ ] 04-01: Implement the person-to-output generation flow on top of upstream `open-links`.
- [ ] 04-02: Add changed-person detection and selective CI build logic.
- [ ] 04-03: Wire centralized GitHub Pages deployment for generated path-based sites.

### Phase 5: Autonomous Upstream Sync and Release Ops
**Goal**: Keep the repo current with upstream `open-links` and deploy site deltas automatically with fast operational feedback when anything breaks.
**Depends on**: Phase 4
**Requirements**: [DEPL-03, AUTO-01, AUTO-02]
**Success Criteria** (what must be TRUE):
  1. A daily automation updates this repo against upstream `open-links` directly on `main`.
  2. A nightly automation validates whether deployment-relevant deltas exist and deploys them automatically.
  3. Update, validation, extraction, and deployment failures stop quickly and surface actionable signals.
**Plans**: 3 plans

Plans:
- [ ] 05-01: Implement the daily upstream sync workflow and direct-to-main update path.
- [ ] 05-02: Implement nightly delta detection and deployment orchestration.
- [ ] 05-03: Harden fail-fast reporting, rollback expectations, and operational checks.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Data Contracts | 0/3 | Not started | - |
| 2. Guided Operator CRUD | 0/3 | Not started | - |
| 3. Import and Enrichment Pipeline | 0/3 | Not started | - |
| 4. Selective Multi-Site Build and Deploy | 0/3 | Not started | - |
| 5. Autonomous Upstream Sync and Release Ops | 0/3 | Not started | - |
