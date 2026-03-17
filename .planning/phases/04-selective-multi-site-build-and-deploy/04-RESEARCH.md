# Phase 4: Selective Multi-Site Build and Deploy - Research

**Researched:** 2026-03-17
**Domain:** Centralized path-based multi-site generation and GitHub Pages deployment for `open-links-sites`
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Root `/` should be a minimal landing page that explains OpenLinks and how to request a page, not a people index.
- A separate registry/discovery page is acceptable later, but is not required for Phase 4.
- Per-person routes should work at both `/<id>` and `/<id>/` without forcing an operator-visible distinction.
- Per-person output should stay self-contained, even if that duplicates runtime files and increases artifact size.
- Disabled and archived people should be omitted entirely from generated and deployed output.
- If only one person changes, CI should rebuild only that person and merge it into the central artifact.
- Shared repo/runtime/template/schema changes should trigger a full rebuild of all enabled people.
- Anything under `people/<id>/` counts as that person changing, including helper cache/import artifacts.
- If change detection is uncertain, fail open to a full rebuild instead of blocking deployment.
- Upstream `open-links` should remain the canonical renderer, with as little local build logic as possible.
- The root landing page should be implemented locally in this repo using SolidJS.
- Any targeted person build failure should fail the whole build/deploy run.
- The deployable artifact should contain only the final merged static site output ready for GitHub Pages.
- The merged output should live under `generated/site/` before deploy.
- CI should run on successful pushes that touch build-relevant files.
- CI summaries should stay concise: selective vs full rebuild, which people were built, and the deploy/artifact result.

### Claude's Discretion
- The exact local script layout for single-person vs whole-site build commands.
- How the repo-local Solid landing page is built and copied into `generated/site/`.
- Whether the Pages deploy-manifest helpers are copied locally or extracted into a thinner shared seam with upstream.
- Whether `/<id>` support relies on normal GitHub Pages directory resolution or needs explicit shims after observed verification.

### Deferred Ideas (OUT OF SCOPE)
- Custom domains
- Per-person repos
- A root registry/dashboard page beyond the minimal landing page
- Shared-runtime optimization across person outputs
</user_constraints>

<research_summary>
## Summary

Phase 4 should be implemented as three thin layers:

1. A narrow upstream `open-links` build generalization that makes the frontend build workspace-aware for materialized per-person inputs.
2. A local site assembler in `open-links-sites` that materializes people, invokes the upstream renderer once per targeted person with `BASE_PATH=/<id>/`, merges self-contained outputs into `generated/site/`, and builds the root landing page locally.
3. A selective CI/deploy path that widens to full rebuilds when needed, restores the current live Pages artifact as the base snapshot for selective merges, then finalizes and deploys only when the resulting Pages artifact manifest changed.

The most important research finding is that the current upstream frontend build is not workspace-aware yet. Upstream enrichment scripts already work from `process.cwd()`, but the Vite app still imports `./data/profile.json`, `./data/site.json`, and `../../../data/...` directly from the upstream repo tree. That means Phase 4 cannot honestly stay thin unless `open-links` gets a small build-input abstraction first.

The second important finding is operational: selective rebuilds in a single GitHub Pages artifact require a base snapshot for unchanged people. Because generated output is not committed and GitHub Pages deploys a complete artifact, rebuilding only `alice` still requires the existing `bob`, `charlie`, and root files to be present locally before deploy. The cleanest source of truth is the live Pages mirror plus its `deploy-manifest.json`; if restore fails or confidence is low, the workflow should rebuild every enabled person.

**Primary recommendation:** Make one explicit upstream build seam for external `data/` and `public/` roots, then keep this repo responsible for orchestration only: person selection, materialization, root landing build, merged artifact assembly, and GitHub Pages workflow wiring.
</research_summary>

<evidence>
## Key Evidence

