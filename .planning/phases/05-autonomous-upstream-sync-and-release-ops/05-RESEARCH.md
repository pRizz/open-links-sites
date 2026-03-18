# Phase 5: Autonomous Upstream Sync and Release Ops - Research

**Researched:** 2026-03-17
**Domain:** Daily upstream sync, nightly deploy backstop, and fail-fast release operations for `open-links-sites`
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Daily sync should follow the latest commit on the upstream `open-links` default branch.
- When upstream moves, this repo may apply any deterministic local compatibility updates it needs in the same run.
- Direct-to-`main` automation is acceptable as long as verification passes before any write.
- Each daily sync run should collapse into one consolidated local commit.
- Daily sync should no-op cleanly when upstream has not changed.
- Nightly deploy automation should no-op cleanly when there is no deploy-relevant delta.
- Push-triggered CI remains the immediate validation and deploy path for real commits.
- Nightly automation is only a backstop for missed or scheduled deltas.
- Any failed update or verification step that leaves the repo not confidently releasable must block writes to `main`.
- Automation summaries should stay concise, stage-based, and actionable.
- GitHub Actions run status plus job summaries/logs are the primary failure signal.
- Relevant workflows should not overlap; a later run should wait or skip deterministically.
- Recovery posture is fail-fast and fix-forward on `main`, not auto-revert.
- Phase 5 should add lightweight operational smoke checks beyond the existing validation/build/deploy gates.

### Claude's Discretion
- The exact file path used to store the tracked upstream `open-links` revision.
- Whether nightly deploy-backstop is a separate workflow or a scheduled mode on the existing deploy workflow.
- The exact verification bundle reused across daily sync and nightly deploy flows.
- The exact smoke-check surface, as long as it remains lightweight and operationally meaningful.
</user_constraints>

<research_summary>
## Summary

Phase 5 should be implemented around one missing seam: a source-controlled upstream revision record for `open-links`.

Right now, this repo builds against a floating upstream checkout in CI. That means upstream-only movement is neither reproducible nor representable as a repo change here. A daily sync workflow that only "looks at upstream" is not enough; it needs a pinned upstream revision file in this repo so upstream movement becomes a normal tracked delta on `main`.

The recommended Phase 5 shape is:

1. Add a tracked upstream state file plus sync helpers.
   - Daily automation resolves the latest upstream `main` commit, compares it to the tracked revision in this repo, updates that tracked revision plus any deterministic compatibility artifacts, runs verification, then pushes one consolidated sync commit to `main` only if everything passes.
2. Make deploys use the tracked upstream revision instead of floating HEAD.
   - Push/manual/nightly site builds should all resolve the same pinned upstream ref from source control, then check out `open-links` at that exact ref before building.
3. Reuse the existing Pages artifact diff as the nightly backstop.
   - The current deploy-manifest flow already answers "does the live site differ from the Pages-ready artifact I just built?" That makes it the right no-op boundary for nightly automation. Nightly does not need a second deployment system.
4. Add lightweight release-ops verification and summaries.
   - Shared release verification should cover `check`, `validate`, a Pages-ready site build, artifact planning, and fast smoke checks. Summaries should report no-op vs changed vs failed by stage, and workflows should use deterministic concurrency groups so sync and deploy runs do not overlap unpredictably.

**Primary recommendation:** introduce a tracked upstream revision file and route both daily sync and all deploy workflows through it. Without that, Phase 5 cannot truthfully satisfy "daily upstream update on `main`" and "nightly deploy when upstream changes require it."
</research_summary>

<evidence>
## Key Evidence

### The current deploy workflow uses a floating upstream checkout
- [`.github/workflows/deploy.yml`](/Users/peterryszkiewicz/.codex/worktrees/25c9/open-links-sites/.github/workflows/deploy.yml) checks out `pRizz/open-links` into `upstream/open-links` without pinning a specific ref.
- Because no ref is recorded in this repo, push-based deploys are tied to whatever upstream `main` happens to be at runtime rather than a tracked revision in `open-links-sites`.

### The current local upstream runners are path-based, not revision-based
- [`scripts/lib/build/upstream-site-builder.ts`](/Users/peterryszkiewicz/.codex/worktrees/25c9/open-links-sites/scripts/lib/build/upstream-site-builder.ts) resolves `OPEN_LINKS_REPO_DIR` or a local checkout path and stages a build root from whatever repo contents are present there.
- [`scripts/lib/import/upstream-open-links-runner.ts`](/Users/peterryszkiewicz/.codex/worktrees/25c9/open-links-sites/scripts/lib/import/upstream-open-links-runner.ts) does the same for enrichment scripts.
- This is a good seam for CI checkout injection, but there is currently no source-controlled contract that says which upstream revision CI should use.

