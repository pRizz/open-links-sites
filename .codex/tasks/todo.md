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
