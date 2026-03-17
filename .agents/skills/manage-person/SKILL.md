---
name: manage-person
description: Guided CRUD workflow for `open-links-sites` people. Use when you need to create, update, disable, or archive a person in this repo without manually editing JSON files. This is the preferred repo-local operator surface for person management, with `manage:person` CLI commands underneath it.
---

# Manage Person

Use this skill as the primary operator workflow for person CRUD in this repo.

## Flow

1. Start by choosing one explicit action: `create`, `update`, `disable`, or `archive`.
2. Prefer minimal conversational prompting:
   - `create`: ask only for the person's name, plus an optional seed URL if the operator already has one
   - `update`: locate the person by name or id, confirm the match, then ask for the specific task
   - `disable` / `archive`: confirm the intended person, then ask for one explicit confirmation before writing
3. Drive the repo scripts instead of hand-editing JSON.
4. After writing, show a short summary and include validation warnings or suggestions when present.

## Action Menu

- `create`: bootstrap a new person from only a name plus optional seed URL
- `update`: apply one scoped profile, site, or orchestration change to an existing person
- `disable`: mark a person excluded from future build/deploy flows
- `archive`: mark a person archived and hidden by default in normal operator flows

## Required Behavior

- Treat this skill as the preferred CRUD surface over raw file editing.
- Keep update flows task-based, not giant form walkthroughs.
- Keep changes tightly scoped to the requested task.
- Do not treat large link migrations or crawl/import work as Phase 2 CRUD; that belongs in Phase 3.
- Archived people should be hidden by default in normal flows unless the operator explicitly asks for them.

## Underlying Commands

Use the repo CLI underneath this skill:

```bash
bun run manage:person -- <action> [options]
```

Common Phase 2 calls:

```bash
bun run manage:person -- create --name "Alice Example"
bun run manage:person -- create --name "Bob Example" --seed-url "https://linktr.ee/bob"
bun run manage:person -- update --person "alice-example" --headline "Builder and operator"
bun run manage:person -- update --person "Alice Example" --site-title "Alice Example | Links"
bun run manage:person -- disable --person "alice-example" --confirm
bun run manage:person -- archive --person "alice-example" --confirm --reason "Offboarded"
```

The action contract is defined in `scripts/lib/manage-person/action-contract.ts`.
