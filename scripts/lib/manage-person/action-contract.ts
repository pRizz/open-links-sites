export const MANAGE_PERSON_ACTION_DETAILS = [
  {
    action: "create",
    summary: "Create a new person from a name and optional seed URL.",
  },
  {
    action: "update",
    summary: "Update one existing person's profile, site, or orchestration fields.",
  },
  {
    action: "disable",
    summary: "Mark a person excluded from future build and deploy flows.",
  },
  {
    action: "archive",
    summary: "Archive a person while keeping their source folder intact.",
  },
] as const;

export const MANAGE_PERSON_ACTIONS = MANAGE_PERSON_ACTION_DETAILS.map(
  (entry) => entry.action,
);

export type ManagePersonAction = (typeof MANAGE_PERSON_ACTIONS)[number];

export interface ManagePersonInvocation {
  action: ManagePersonAction | null;
  rootDir: string;
  remainingArgs: string[];
  showHelp: boolean;
  invalidAction?: string;
}

const HELP_FLAGS = new Set(["--help", "-h"]);

export const isManagePersonAction = (value: string): value is ManagePersonAction =>
  MANAGE_PERSON_ACTIONS.includes(value as ManagePersonAction);

export const parseManagePersonInvocation = (
  argv: string[],
  defaultRootDir: string,
): ManagePersonInvocation => {
  let rootDir = defaultRootDir;
  let showHelp = false;
  let action: ManagePersonAction | null = null;
  let invalidAction: string | undefined;
  const remainingArgs: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg) {
      continue;
    }

    if (HELP_FLAGS.has(arg)) {
      showHelp = true;
      continue;
    }

    if (arg === "--root") {
      const maybeRootDir = argv[index + 1];
      if (maybeRootDir) {
        rootDir = maybeRootDir;
        index += 1;
      }
      continue;
    }

    if (arg.startsWith("--root=")) {
      rootDir = arg.slice("--root=".length);
      continue;
    }

    if (action === null && !arg.startsWith("-")) {
      if (isManagePersonAction(arg)) {
        action = arg;
      } else {
        invalidAction = arg;
      }
      continue;
    }

    remainingArgs.push(arg);
  }

  return {
    action,
    rootDir,
    remainingArgs,
    showHelp,
    invalidAction,
  };
};

export const buildManagePersonHelpText = (): string => {
  const actionLines = MANAGE_PERSON_ACTION_DETAILS.map(
    (entry) => `  ${entry.action.padEnd(8)}${entry.summary}`,
  );

  return [
    "Manage people in open-links-sites through one explicit CRUD surface.",
    "",
    "Usage:",
    "  bun run manage:person -- <action> [options]",
    "",
    "Actions:",
    ...actionLines,
    "",
    "Examples:",
    '  bun run manage:person -- create --name "Alice Example"',
    '  bun run manage:person -- update --person "alice-example" --task rename --value "Alice Example"',
    "",
    "The repo-local skill lives at .agents/skills/manage-person/SKILL.md.",
  ].join("\n");
};
