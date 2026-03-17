---
name: manage-person
description: Guided CRUD and bootstrap workflow for `open-links-sites` people. Use when you need to create, import, update, disable, or archive a person in this repo without manually editing JSON files. This is the preferred repo-local operator surface for person management, with `manage:person` CLI commands underneath it.
---

# Manage Person

Use this skill as the primary operator workflow for person CRUD and import/bootstrap in this repo.

## Flow

1. Start by choosing one explicit action: `create`, `import`, `update`, `disable`, or `archive`.
2. Prefer minimal conversational prompting:
   - `create`: ask only for the person's name, plus an optional seed URL if the operator already has one
   - `import`: prefer a source URL only for Linktree-style bootstrap, or ask for pasted manual links when there is no crawlable source
   - `update`: locate the person by name or id, confirm the match, then ask for the specific task
   - `disable` / `archive`: confirm the intended person, then ask for one explicit confirmation before writing
3. Drive the repo scripts instead of hand-editing JSON.
4. After writing, show a short summary and include validation warnings, skipped upstream work, or remediation when present.

## Action Menu

- `create`: bootstrap a new person from only a name plus optional seed URL
- `import`: bootstrap or refresh a person from a Linktree-style source URL or pasted freeform links
- `update`: apply one scoped profile, site, or orchestration change to an existing person
- `disable`: mark a person excluded from future build/deploy flows
- `archive`: mark a person archived and hidden by default in normal operator flows

## Required Behavior

- Treat this skill as the preferred CRUD surface over raw file editing.
- Keep import flows low-touch: source URL only when possible, pasted freeform links otherwise.
- Imported source data should merge conservatively and preserve curated content by default.
- If upstream `open-links` support is missing, route the operator to fix it there and rerun here instead of inventing a local workaround.
- Keep update flows task-based, not giant form walkthroughs.
- Keep changes tightly scoped to the requested task.
- Archived people should be hidden by default in normal flows unless the operator explicitly asks for them.

## Underlying Commands

Use the repo CLI underneath this skill:

```bash
bun run manage:person -- <action> [options]
```

Common Phase 2/3 calls:

```bash
bun run manage:person -- create --name "Alice Example"
bun run manage:person -- create --name "Bob Example" --seed-url "https://linktr.ee/bob"
bun run manage:person -- import --source-url "https://linktr.ee/alice"
bun run manage:person -- import --person "alice-example" --manual-links $'GitHub https://github.com/alice\nWebsite https://alice.dev'
bun run manage:person -- import --person "alice-example" --source-url "https://linktr.ee/alice" --full-refresh
bun run manage:person -- update --person "alice-example" --headline "Builder and operator"
bun run manage:person -- update --person "Alice Example" --site-title "Alice Example | Links"
bun run manage:person -- disable --person "alice-example" --confirm
bun run manage:person -- archive --person "alice-example" --confirm --reason "Offboarded"
```

The action contract is defined in `scripts/lib/manage-person/action-contract.ts`.