### This repo already has the right pre-build primitives
- `scripts/lib/materialize-person.ts` materializes one person into `generated/<id>/data` and `generated/<id>/public`.
- `scripts/lib/import/cache-layout.ts` formalizes the generated workspace and per-person helper-artifact layout.
- Phase 3 already proved that upstream scripts can run against materialized workspaces by using `cwd=generated/<id>`.

### Upstream deploy tooling already models base paths and Pages diffing
- `/Users/peterryszkiewicz/Repos/open-links/vite.config.ts` already honors `BASE_PATH`.
- `/Users/peterryszkiewicz/Repos/open-links/src/lib/deployment-config.ts` already normalizes GitHub Pages base paths and public origins.
- `/Users/peterryszkiewicz/Repos/open-links/scripts/deploy/build.ts` already builds target-specific deploy artifacts and finalizes them with a deploy manifest.
- `/Users/peterryszkiewicz/Repos/open-links/scripts/deploy/plan-pages.ts` already compares a local artifact manifest to the live Pages manifest and emits a no-op vs changed result.

### Upstream frontend build is currently repo-root-bound
- `/Users/peterryszkiewicz/Repos/open-links/vite.config.ts` imports `./data/profile.json` and `./data/site.json` directly.
- `/Users/peterryszkiewicz/Repos/open-links/src/lib/content/load-content.ts` imports `../../../data/links.json`, `../../../data/profile.json`, `../../../data/site.json`, and glob-loads `../../../data/generated/rich-metadata.json`, `../../../data/cache/profile-avatar.json`, and `../../../data/cache/content-images.json`.

This is the critical gap between today's Phase 3 workspace contract and the Phase 4 multi-site build goal.

### GitHub Pages deployment wants a complete artifact, not a patch
- The upstream Pages workflow archives and uploads a full artifact directory before creating a deployment.
- `deploy-manifest.json` is compared against the live mirror to skip no-op deploys, but the deployment itself still uses a whole artifact tarball.

That means "build only changed people" still requires a local full-site artifact by the end of the workflow.
</evidence>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Workspace-aware upstream build contract
**What:** Add a small upstream seam so the `open-links` frontend build can read content/cache/public inputs from a materialized per-person workspace instead of the upstream repo root.
**When to use:** Every per-person build in this repo.
**Why:** It is the simplest root-cause fix for the current repo-root-bound frontend imports.

### Pattern 2: Materialize -> build person -> merge into central site
**What:** Treat each person build as an isolated pipeline: validate person, materialize workspace, invoke upstream renderer with `BASE_PATH=/<id>/`, then copy the resulting self-contained output into `generated/site/<id>/`.
**When to use:** Full builds and selective rebuilds.
**Why:** It matches the user’s isolation requirement and keeps local orchestration logic thin.

### Pattern 3: Restore live site before selective overlay
**What:** For selective builds, restore the current live Pages site into `generated/site/`, then replace only the targeted person routes and root files that actually need to change.
**When to use:** Push-triggered selective CI runs.
**Why:** Pages deploys a complete artifact; without a base snapshot, unchanged people would disappear.

### Pattern 4: Manifest-driven no-op deploy planning
**What:** Finalize `generated/site/` into a Pages-ready artifact with `deploy-manifest.json`, compare it to the live manifest, and skip deployment when nothing changed.
**When to use:** Every deploy workflow run after site generation.
**Why:** This reuses the proven upstream Pages pattern and keeps nightly or push-based no-op deploys cheap.
</architecture_patterns>

<recommended_flow>
## Recommended Build And Deploy Flow

1. Determine build mode: full rebuild or targeted person set.
2. If the run is selective, restore the current live Pages artifact into `generated/site/`; if restore fails, widen to a full rebuild.
3. For each targeted enabled person:
   - validate current source
   - materialize `generated/<id>/`
   - invoke upstream `open-links` build with external content roots, `BASE_PATH=/<id>/`, and an isolated out dir
   - replace `generated/site/<id>/` with the new self-contained output
4. For targeted disabled/archived people, remove their route directories from `generated/site/`.
5. Build the local Solid landing page into the root of `generated/site/`.
6. Finalize the merged site into a Pages-ready artifact and write `deploy-manifest.json`.
7. Compare the local manifest to the live manifest and deploy only when changed.

