# Phase 3: Import and Enrichment Pipeline - Research

**Researched:** 2026-03-17
**Domain:** Low-touch person import and upstream enrichment orchestration for `open-links-sites`
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Phase 3 should extend `manage-person` with an explicit import/bootstrap action instead of introducing a separate primary surface.
- Linktree-style bootstrap should require only a source URL by default.
- Manual-link intake should accept a pasted freeform list and normalize it.
- Import may target an existing person when that target is explicitly chosen.
- Import should be conservative by default: fill blank fields and append new links, but do not overwrite curated existing data unless explicitly requested.
- Deduplication should catch obvious duplicate or canonical-equivalent URLs while keeping near-duplicates visible for review.
- Imported links should preserve source-page order as much as possible.
- Automatic profile fill may include name, headline, bio, avatar, and obvious social/profile URLs when clearly present.
- Successful imports should automatically run the full person-level upstream enrichment/cache flow.
- Enrichment/cache outputs should persist in per-person source-controlled locations in this repo.
- Unsupported upstream domains should be skipped rather than failing the whole import, with a clear remediation summary.
- Re-running enrichment for an existing person should be incremental by default, but the operator should be prompted if they want a full refresh.
- Partial source intake should still write useful results, continue enrichment where possible, and report exactly what was missing.
- The default operator summary should be concise: overall outcome plus sections for applied imports, skipped or unsupported items, and remediation steps.
- A run should hard-fail only when nothing useful was imported or when a blocking repo or upstream step fails.
- If enrichment/cache fails after useful source intake has already written data, keep the imported source data, surface the failure clearly, and allow rerun.
- Missing extractor support should be solved upstream in `open-links`, not by inventing a local compatibility layer here.

### Claude's Discretion
- The exact `manage-person` subcommand/flag design for import.
- The normalization heuristics for pasted manual links.
- The exact helper-artifact layout for per-person caches/import reports.
- The wording and structure of the import/enrichment remediation summary.

### Deferred Ideas (OUT OF SCOPE)
- Generalized AI-assisted extractor authoring with browser automation is follow-on work unless a narrow fixed importer is required to land the agreed intake path.

</user_constraints>

<research_summary>
## Summary

Phase 3 should keep this repo thin by splitting the work into three layers:

1. A repo-local import action that normalizes Linktree/manual input into conservative patches on `person.json`, `profile.json`, and `links.json`.
2. A bridge that runs upstream `open-links` scripts against a materialized single-person workspace using `process.cwd()` as the workspace root.
3. A result/report layer that syncs stable upstream cache artifacts back into per-person source-controlled helper directories and classifies source-intake issues separately from enrichment/cache issues.

The most important research finding is that upstream `open-links` already exposes nearly everything Phase 3 needs:

- `scripts/enrich-rich-links.ts` supports `--links`, `--site`, output/report overrides, and writes structured enrichment reports.
- `scripts/validate-data.ts` supports `--profile`, `--links`, `--site`, and `--enrichment-report`.
- `scripts/sync-profile-avatar.ts`, `scripts/sync-content-images.ts`, and `scripts/public-rich-sync.ts` all accept path flags and use `process.cwd()` for workspace-relative paths.
- `src/lib/identity/handle-resolver.ts` and related validation rules already expose supported-profile vs `unsupported_domain` behavior that can drive import remediation instead of custom heuristics here.

That means Phase 3 does not need a cloned or rewritten `open-links` app per person. It can materialize `generated/<id>/` as the workspace root, run upstream script files with `cwd=generated/<id>`, then sync the stable cache outputs back into this repo.

**Primary recommendation:** Implement Phase 3 as `manage-person import` plus an upstream-runner/cache-sync boundary. Persist per-person helper artifacts such as import reports and cache manifests under `people/<id>/` so the source of truth remains self-contained, but keep extractor/domain intelligence upstream in `open-links`.
</research_summary>

<evidence>
## Key Evidence

