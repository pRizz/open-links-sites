# Phase 5 Verification

**Status:** passed  
**Verified on:** 2026-03-17

## Goal Check

Phase goal: keep the repo current with upstream `open-links` and deploy site deltas automatically with fast operational feedback when anything breaks.

Result: passed.

## Must-Haves

1. A daily automation updates this repo against upstream `open-links` directly on `main`.
Evidence:
- `config/upstream-open-links.json`
- `scripts/lib/release-ops/upstream-state.ts`
- `scripts/lib/release-ops/upstream-sync.ts`
- `scripts/sync-upstream.ts`
- `.github/workflows/upstream-sync.yml`

2. A nightly automation validates whether deployment-relevant deltas exist and deploys them automatically.
Evidence:
- `scripts/lib/release-ops/deploy-context.ts`
- `scripts/lib/release-ops/nightly-deploy.ts`
- `scripts/lib/release-ops/release-verify.ts`
- `scripts/release-verify.ts`
- `.github/workflows/deploy.yml`
- `scripts/lib/deploy/pages-summary.ts`

3. Update, validation, extraction, and deployment failures stop quickly and surface actionable signals.
Evidence:
- `scripts/lib/release-ops/workflow-summary.ts`
- `scripts/lib/release-ops/smoke-check.ts`
- `scripts/lib/release-ops/release-verify.ts`
- `scripts/lib/release-ops/upstream-sync.ts`
- `.github/workflows/upstream-sync.yml`
- `.github/workflows/deploy.yml`

## Verification Commands

- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run check`
- `bun run validate`
- `bun run sync:upstream -- --root "$PWD" --upstream-repo-dir /Users/peterryszkiewicz/Repos/open-links --format json`
- `bun run scripts/resolve-deploy-context.ts -- --root "$PWD" --event-name schedule --format json`
- `bun run release:verify -- --root "$PWD" --public-origin https://example.com/open-links-sites --event-name schedule`

## Residual Risk

Phase 5 deliberately favors one truthful release gate over a faster but more fragmented automation graph. That makes failures easier to reason about, but it also means daily sync and nightly deploy runs now pay for `check`, `validate`, a build, artifact planning, and smoke checks. If the repo grows enough that this becomes too slow, the next optimization should preserve the shared `release:verify` contract rather than splitting verification semantics back across multiple workflows.