### The existing Pages deploy-manifest flow already gives nightly no-op detection
- [`scripts/lib/deploy/pages-artifact.ts`](/Users/peterryszkiewicz/.codex/worktrees/25c9/open-links-sites/scripts/lib/deploy/pages-artifact.ts) finalizes `generated/site/` into a manifest with an artifact hash and file-level diffs.
- [`scripts/lib/deploy/pages-plan.ts`](/Users/peterryszkiewicz/.codex/worktrees/25c9/open-links-sites/scripts/lib/deploy/pages-plan.ts) compares that local manifest to the live `deploy-manifest.json` fetched from the current Pages origin.
- That means nightly backstop logic does not need a second "should I deploy?" mechanism. It can build current `main`, compare manifests, and no-op or deploy.

### The current build flow already separates push-selective builds from full builds
- [`scripts/build-site.ts`](/Users/peterryszkiewicz/.codex/worktrees/25c9/open-links-sites/scripts/build-site.ts) can either execute a targeted selection path or a full build depending on whether changed-path input is supplied.
- [`scripts/lib/build/selective-build.ts`](/Users/peterryszkiewicz/.codex/worktrees/25c9/open-links-sites/scripts/lib/build/selective-build.ts) already contains a deterministic fallback to full builds when selection confidence is low.
- This makes nightly full-build backstop mode straightforward: a scheduled run can simply omit changed-path inputs and build current `main`.

### Upstream `open-links` already uses scheduled direct-to-`main` automation patterns
- [`/Users/peterryszkiewicz/Repos/open-links/.github/workflows/nightly-follower-history.yml`](/Users/peterryszkiewicz/Repos/open-links/.github/workflows/nightly-follower-history.yml) schedules a nightly workflow that mutates repo state, commits, and pushes directly to `main`.
- [`/Users/peterryszkiewicz/Repos/open-links/scripts/github-actions/nightly-follower-history.sh`](/Users/peterryszkiewicz/Repos/open-links/scripts/github-actions/nightly-follower-history.sh) shows the simplest working publish contract: configure bot git identity, stage deterministic files, no-op if nothing changed, otherwise commit once and `git push origin HEAD:main`.
- This is strong evidence that Phase 5 can stay thin and familiar without inventing a separate release-control system.

