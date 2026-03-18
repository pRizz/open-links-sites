- [x] Reproduce the Staci Costopoulos import failure and capture the blocking upstream error.
- [x] Copy upstream workspace support files into generated person workspaces during materialization.
- [x] Add regression coverage for generated workspace support files.
- [x] Rerun the Staci import and confirm enrichment/validation complete.
- [x] Run targeted verification:
- [x] `bun test scripts/materialize-person.test.ts`
- [x] `bun test scripts/manage-person.test.ts`
- [x] `bun run check`
- [x] `bun run build:person:site -- --id staci-costopoulos`

Completion review:
- Importing `Staci Costopoulos` from `https://linktr.ee/XSTACI` now completes with exit code `0` and writes helper caches plus the import report.
- The generated workspace now includes upstream schema, policy, authenticated-cache, and follower-history support files, which prevents upstream validation from failing on missing baseline artifacts.
- X community URLs now import as `simple` links so known direct-fetch blockers do not fail strict enrichment.
- Residual risks: Staci still has placeholder `headline` and `location` content, and upstream `open-links` policy data was expanded in `/Users/peterryszkiewicz/Repos/open-links/data/policy/remote-cache-policy.json` to cover the domains and image hosts surfaced by this import.
