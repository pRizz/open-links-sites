# Phase 3: Import and Enrichment Pipeline - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Support low-touch onboarding by importing public link pages or manual links, then enriching the results through upstream `open-links` extractors and cache flows. This phase covers intake, shaping imported data, running enrichment/cache steps, and reporting failures clearly. Broader AI-assisted extractor authoring and generalized browser-automation workflows remain outside this phase unless a narrow fixed importer is required to land the agreed intake path.

</domain>

<decisions>
## Implementation Decisions

### Intake modes and entrypoint
- Phase 3 should extend `manage-person` with an explicit import/bootstrap action instead of introducing a separate primary surface.
- Linktree-style bootstrap should require only a source URL by default.
- Manual-link intake should accept a pasted freeform list and normalize it into structured link input.
- Import may target an existing person when that target is explicitly chosen.
- Unsupported domains or missing extractor support should be handled upstream in `open-links`; this repo should surface the blocker clearly instead of inventing local one-off support.

### Imported data shaping
- Import should be conservative by default: fill blank fields and append new links, but do not overwrite curated existing data unless explicitly requested.
- Deduplication should catch obvious duplicate or canonical-equivalent URLs, while keeping near-duplicates visible for review.
- Imported links should preserve source-page order as much as possible.
- Automatic profile fill may include name, headline, bio, avatar, and obvious social/profile URLs when clearly present.

### Enrichment and cache behavior
- Successful imports should automatically run the full person-level upstream enrichment and cache flow.
- Enrichment/cache outputs should persist in per-person source-controlled locations in this repo.
- Unsupported upstream domains should be skipped rather than failing the whole import, with a clear remediation summary for the operator.
- Re-running enrichment for an existing person should be incremental by default, but the operator should be prompted if they want a full refresh.

### Failure handling and operator feedback
- Partial source intake should still write useful results, continue enrichment where possible, and report exactly what was missing.
- The default operator summary should be concise: overall outcome plus sections for applied imports, skipped or unsupported items, and remediation steps.
- A run should hard-fail only when nothing useful was imported or when a blocking repo or upstream step fails.
- If enrichment/cache fails after useful source intake has already written data, keep the imported source data, surface the failure clearly, and allow rerun.

### Claude's Discretion
- The exact subcommand/flag shape under the `manage-person` import action.
- The normalization heuristics for pasted manual links, as long as the operator can paste freeform text successfully.
- The exact mapping between imported source data and per-person cache file layout, as long as caches remain per-person and source-controlled.
- The precise wording of remediation summaries and the full-refresh prompt.

</decisions>

<specifics>
## Specific Ideas

- The import path should feel like a continuation of the Phase 2 operator workflow, not a new tool with different mental models.
- Supported imports should continue even when some domains are unsupported, but the operator should leave with a short actionable list of what needs upstream work.
- Profile data can be filled aggressively when it is obvious, but existing curated data should be treated as authoritative by default.
- Incremental re-enrichment should be the everyday path for an existing person; full refresh should be available but intentional.

</specifics>

<deferred>
## Deferred Ideas

- Generalized AI-assisted extractor authoring with browser automation is broader than this phase’s intake/enrichment pipeline and should be treated as separate follow-on work unless a narrow fixed importer is required.

</deferred>

---

*Phase: 03-import-and-enrichment-pipeline*
*Context gathered: 2026-03-17*