### Existing repo primitives already support Phase 3 orchestration
- `scripts/manage-person.ts` provides a stable action router that can be extended with a new import/bootstrap action.
- `scripts/lib/manage-person/mutation-session.ts` already gives write-first rollback safety for blocking validation failures.
- `scripts/lib/materialize-person.ts` already builds disposable single-person workspaces under `generated/<id>/`.
- `schemas/person.schema.json` already includes `source.kind` values for `linktree` and `links-list`.

### Upstream `open-links` command surface is bridgeable
- `/Users/peterryszkiewicz/Repos/open-links/scripts/enrich-rich-links.ts`
- `/Users/peterryszkiewicz/Repos/open-links/scripts/validate-data.ts`
- `/Users/peterryszkiewicz/Repos/open-links/scripts/sync-profile-avatar.ts`
- `/Users/peterryszkiewicz/Repos/open-links/scripts/sync-content-images.ts`
- `/Users/peterryszkiewicz/Repos/open-links/scripts/public-rich-sync.ts`

These scripts import code relative to the upstream repo, but resolve data/cache paths from `process.cwd()`. That is the seam this repo should use.

### Upstream already models structured enrichment outcomes
- `/Users/peterryszkiewicz/Repos/open-links/scripts/enrichment/types.ts`
- `/Users/peterryszkiewicz/Repos/open-links/scripts/enrichment/report.ts`

The upstream report already distinguishes statuses such as `fetched`, `partial`, `failed`, `skipped` and reasons such as `fetch_failed`, `metadata_missing`, `public_cache`, `authenticated_cache_missing`, and `known_blocker`.

### Upstream identity/domain support is explicit
- `/Users/peterryszkiewicz/Repos/open-links/src/lib/identity/handle-resolver.ts`
- `/Users/peterryszkiewicz/Repos/open-links/scripts/validation/rules.ts`
- `/Users/peterryszkiewicz/Repos/open-links/src/lib/icons/known-sites-data.ts`

This repo can use upstream-supported vs unsupported outcomes instead of inventing a second support matrix.
</evidence>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Conservative source-intake patching
**What:** Normalize imported Linktree/manual inputs into targeted patches over existing `person/profile/links` data instead of wholesale replacement.
**When to use:** Every import run before upstream enrichment starts.
**Why:** Matches the user’s “fill blanks, keep curated data authoritative” decision.

### Pattern 2: Upstream runner against generated workspaces
**What:** Materialize one person into `generated/<id>/`, then run upstream `open-links` script files with `cwd=generated/<id>`.
**When to use:** Validation, rich enrichment, avatar sync, content-image sync, and public audience cache refresh.
**Why:** Upstream scripts already support path overrides and workspace-relative cache/output paths, so this avoids copying the upstream runtime into this repo.

### Pattern 3: Sync stable upstream cache outputs back to per-person helper artifacts
**What:** Treat upstream stable cache outputs as the authoritative enrichment artifacts, then copy them back into per-person helper paths under `people/<id>/`.
**When to use:** After successful or partially successful enrichment/cache runs.
**Why:** The user wants source-controlled per-person caches in this repo, but upstream still operates on single-site fixed paths.

### Pattern 4: Stage-aware import reporting
**What:** Record import outcomes as at least `source_intake`, `enrichment`, and `cache_sync` stages with clear status/reason fields.
**When to use:** Every import run, especially partial-success runs.
**Why:** Phase 3 explicitly needs to distinguish source import failures from downstream enrichment failures.
</architecture_patterns>

<recommended_layout>
## Recommended Helper-Artifact Layout

Canonical files remain unchanged:

```text
people/<id>/
  person.json
  profile.json
  links.json
  site.json
  assets/
```

Recommended Phase 3 helper artifacts:

```text
people/<id>/
  cache/
    profile-avatar.json
    rich-public-cache.json
    rich-authenticated-cache.json
    content-images.json
    profile-avatar/
    content-images/
    rich-authenticated/
  imports/
    last-import.json
    source-snapshot.json
```

