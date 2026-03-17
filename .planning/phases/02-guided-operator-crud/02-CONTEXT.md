# Phase 2: Guided Operator CRUD - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the operator a single guided workflow for creating, updating, disabling, and archiving people without manual repo editing. This phase covers the operator-facing skill and its CRUD behavior on top of Phase 1 primitives; large link migrations, crawling, and enrichment behavior stay in later phases.

</domain>

<decisions>
## Implementation Decisions

### Command surface
- Phase 2 should present one primary repo-local skill or entrypoint that branches into create, update, disable, and archive.
- The skill is the preferred operator surface in v1; CLI commands sit underneath as the implementation layer.
- Action should be explicit up front, with prompting only when the request is ambiguous.
- The default interaction style should be a conversational wizard with minimal required input.

### Prompt flow and guardrails
- `Create` should require only the person's name, with an optional seed URL when available.
- The workflow should fill as much as possible automatically, then show a short summary after writing changes.
- The default behavior is write-first rather than pre-confirming every create/update write.
- If validation returns warnings or suggestions but no blocking problems, the workflow should continue and present a remediation summary.

### Update workflow shape
- The update flow should find a person by name or id, then confirm the intended match.
- Phase 2 should handle common profile, site, and orchestration edits directly, but not large migration or link-import work.
- Updates should be task-based, such as renaming, changing bio text, toggling enabled state, or switching theme/config values.
- The default scope should stay tight to the requested change rather than opportunistically broadening into cleanup work.

### Disable and archive semantics
- `Disable` should keep the full person folder in source control while marking that person excluded from future build and deploy flows.
- `Archive` should also keep the source folder in place, but mark the person archived and out of normal operator/update flows.
- Archived people should be hidden by default in normal flows, but still retrievable explicitly.
- Disable and archive actions should require one explicit confirmation in the wizard before the status change is written.

### Claude's Discretion
- The exact wizard wording and conversational prompt structure.
- Which common update tasks are grouped together in the Phase 2 operator menu.
- The exact shape of the CLI wrappers underneath the primary skill, as long as the skill remains the main operator surface.

</decisions>

<specifics>
## Specific Ideas

- The top-level experience should feel like one guided operator workflow, not a pile of low-level scripts.
- Create should stay very low-friction: name first, optional seed URL when available, then let automation fill the rest.
- Update should feel task-oriented rather than like editing a giant form.
- Disable and archive should be safe but not heavy-weight: one explicit confirmation is enough.

</specifics>

<deferred>
## Deferred Ideas

- Large link migration and import/crawl assistance belong in Phase 3, not Phase 2.

</deferred>

---

*Phase: 02-guided-operator-crud*
*Context gathered: 2026-03-17*