This is an inference from the user’s selective-build requirement plus the fact that Pages deployment consumes a full artifact.
</recommended_flow>

<recommended_layout>
## Recommended Output Layout

```text
generated/
  <id>/
    data/
    public/
  site/
    index.html
    assets/
    deploy-manifest.json
    <id>/
      index.html
      assets/
      cache/
      ...
```

- `generated/<id>/` stays the disposable materialized workspace.
- `generated/site/` becomes the only Pages-ready merged artifact directory.
- The root landing page owns only the root files.
- Each person path remains self-contained beneath `generated/site/<id>/`.
</recommended_layout>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-site renderer | A second local frontend runtime | Upstream `open-links` build with one small workspace-aware seam | Keeps rendering logic centralized in the owned upstream repo |
| Selective Pages deploy | Partial artifact uploads or ad hoc file patching | Full local artifact assembly plus manifest-based no-op detection | Matches how GitHub Pages deployment actually works |
| Runtime dedupe | Shared root runtime/assets for v1 | Self-contained per-person outputs | Matches the user’s isolation choice and avoids cross-person breakage |
| Build target detection | Hand-maintained person lists | Git diff classification plus fail-open full rebuild | Keeps operator burden low and reduces missed rebuild risk |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Assuming upstream build inputs are already workspace-aware
**What goes wrong:** The build still reads upstream repo-root `data/` and `public/`, so every person build silently uses the wrong content or requires brittle file copying hacks.
**How to avoid:** Make the upstream build seam explicit first and keep the default upstream path behavior unchanged for backward compatibility.

### Pitfall 2: Performing a selective build without a base snapshot
**What goes wrong:** The final Pages artifact only contains the newly built people, so every unchanged person is treated as deleted.
**How to avoid:** Restore the live Pages site (or otherwise recover a full prior artifact) before overlaying targeted rebuilds, and fail open to a full rebuild when that restore path is uncertain.

### Pitfall 3: Forgetting to prune disabled or archived outputs on selective runs
**What goes wrong:** People marked out of service remain reachable because their old route directories were never removed from the merged artifact.
**How to avoid:** Treat disable/archive as route-deletion events in the build overlay logic, not just validation metadata changes.

### Pitfall 4: Letting the root landing build collide with per-person asset namespaces
**What goes wrong:** Root-level assets overwrite per-person or shared expectations, or vice versa.
**How to avoid:** Keep the landing page’s build isolated to root output and preserve person bundles entirely under `/<id>/`.
</common_pitfalls>

<code_examples>
## Code Examples

### Proposed upstream-aware person build invocation
```bash
OPENLINKS_CONTENT_ROOT="/abs/generated/alice/data" \
OPENLINKS_PUBLIC_ROOT="/abs/generated/alice/public" \
OPENLINKS_BUILD_OUT_DIR="/abs/generated/site/alice" \
BASE_PATH="/alice/" \
bunx vite build
```

### Selective build overlay flow
```ts
if (selection.mode === "selective") {
  await restoreLivePagesSnapshot({ destinationDir: generatedSiteDir });
}

for (const personId of selection.personIds) {
  await buildPersonSite({ personId, siteDir: generatedSiteDir });
}
```

These env names are a recommendation, not an observed existing upstream contract.
</code_examples>

<open_questions>
## Open Questions

1. **Should `/<id>` support rely on normal GitHub Pages directory handling or explicit shims?**
   - Recommendation: build `/<id>/index.html` first, then verify GitHub Pages behavior during execution and add a lightweight shim only if the observed route handling is inconsistent.

2. **Should deploy-manifest helpers stay copied locally or be extracted into a shared upstream package later?**
   - Recommendation: keep Phase 4 pragmatic. A small local wrapper or copy is acceptable if extraction would slow delivery; shared extraction can happen later if Phase 5 automation makes the duplication painful.
</open_questions>
