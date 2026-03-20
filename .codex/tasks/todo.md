- [x] Reproduce Staci's mixed-content person build and confirm upstream repo data is leaking into the staged Vite app.
- [x] Make the upstream person-site wrapper hermetic by copying app source into the temp build root and using only workspace `data/`.
- [x] Exclude upstream mutable public artifacts from person builds and sanitize workspace follower-history output before publish.
- [x] Add a regression that builds a fixture person through the real upstream wrapper and proves upstream profile data, cache assets, and follower history do not leak.
- [x] Rebuild Staci and verify the published output no longer contains Peter profile data.
- [x] Run verification:
- [x] `bun test scripts/build-site.test.ts`
- [x] `bun run build:person:site -- --id staci-costopoulos`
- [x] `bun run check`

Completion review:
- Person-site builds now stage a hermetic temp app: `src/` and `scripts/` are copied into the temp root, `node_modules/` stays symlinked, and the build uses the generated person workspace `data/` instead of the upstream repo's root `data/`.
- Published person builds now exclude upstream `public/cache/`, upstream follower-history artifacts, and other mutable public directories; workspace cache is copied explicitly, and follower-history output is filtered to the built person's own links before publish.
- The new regression proves a fixture person's bundle contains the fixture profile data, excludes upstream root profile/link data, excludes upstream-only cache images, and emits an empty follower-history index when no matching person history exists.
- Residual note: Staci's rebuilt bundle no longer contains Peter profile data or follower-history entries. The remaining `https://github.com/pRizz/open-links` string comes from the upstream product footer's shared default CTA, not from leaked person data.

---

- [x] Inspect the upstream sync workflow cadence and identify the cheapest safe early-exit check.
- [x] Change the upstream sync schedule from daily to every 4 hours.
- [x] Add a preflight remote-HEAD comparison so clone/install/verify only run when `open-links/main` changed.
- [x] Update the README to describe the 4-hour cadence and preflight skip behavior.
- [x] Run verification:
- [x] Smoke-test the preflight command path against the current tracked upstream state.
- [x] Run `bun run check`
- [x] Parse `.github/workflows/upstream-sync.yml` as YAML and check the diff for whitespace issues.

Completion review:
- The upstream sync workflow now runs every 4 hours instead of once per day.
- A new preflight step compares `config/upstream-open-links.json` to `git ls-remote` for `pRizz/open-links` `main` and skips Bun setup, upstream clone, installs, verification, and commit work when nothing changed.
- The workflow summary now always records the preflight result, so no-op runs still leave an explicit trace of why the rest of the job was skipped.
- Verification note: the preflight smoke test saw tracked `4032cf6c1508` vs latest `b9b358cb462e`, so the new gate would correctly continue into the full sync path right now.
- Residual risk: if upstream advances after the preflight check but before the workflow would have cloned it, that run can miss the change and the next 4-hour run will pick it up.