### Official GitHub docs confirm the schedule and concurrency constraints that matter here
- GitHub’s workflow event docs say scheduled workflows run on the latest commit of the default branch, may be delayed under load, and use UTC cron syntax. Verified on 2026-03-17 from:
  - [Events that trigger workflows](https://docs.github.com/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows)
- GitHub’s concurrency docs say concurrency groups can coordinate runs across workflows in the same repository when group names match, and group names should be unique across workflows unless cross-workflow coordination is intended. Verified on 2026-03-17 from:
  - [Control workflow concurrency](https://docs.github.com/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
</evidence>

<recommended_architecture>
## Recommended Architecture

### 1. Tracked upstream state

Add one source-controlled machine-readable file for the upstream `open-links` revision and related sync metadata.

Recommended contents:

```json
{
  "repository": "pRizz/open-links",
  "branch": "main",
  "commit": "abc123...",
  "syncedAt": "2026-03-17T12:34:56.000Z"
}
```

The exact file path is up to implementation. A root `config/` file is cleaner than storing this inside the CI checkout directory.

### 2. Shared release-ops helpers

Add a small local `scripts/lib/release-ops/` surface for:
- loading and writing tracked upstream state
- comparing tracked vs latest upstream state
- printing stage-based no-op/changed/failure summaries
- running shared release verification and smoke checks

These helpers should remain thin wrappers around existing repo primitives:
- `bun run check`
- `bun run validate`
- `bun run build:site`
- `bun run deploy:pages:plan`

### 3. Two automation paths, one deploy system

- `upstream-sync.yml`
  - scheduled daily
  - checks upstream `main`
  - updates tracked upstream state
  - runs verification
  - commits and pushes directly to `main` only if verification passes
- `deploy.yml`
  - remains the one Pages deployment workflow
  - should add a nightly schedule mode
  - on push: keep current immediate deploy behavior
  - on nightly: build current `main` against the pinned upstream ref, compare to live manifest, and deploy only when changed

This is an inference from the current repo seams plus the user's "push CI remains primary, nightly is backstop" decision. A separate nightly deploy workflow is also viable, but extending the existing deploy workflow keeps the actual deployment path singular.
</recommended_architecture>

<recommended_flow>
## Recommended Flow

### Daily upstream sync

1. Checkout `open-links-sites` `main` with full history.
2. Checkout upstream `open-links` `main`.
3. Resolve the latest upstream commit and compare it to the tracked upstream commit in this repo.
4. If the commits match:
   - emit a no-op summary
   - exit successfully without writing anything
5. If the commits differ:
   - update the tracked upstream state file
   - run any deterministic local compatibility refresh steps needed by this repo
   - run release verification
6. If verification passes:
   - create one consolidated sync commit
   - push `HEAD:main`
7. Let the normal push-triggered deploy workflow handle deployment.

### Nightly deploy backstop

1. Run on the latest commit on this repo’s default branch.
2. Resolve the pinned upstream revision from source control.
3. Checkout upstream `open-links` at that exact ref.
4. Build the current site from scratch or via the normal current-main path.
5. Run Pages artifact planning against the live `deploy-manifest.json`.
6. If the artifact matches live Pages:
   - emit a no-op summary
   - exit successfully
7. If the artifact differs:
   - upload the Pages artifact
   - deploy
   - run lightweight post-deploy smoke checks

### Failure handling

- Verification failure during daily sync blocks any commit to `main`.
- Build/deploy failure during nightly backstop leaves history unchanged and fails fast.
- No automatic rollback should be added; fix-forward remains the operational posture.
</recommended_flow>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upstream version tracking | A hidden floating checkout assumption | A tracked upstream revision file in source control | Makes upstream-only movement visible, reproducible, and deploy-relevant |
| Nightly deploy decision | A second bespoke delta engine | Existing `build:site` + `deploy:pages:plan` | The repo already knows how to compare a Pages-ready artifact to the live site |
| Automation publishing | A custom branch/PR loop | Direct-to-`main` commit/push after verification | Matches the user’s desired operational posture |
| Failure recovery | Automatic rollback logic | Fail-fast plus fix-forward | Simpler, safer, and aligned with the user’s preference |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Leaving deploy builds pinned to floating upstream HEAD
**What goes wrong:** Daily sync writes a local upstream revision, but deploys still build against whatever upstream `main` is at runtime, so the tracked revision is meaningless.
**How to avoid:** Make all CI build paths resolve and checkout the pinned upstream ref from source control.

### Pitfall 2: Committing upstream sync state before release verification finishes
**What goes wrong:** A broken upstream bump lands on `main`, then push-triggered CI fails after the damage is already published to history.
**How to avoid:** Keep all sync changes local until verification completes, then commit and push once.

### Pitfall 3: Letting scheduled sync and deploy workflows overlap
**What goes wrong:** Two workflows both touch Pages or `main` at once, causing noisy cancellations or racey deploy state.
**How to avoid:** Use deterministic repo-wide concurrency groups intentionally across related workflows and avoid competing deploy paths.

### Pitfall 4: Reusing push-event changed-path logic in nightly mode
**What goes wrong:** Nightly runs do not naturally have the same push diff context, so changed-path selection becomes misleading or brittle.
**How to avoid:** Treat nightly as "build current `main` and compare to live" unless you later add an explicit deployed-state diff surface.

### Pitfall 5: Making smoke checks too expensive
**What goes wrong:** Daily sync and nightly deploy stop being fast feedback loops because the "smoke" layer turns into a second full test suite.
**How to avoid:** Keep smoke checks to a few operational signals such as root route availability, deploy-manifest reachability, and a small number of expected page outputs.
</common_pitfalls>

<code_examples>
## Code Examples

### Example tracked upstream state
```json
{
  "repository": "pRizz/open-links",
  "branch": "main",
  "commit": "abc123def456",
  "syncedAt": "2026-03-17T12:34:56.000Z"
}
```

### Example daily sync summary states
```text
Stage: upstream-sync
Result: no-op
Reason: tracked upstream commit already matches origin/main
```

```text
Stage: upstream-sync
Result: changed
Tracked commit: abc123
Latest commit: def456
Next: running release verification before publish
```

### Example deploy workflow split by event
```yaml
on:
  push:
    branches: [main]
  schedule:
    - cron: "0 8 * * *"
  workflow_dispatch:
```

The exact cron values are an implementation detail. The important constraint is that schedule mode uses the latest default-branch commit and acts as a backstop, not a separate primary deploy path.
</code_examples>

<open_questions>
## Open Questions

1. **Should nightly backstop be a scheduled mode on `deploy.yml` or a separate workflow?**
   - Recommendation: extend `deploy.yml` with a nightly schedule so deployment stays centralized in one workflow.

2. **Should Phase 5 add deployed repo/upstream metadata to `deploy-manifest.json` itself or keep it in a separate release-state artifact?**
   - Recommendation: keep the upstream pin in source control first. Only extend `deploy-manifest.json` if execution proves that extra deployed-state metadata materially simplifies nightly diagnostics.
</open_questions>
