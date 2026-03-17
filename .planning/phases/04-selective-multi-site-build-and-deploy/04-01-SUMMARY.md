---
phase: 04-selective-multi-site-build-and-deploy
plan: 01
subsystem: site-build-foundation
tags: [build, upstream, landing, solidjs, pages]
requires:
  - phase: 03-import-and-enrichment-pipeline
    plan: 02
    provides: Generated single-person workspaces with replayed helper artifacts
provides:
  - Per-person site build orchestration
  - Full-site build orchestration
  - Local SolidJS root landing page
  - Self-contained `generated/site/<id>/` output contract
affects: [04-02, 04-03, phase-5-automation]
tech-stack:
  added: [solid-js, vite, vite-plugin-solid]
  patterns: [workspace-build-wrapper, self-contained-person-routes, local-root-landing]
key-files:
  created:
    - scripts/lib/build/build-timestamp.ts
    - scripts/lib/build/build-landing-page.ts
    - scripts/lib/build/build-person-site.ts
    - scripts/lib/build/build-site.ts
    - scripts/lib/build/site-layout.ts
    - scripts/lib/build/upstream-site-builder.ts
    - scripts/build-person-site.ts
    - scripts/build-site.ts
    - scripts/build-site.test.ts
    - src/landing/App.tsx
    - src/landing/main.tsx
    - src/landing/styles.css
    - src/landing/env.d.ts
    - landing.html
    - vite.landing.config.ts
  modified:
    - package.json
    - tsconfig.json
    - README.md
key-decisions:
  - "Kept upstream `open-links` canonical by staging each materialized workspace into a temporary build root instead of rewriting upstream frontend imports."
  - "Built the root `/` landing page locally with an isolated `landing-assets/` namespace so person bundles remain untouched under `/<id>/`."
  - "Wrote person build output directly into `generated/site/<id>/` so later selective overlays can replace route directories cleanly."
patterns-established:
  - "Workspace-build wrapper: use an upstream checkout as the renderer source tree while injecting generated `data/` and `public/` inputs per person."
  - "Root landing isolation: keep the root page local to this repo and avoid shared-runtime coupling across person outputs."
requirements-completed: [DEPL-01]
duration: pending
completed: 2026-03-17
---

# Phase 4 Plan 01: Implement the person-to-output generation flow on top of upstream `open-links` Summary

**Per-person and full-site builders on top of upstream `open-links`, plus the local SolidJS root landing page**

## Accomplishments

- Added a local upstream-workspace build wrapper that stages one generated person workspace into a temporary `open-links` build root.
- Added `build:person:site` and `build:site` commands that build self-contained person sites under `generated/site/<id>/`.
- Added a local SolidJS landing page for `/` with its own isolated `landing-assets/` output.
- Added integration coverage that proves one real person site builds through the upstream wrapper.

## Evidence

- `scripts/lib/build/upstream-site-builder.ts`
- `scripts/lib/build/build-person-site.ts`
- `scripts/lib/build/build-site.ts`
- `scripts/lib/build/build-landing-page.ts`
- `scripts/build-person-site.ts`
- `scripts/build-site.ts`
- `src/landing/App.tsx`
- `scripts/build-site.test.ts`

## Verification

- `bun test scripts/build-site.test.ts --filter landing-page`
- `bun test scripts/build-site.test.ts --filter person-build`
- `bun run build:site -- --root <temp-root>`

## Next Readiness

`04-02` can now detect changed people and decide whether to run a targeted overlay or a full rebuild against the shared `generated/site/` artifact boundary.
