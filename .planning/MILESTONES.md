# Milestones

## v1.0 Control Repo MVP (Shipped: 2026-03-18)

**Phases completed:** 5 phases, 15 plans

**Key accomplishments:**
- Established the canonical `people/<id>/` data contract, reusable templates, validation, and generated workspace boundaries.
- Added the repo-local `manage-person` operator surface for create, update, disable, archive, and import flows.
- Reused upstream `open-links` enrichment and cache behavior through generated per-person workspaces instead of forking runtime logic.
- Built centralized path-based multi-site output with selective rebuild planning and a local SolidJS landing page.
- Added pinned-upstream daily sync, nightly deploy backstop, and one shared `release:verify` gate with smoke checks and fail-fast summaries.

**Archives:**
- `milestones/v1.0-ROADMAP.md`
- `milestones/v1.0-REQUIREMENTS.md`
- `milestones/v1.0-MILESTONE-AUDIT.md`

---
