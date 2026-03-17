# Phase 4 Verification

**Status:** passed  
**Verified on:** 2026-03-17

## Goal Check

Phase goal: generate centralized path-based output for enabled people and deploy only the sites affected by content changes.

Result: passed.

## Must-Haves

1. Enabled people build into a centralized multi-site output structure suitable for GitHub Pages path routing.
Evidence:
- `scripts/lib/build/upstream-site-builder.ts`
- `scripts/lib/build/build-person-site.ts`
- `scripts/lib/build/build-site.ts`
- `scripts/lib/build/build-landing-page.ts`
- `src/landing/App.tsx`
- `scripts/build-site.test.ts`

2. CI can detect which people changed and limit generation and deployment work to those deltas when applicable.
Evidence:
- `scripts/lib/build/change-detection.ts`
- `scripts/lib/build/restore-live-site.ts`
- `scripts/lib/build/selective-build.ts`
- `scripts/changed-people.ts`
- `scripts/changed-people.test.ts`
- `.github/workflows/deploy.yml`

3. Generated output is reproducible and never treated as hand-edited source.
Evidence:
- `scripts/lib/build/build-timestamp.ts`
- `scripts/lib/deploy/pages-artifact.ts`
- `scripts/lib/deploy/pages-plan.ts`
- `scripts/deploy-pages-plan.ts`
- `scripts/deploy-pages-plan.test.ts`
- `README.md`

## Verification Commands

- `bun run format`
- `bun run lint`
- `bun run typecheck`
- `bun run check`
- `bun run validate`
- `bun test scripts/changed-people.test.ts scripts/build-site.test.ts scripts/deploy-pages-plan.test.ts`
- `ROOT=$(mktemp -d /tmp/open-links-sites-phase4-e2e.XXXXXX) && bun run scaffold:person -- --root "$ROOT" --id phase4-smoke --name "Phase Four Smoke" && bun run build:site -- --root "$ROOT" && bun run deploy:pages:plan -- --site-dir "$ROOT/generated/site" --public-origin https://example.com/open-links-sites`

## Residual Risk

Phase 4 intentionally restores the entire live Pages artifact before selective overlays. That keeps correctness simple, but it means targeted deploy speed still depends on how large the deployed site becomes. Phase 5 is the right place to harden that operational path further if the artifact or network cost starts to matter.
