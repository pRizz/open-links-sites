# Phase 1: Foundation and Data Contracts - Research

**Researched:** 2026-03-17
**Domain:** Control-repo data contracts and validation boundaries for a multi-site wrapper around `open-links`
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Every enabled person must have `person.json`, `profile.json`, `links.json`, `site.json`, and `assets/`.
- People are discovered by scanning `people/*/person.json`; a root index is not the source of truth in v1.
- All person-specific assets live under `people/<id>/assets/`.
- Folder name must equal `person.id`, and renames should be supported through a guided workflow.
- `person.json` owns orchestration metadata.
- Limited duplicated convenience fields in `person.json` are acceptable only when they materially simplify operator workflows.
- `profile.json`, `links.json`, and `site.json` should mirror upstream `open-links` as closely as possible.
- Theme or preset selection lives in `site.json`.
- Local asset references should default to relative paths such as `assets/avatar.jpg`.
- New-person scaffolding should create fully populated starter files with sane placeholders and defaults.
- Linktree-style bootstrap should write partial data when extraction is incomplete and explicitly mark gaps for later review.
- Helper artifacts beyond canonical source files are acceptable when they reduce operator friction.
- `site.json` should start from one strong default theme/config in v1.
- Required file, schema, and naming violations are hard errors.
- Disabled people still validate against the full canonical source shape.
- Explicit placeholders are allowed to pass validation.
- Validation output should include human-readable and machine-readable details, plus problems, warnings, and suggestions to support automated remediation.
- This repo should store upstream-compatible `profile.json`, `links.json`, and `site.json` directly with minimal or no translation.
- When schema shape needs to evolve, the default move is to update or generalize upstream `open-links` when reasonable.
- Repo-specific structural validation should live here, while shared content validation should trend upstream.
- The system should fail fast on `main` when upstream changes break compatibility, so fixes can happen quickly.

### Claude's Discretion
- The exact helper artifacts generated alongside canonical source files.
- Which convenience fields, if any, are duplicated into `person.json`.
- Whether asset path handling needs a small adjustment if upstream compatibility requires it.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.

</user_constraints>

<research_summary>
## Summary

Phase 1 should build one contract layer, not two. The control repo can stay aligned with upstream `open-links` by treating `profile.json`, `links.json`, and `site.json` as the public content contract, then adding only a repo-local `person.json` plus directory and validation rules around it. Upstream already provides mature JSON Schema definitions and a validation script for the three public files, so the fastest path is to reuse those shapes and add a thin structural validation layer here instead of inventing a separate public schema.

The biggest planning constraint is asset-path compatibility. Current upstream `open-links` expects URI-shaped values in fields like `profile.avatar` and rich metadata image fields, and its build/runtime imports fixed `data/*.json` paths. That means Phase 1 should explicitly introduce a materialization boundary in this repo: source lives under `people/<id>/`, validation understands the per-person layout, and a generated single-person workspace can later feed upstream tooling. This keeps the source-of-truth contract simple now while leaving room either to generalize upstream for local asset paths or to perform narrow translation at the boundary.

**Primary recommendation:** Use a Bun + TypeScript + Ajv stack aligned with upstream `open-links`, formalize the per-person source contract plus templates, implement structural validation locally, and add a minimal materialization/scaffold layer that prepares future build integration without duplicating the `open-links` runtime.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun | 1.3.9 | Script runner, package manager, TypeScript execution | Upstream `open-links` already uses Bun for validation, enrichment, and deploy scripts, so matching it reduces friction |
| TypeScript | 5.9.3 | Typed contract helpers and CLI scripts | Matches upstream type-checking and keeps schema/materialization code explicit |
| Ajv | 8.17.1 | JSON Schema validation | Upstream `open-links` already validates JSON contracts with Ajv 2020 |
| ajv-formats | 3.0.1 | URI/email/date-time format checks | Required to stay compatible with upstream schema behavior |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Biome | 1.9.4 | Formatting and linting | Use if this repo adopts the same quality tooling as upstream |
| JSON Schema Draft 2020-12 | standard | Schema format for `person.json` and vendored upstream contracts | Use for all source-contract validation instead of ad hoc checks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bun | pnpm + tsx/node | pnpm matches the generic TS default, but Bun gives lower-friction parity with upstream scripts and package versions |
| Ajv + JSON Schema | Zod | Zod is nicer for TS-first ergonomics, but it duplicates an upstream contract that already exists in JSON Schema |
| Upstream-compatible public files | Repo-specific public schema + transform layer | A transform layer adds drift risk and undermines the goal of one public model across repos |

