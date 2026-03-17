# Phase 4: Selective Multi-Site Build and Deploy - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate centralized path-based output for enabled people and deploy only the sites affected by content changes. This phase covers output structure, selective build/deploy rules, runtime/output organization, and CI artifact/deploy behavior for one central Pages deployment. Broader directory-style discovery pages, custom domains, per-person repos, and autonomous nightly/daily automations remain outside this phase.

</domain>

<decisions>
## Implementation Decisions

### Output structure and routing
- The deployment root `/` should be a minimal landing page rather than a people index.
- The root landing page should explain what OpenLinks is and how someone can request or get their own page.
- A separate registry or discovery page on another route is a deferred idea for a later phase unless Phase 4 research proves it is required.
- Per-person pages should work at both `/<id>` and `/<id>/` without an operator-visible distinction.
- Generated output for each person should stay self-contained rather than depending on one shared global runtime layer.
- Disabled and archived people should be omitted entirely from generated and deployed output.

### Build selection and delta rules
- If only one person folder changes, CI should rebuild only that person and merge that output into the central artifact.
- If shared repo code, templates, schemas, or runtime glue changes, CI should rebuild all enabled people.
- Anything under `people/<id>/` counts as that person changing, including helper cache and import artifacts.
- If CI cannot confidently determine the minimal changed set, it should fail open to a full rebuild rather than block deployment.

### Shared assets and runtime reuse
- Phase 4 should treat upstream `open-links` as the canonical renderer and keep local build logic as thin as possible.
- Even if the artifact is larger, per-person output should stay self-contained and duplicate runtime files as needed for cleaner isolation.
- The root landing page should be generated locally in this repo rather than through upstream `open-links`.
- The root landing page should be implemented in SolidJS.
- If any targeted person fails to build during a selective or full run, the whole build and deploy run should fail.

### Deployment artifact and CI behavior
- The deployable artifact should contain only the final merged static site output ready for GitHub Pages.
- The central merged output should live under a dedicated generated path such as `generated/site/` before deploy.
- CI should trigger on successful pushes that change build-relevant files.
- The default CI summary should be concise: selective versus full rebuild mode, which people were built, and the artifact/deploy result.

### Claude's Discretion
- The exact landing-page copy and local SolidJS component structure for `/`.
- The exact internal mechanism used to support both `/<id>` and `/<id>/`, as long as the operator-facing path contract remains path-based and tolerant of both forms.
- The exact manifest or bookkeeping format used for change detection and selective merges into the central artifact.
- The exact wording and layout of the CI build/deploy summary.

</decisions>

<specifics>
## Specific Ideas

- The central deployment should feel like many isolated OpenLinks sites collected into one Pages artifact, not one shared app shell with thin per-person data overlays.
- Selective rebuilds should be the normal fast path, but shared/runtime changes should intentionally widen into a full rebuild.
- Root should be intentionally small and explanatory, while actual people pages remain the main product.
- Build failures should stop the whole deployment rather than publish a partially broken central artifact.

</specifics>

<deferred>
## Deferred Ideas

- A dedicated registry or discovery page for browsing enabled people on a non-root route should be considered in a later phase unless Phase 4 planning proves it is necessary now.

</deferred>

---

*Phase: 04-selective-multi-site-build-and-deploy*
*Context gathered: 2026-03-17*
