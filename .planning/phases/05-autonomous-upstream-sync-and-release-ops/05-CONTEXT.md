# Phase 5: Autonomous Upstream Sync and Release Ops - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Keep this repo current with upstream `open-links` and deploy site deltas automatically with fast operational feedback when anything breaks. This phase covers daily upstream sync behavior, nightly deploy-backstop behavior, failure signaling, concurrency/recovery rules, and lightweight operational checks. Broader product features, admin UI, and non-Git operational tooling remain outside this phase.

</domain>

<decisions>
## Implementation Decisions

### Upstream sync scope and source
- The daily sync should follow the latest commit on the upstream `open-links` default branch.
- When upstream moves, the automation may pull in every upstream-dependent change this repo needs, including repo-local compatibility updates in the same run.
- Any repo changes needed to keep this repo working with the new upstream revision may land directly on `main`, as long as verification passes.
- Each sync run should collapse its work into one consolidated local commit.

### Automation cadence and no-op behavior
- The daily upstream-sync automation should no-op cleanly when upstream has not changed.
- The nightly deployment automation should also no-op cleanly when there is no deploy-relevant delta.
- Push-triggered CI should remain the immediate validation and deploy path for real commits.
- Nightly automation should act as a backstop for missed or scheduled deltas rather than a competing primary deploy path.
- If the daily sync creates a real commit, the normal push-triggered CI and deploy flow should handle the rest.

### Failure signaling and operator feedback
- Any failed update or verification step that leaves the repo not confidently releasable should block direct writes to `main`.
- Failed runs should report a concise stage-based summary with the failing step, the key reason, and the next remediation target.
- The primary actionable failure signal should be the failed GitHub Actions workflow status plus its job summary and logs.
- If the nightly deploy backstop detects a real delta but deployment fails, the run should stop immediately and recovery should happen through rerun or fix-forward.

### Guardrails and recovery behavior
- Relevant automations should not overlap; a later run should skip or wait deterministically if another related workflow is already active.
- If the daily sync makes local changes but fails before pushing, that run should be discarded and recovered through the next scheduled run or a manual rerun.
- If a bad upstream sync lands on `main`, the default posture should be to fix forward on `main` rather than auto-revert.
- Phase 5 should add lightweight operational smoke checks beyond the existing validation, build, and deploy gates.

### Claude's Discretion
- The exact mechanism used to detect upstream movement and map it into one consolidated sync commit.
- The exact GitHub Actions workflow split between scheduled sync, scheduled deploy-backstop, and shared reusable steps.
- The exact format of concise automation summaries, as long as they remain stage-based and actionable.
- The exact shape of lightweight post-sync or post-deploy smoke checks, as long as they stay fast and operationally meaningful.

</decisions>

<specifics>
## Specific Ideas

- Direct-to-`main` automation is acceptable here, but only when verification has already proven the repo is still releasable.
- The nightly job should exist to catch missed deploy-relevant deltas, not to replace push-triggered CI.
- Failure handling should stay fix-forward and fail-fast rather than trying to conceal breakage with retries or automatic rollback.
- Operational checks should remain lightweight enough that they can run routinely without undermining the fast feedback goal.

</specifics>

<deferred>
## Deferred Ideas

- None captured during this discussion.

</deferred>

---

*Phase: 05-autonomous-upstream-sync-and-release-ops*
*Context gathered: 2026-03-17*