**Installation:**
```bash
bun add -d typescript @types/node ajv ajv-formats @biomejs/biome
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```text
.
├── people/
│   └── <id>/
│       ├── person.json
│       ├── profile.json
│       ├── links.json
│       ├── site.json
│       └── assets/
├── schemas/
│   └── person.schema.json
├── templates/
│   └── default/
│       ├── person.json
│       ├── profile.json
│       ├── links.json
│       └── site.json
├── scripts/
│   ├── validate.ts
│   ├── scaffold-person.ts
│   ├── materialize-person.ts
│   └── lib/
├── generated/
└── .planning/
```

### Pattern 1: Upstream-compatible public trio plus local control manifest
**What:** Keep `profile.json`, `links.json`, and `site.json` as close to upstream `open-links` as possible, and isolate control-repo concerns inside `person.json`.
**When to use:** Always for this repo's source-of-truth model.
**Example:**
```ts
type PersonFiles = {
  person: "person.json";
  profile: "profile.json";
  links: "links.json";
  site: "site.json";
};
```

### Pattern 2: Two-layer validation
**What:** Validate repo-specific structure locally, then validate public content against upstream-compatible schemas.
**When to use:** Every scaffold, rename, CI validation, and future deploy-triggering workflow.
**Example:**
```ts
const structureIssues = validatePersonFolderLayout(personDir);
const contentIssues = validatePublicFilesAgainstSchemas({
  profilePath,
  linksPath,
  sitePath,
});
```

### Pattern 3: Materialized single-person workspace as integration boundary
**What:** Convert `people/<id>/...` source into a generated workspace that looks like a single `open-links` site without treating generated files as source of truth.
**When to use:** Build, deploy, and future upstream integration flows.
**Example:**
```ts
await materializePersonWorkspace({
  personId: "alice",
  sourceRoot: "people/alice",
  outputRoot: "generated/workspaces/alice",
});
```

### Anti-Patterns to Avoid
- **Second public schema layer:** Do not invent a separate repo-specific `profile/links/site` contract unless upstream absolutely cannot be generalized.
- **Source-of-truth root manifest:** Do not make a root `people.json` or similar file authoritative when `people/*/person.json` already defines discovery.
- **Generated output in source paths:** Do not mix materialized workspaces or copied cache assets into `people/<id>/`; generated output must stay disposable.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Public content contract | A brand-new schema for `profile/links/site` | Upstream `open-links` schemas | Prevents drift and duplicated validation logic |
| Validation engine | Custom per-field `if` chains | Ajv + JSON Schema + targeted structural rules | Upstream already solved format and schema validation edge cases |
| Multi-site build runtime | A second renderer in this repo | Future materialization into upstream `open-links` | Keeps the control repo thin and reduces maintenance burden |
| Discovery index | A handwritten master manifest | Directory scan of `people/*/person.json` | Avoids merge-conflict hotspots and duplicate truth |

**Key insight:** The risky part of this phase is not authoring JSON files; it is keeping one reliable contract boundary between source data, validation, and future upstream execution. Reuse upstream where possible and keep local additions narrow.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Local asset references do not satisfy upstream URI validation
**What goes wrong:** Source files use `assets/avatar.jpg`, but upstream profile or metadata schema expects a URI string and rejects the value.
**Why it happens:** `open-links` currently treats avatar and several image fields as URI-shaped inputs sourced from `data/*.json`.
**How to avoid:** Keep the divergence narrow and explicit. Either generalize upstream to accept local asset references, or translate those paths only at the materialization boundary.
**Warning signs:** Validation fails on otherwise-correct scaffolded source files; avatar/image sync scripts assume remote fetches only.

### Pitfall 2: Tight coupling to upstream fixed `data/*.json` paths
**What goes wrong:** The control repo tries to validate or build many people in place, but upstream runtime code imports only `data/profile.json`, `data/links.json`, and `data/site.json`.
**Why it happens:** `open-links` is currently designed as a single-site repo with fixed imports.
**How to avoid:** Introduce a generated single-person workspace boundary now, even if full build/deploy comes in later phases.
**Warning signs:** Scripts need to mutate source paths to "pretend" one person is the site; CI logic becomes stateful or destructive.

### Pitfall 3: Cache and validation responsibilities blur together
**What goes wrong:** Structural validation, enrichment cache checks, and future deploy gating get mixed into one script before the source contract is stable.
**Why it happens:** Upstream `open-links` already has rich validation and cache workflows, which can tempt this repo to overreach early.
**How to avoid:** Keep Phase 1 focused on person structure, defaults, and contract validation. Treat enrichment and cache orchestration as later-phase integrations.
**Warning signs:** Phase 1 scripts start writing remote-cache artifacts, invoking upstream builds, or depending on authenticated extractor state.
</common_pitfalls>

<code_examples>
## Code Examples

### Person discovery from the repo source contract
```ts
// Source: derived from Phase 1 contract decisions + standard fs/path usage
import { readdir } from "node:fs/promises";
import path from "node:path";

export async function discoverPeople(root = "people"): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(root, entry.name));
}
```

### Ajv-backed validation split into structure and content layers
```ts
// Source: pattern aligned with open-links/scripts/validate-data.ts
const issues = [
  ...validatePersonStructure(personDir),
  ...validateJsonFile("person.json", personSchema),
  ...validateJsonFile("profile.json", profileSchema),
  ...validateJsonFile("links.json", linksSchema),
  ...validateJsonFile("site.json", siteSchema),
];
```

### Materialize a single person's source into a generated workspace
```ts
// Source: recommended integration boundary for this repo
await writeJson(`${workspace}/data/profile.json`, profile);
await writeJson(`${workspace}/data/links.json`, links);
await writeJson(`${workspace}/data/site.json`, site);
await copyDir(`${personDir}/assets`, `${workspace}/assets`);
```
</code_examples>

<sota_updates>
## State of the Art (2024-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual JSON-first CRUD by default | AI/Studio-first CRUD with JSON as fallback | 2025 | Control repos should optimize for scaffold/update automation, not hand editing |
| Treat remote images as purely runtime fetches | Commit stable avatar/content-image cache manifests plus baked assets | 2025-2026 | Source/validation boundaries must account for cache-backed asset flows |
| Naive one-step GitHub Pages deploys | CI-gated artifact production plus target-aware deploy workflows | 2025-2026 | This repo should plan around generated artifacts and selective deploys, not ad hoc copies |

**New tools/patterns to consider:**
- Upstream-compatible schema vendoring or sync scripts so this repo stays aligned without authoring a second public model
- Structured human + JSON validation output to support automated remediation and future GitHub Actions annotations

**Deprecated/outdated:**
- Using a giant monolithic `people.json` as the editing surface
- Treating generated workspaces or cache artifacts as hand-maintained source files
</sota_updates>

<open_questions>
## Open Questions

1. **How should local asset references become valid upstream inputs?**
   - What we know: current upstream schemas expect URI-shaped values for several image fields, while this repo wants relative `assets/...` references in source.
   - What's unclear: whether the better long-term move is upstream schema generalization or a narrow materialization-time translation.
   - Recommendation: plan Phase 1 so the source contract is stable either way, but keep the implementation boundary explicit and small.

2. **How should upstream public schemas stay in sync in this repo?**
   - What we know: this repo should not drift from upstream `profile/links/site` contracts, and daily upstream updates are part of the product direction.
   - What's unclear: whether to vendor schema snapshots, copy them during automation, or validate by invoking upstream tooling from a checked-out dependency.
   - Recommendation: start with an explicit local contract boundary and a sync-friendly file layout, then automate schema refresh in the later upstream-sync phase.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `/Users/peterryszkiewicz/Repos/open-links/docs/data-model.md` - public content contract, cache behavior, CRUD guidance
- `/Users/peterryszkiewicz/Repos/open-links/schema/profile.schema.json` - profile field and URI requirements
- `/Users/peterryszkiewicz/Repos/open-links/schema/links.schema.json` - links contract and metadata image rules
- `/Users/peterryszkiewicz/Repos/open-links/schema/site.schema.json` - site-level configuration contract
- `/Users/peterryszkiewicz/Repos/open-links/scripts/validate-data.ts` - upstream validation architecture and override points
- `/Users/peterryszkiewicz/Repos/open-links/src/lib/content/load-content.ts` - fixed `data/*.json` runtime imports and current typed surface
- `/Users/peterryszkiewicz/Repos/open-links/package.json` - upstream runtime/tooling versions

### Secondary (MEDIUM confidence)
- `/Users/peterryszkiewicz/Repos/open-links/docs/deployment.md` - deployment artifact model and CI/deploy structure
- `/Users/peterryszkiewicz/Repos/open-links/docs/openclaw-update-crud.md` - operator-facing CRUD and validation expectations
- `/Users/peterryszkiewicz/Repos/open-links/data/examples/minimal/*` - baseline example shapes for starter files
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: control-repo contract design around upstream `open-links`
- Ecosystem: Bun, TypeScript, Ajv, upstream schema/validation flow
- Patterns: source contract, structural validation, materialization boundary
- Pitfalls: local asset paths, upstream path coupling, validation/cache overreach

**Confidence breakdown:**
- Standard stack: HIGH - grounded in the current upstream repo toolchain
- Architecture: HIGH - based on explicit upstream contract and runtime constraints
- Pitfalls: HIGH - directly visible in upstream schemas/scripts
- Code examples: MEDIUM - illustrative patterns derived from upstream behavior and this phase's chosen contract

**Research date:** 2026-03-17
**Valid until:** 2026-04-16 (30 days - mostly stable repo/tooling assumptions)
</metadata>

---

*Phase: 01-foundation-and-data-contracts*
*Research completed: 2026-03-17*
*Ready for planning: yes*