This is an inference from the user’s “helper artifacts are acceptable” guidance plus the upstream stable cache contract. The exact names can vary, but the core rule should hold: per-person helper artifacts live with that person and stay source-controlled.
</recommended_layout>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rich metadata support matrix | A second local extractor registry | Upstream `handle-resolver`, validation rules, blocker policy, and extractor workflows | Keeps domain intelligence in one repo |
| Enrichment result model | A brand-new local status taxonomy | Upstream enrichment report statuses/reasons plus a thin local stage wrapper | Reuses existing reason/remediation vocabulary |
| Single-person runtime | A copied or vendored full `open-links` app per person | Upstream script-file invocation with `cwd=generated/<id>` | Lowest-maintenance bridge |
| Import overwrite logic | Whole-file replacement defaults | Conservative merge + explicit overwrite mode later if needed | Matches operator expectations and reduces destructive surprises |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Running upstream enrichment against the source tree
**What goes wrong:** Stable cache files and generated metadata end up mixed into repo-root defaults or temporary files mutate source paths unexpectedly.
**How to avoid:** Always run upstream scripts against a materialized workspace, then sync stable outputs back intentionally.

### Pitfall 2: Treating unsupported domains as a local parsing problem
**What goes wrong:** This repo grows ad hoc domain support that drifts from upstream `open-links`.
**How to avoid:** Reuse upstream support detection and route unsupported-domain remediation back to the upstream extractor/policy workflow.

### Pitfall 3: Failing avatar sync on placeholder or local-only avatars
**What goes wrong:** `sync-profile-avatar.ts` accepts only `http/https` avatars and falls back when given invalid or unsupported schemes, so a local `file:` URI or placeholder path can produce noisy failures.
**How to avoid:** Run avatar sync conditionally only when imported profile data resolves to a real remote avatar URL, otherwise keep the local placeholder/source avatar state and report it clearly.

### Pitfall 4: Failing the whole run when only part of the import is unsupported
**What goes wrong:** Useful imported links/profile fields are lost because one unsupported domain or enrichment blocker aborts everything.
**How to avoid:** Keep the source-intake stage independent from enrichment/cache success and reserve hard failure for “nothing useful imported” or blocking runner failures.
</common_pitfalls>

<code_examples>
## Code Examples

### Invoke upstream validation against a generated workspace
```ts
await Bun.spawn([
  "bun",
  "/Users/peterryszkiewicz/Repos/open-links/scripts/validate-data.ts",
  "--profile",
  "data/profile.json",
  "--links",
  "data/links.json",
  "--site",
  "data/site.json",
], {
  cwd: generatedWorkspace.outputDir,
});
```

### Invoke upstream rich enrichment and keep its report
```ts
await Bun.spawn([
  "bun",
  "/Users/peterryszkiewicz/Repos/open-links/scripts/enrich-rich-links.ts",
  "--strict",
  "--write-public-cache",
  "--links",
  "data/links.json",
  "--site",
  "data/site.json",
  "--report",
  "data/generated/rich-enrichment-report.json",
], {
  cwd: generatedWorkspace.outputDir,
});
```

### Conservative merge before enrichment
```ts
const merged = mergeImportedPerson({
  currentProfile,
  currentLinks,
  importedProfile,
  importedLinks,
  overwrite: false,
});
```
</code_examples>

<open_questions>
## Open Questions

1. **Should per-person cache/import helper paths become explicit constants in `person-contract.ts`?**
   - Recommendation: yes, if Phase 3 writes them. Even if they remain optional, central constants reduce drift across import, cache sync, and later deploy flows.

2. **How interactive should the “full refresh?” prompt be under `manage-person import`?**
   - Recommendation: implement it as deterministic CLI/skill behavior (`--full-refresh` flag underneath, prompt in the skill layer) rather than making the script itself conversational.
</open_questions>
