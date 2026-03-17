# Requirements: open-links-sites

**Defined:** 2026-03-17
**Core Value:** I can onboard or update a person's OpenLinks site with minimal manual editing, and the repo reliably handles extraction, generation, and centralized deployment for me.

## v1 Requirements

### Operator Workflows

- [x] **OPER-01**: Operator can create a new person with one repo-local skill or command by supplying only basic identity and source inputs.
- [x] **OPER-02**: Operator can scaffold a new person from reusable defaults so repeated setup stays consistent without hand-authoring JSON.
- [x] **OPER-03**: Operator can update an existing person's core profile, links, or site settings through a guided skill or script instead of editing repo files manually.
- [x] **OPER-04**: Operator can disable or archive a person through orchestration metadata without deleting that person's source data.

### Import and Enrichment

- [x] **IMPT-01**: Operator can seed a new person from a Linktree-style URL and have the repo crawl public data to collect links and basic profile metadata.
- [x] **IMPT-02**: Operator can seed a new person from a manual list of links when no source page is available.
- [x] **IMPT-03**: Operator can run upstream `open-links` extractors for a person to enrich imported links and profile data.
- [x] **IMPT-04**: Operator can cache extracted and enriched person data using the same general approach as upstream `open-links`.

### Person Data Model

- [x] **DATA-01**: Operator can store each person in `people/<id>/` with `person.json`, `profile.json`, `links.json`, and `site.json`.
- [x] **DATA-02**: Operator can validate that every required person file exists and that `people/<id>/` matches schema and naming rules.
- [x] **DATA-03**: Operator can keep each person's assets isolated under `people/<id>/assets/`.

### Build and Deployment

- [ ] **DEPL-01**: Operator can generate centralized path-based static output for every enabled person from one repo using upstream `open-links`.
- [ ] **DEPL-02**: Operator can have CI rebuild and deploy only changed people when person data changes.
- [ ] **DEPL-03**: Operator can have nightly automation deploy site deltas to GitHub Pages when upstream or person data changes require it.

### Automation and Reliability

- [ ] **AUTO-01**: Operator can run a daily automation that updates this repo against upstream `open-links` directly on `main`.
- [ ] **AUTO-02**: Operator can see validation, extraction, upstream update, and deployment failures immediately through fail-fast automation.

## v2 Requirements

### Collaboration and Editing

- **COLL-01**: Operator can manage people through a web dashboard instead of repo-local skills and scripts.
- **EDIT-01**: Operator can edit person content through a non-Git workflow.

### Domains and Ownership

- **DOMN-01**: Operator can assign custom domains per person.
- **REPO-01**: Operator can deploy a person from a dedicated per-person repo instead of the central multi-site repo.

### External Sync

- **SYNC-01**: Operator can keep person data synchronized continuously with third-party link services after bootstrap.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom domains | Centralized path-based deployment is the explicit v1 target |
| Per-person repos | Adds operational complexity without helping the first operator workflow |
| Web admin UI | V1 is intentionally engineer-operated and repo-driven |
| Non-Git editing | Version-controlled files remain the source of truth |
| Continuous third-party sync | Bootstrap import is enough for the first release |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OPER-01 | Phase 2 | Complete |
| OPER-02 | Phase 1 | Complete |
| OPER-03 | Phase 2 | Complete |
| OPER-04 | Phase 2 | Complete |
| IMPT-01 | Phase 3 | Complete |
| IMPT-02 | Phase 3 | Complete |
| IMPT-03 | Phase 3 | Complete |
| IMPT-04 | Phase 3 | Complete |
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DEPL-01 | Phase 4 | Pending |
| DEPL-02 | Phase 4 | Pending |
| DEPL-03 | Phase 5 | Pending |
| AUTO-01 | Phase 5 | Pending |
| AUTO-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after Phase 3 completion*
