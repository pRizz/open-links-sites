import process from "node:process";

import {
  buildManagePersonHelpText,
  parseManagePersonInvocation,
  type ManagePersonAction,
} from "./lib/manage-person/action-contract";

type OutputWriter = {
  write(text: string): void;
};

type ActionResult = {
  exitCode: number;
  stdout?: string;
  stderr?: string;
};

type ActionHandlerInput = {
  action: ManagePersonAction;
  rootDir: string;
  args: string[];
};

type ActionHandler = (input: ActionHandlerInput) => Promise<ActionResult>;

const notImplementedHandler: ActionHandler = async ({ action }) => ({
  exitCode: 1,
  stderr: `Action '${action}' is not implemented yet.\n`,
});

export const ACTION_HANDLERS: Record<ManagePersonAction, ActionHandler> = {
  create: notImplementedHandler,
  update: notImplementedHandler,
  disable: notImplementedHandler,
  archive: notImplementedHandler,
};

export interface RunManagePersonOptions {
  cwd?: string;
  stdout?: OutputWriter;
  stderr?: OutputWriter;
}

export const runManagePerson = async (
  argv: string[],
  options: RunManagePersonOptions = {},
): Promise<number> => {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const invocation = parseManagePersonInvocation(argv, options.cwd ?? process.cwd());

  if (invocation.showHelp || invocation.action === null) {
    const output = buildManagePersonHelpText();
    if (invocation.invalidAction) {
      stderr.write(`Unknown action '${invocation.invalidAction}'.\n\n`);
      stderr.write(`${output}\n`);
      return 1;
    }

    stdout.write(`${output}\n`);
    return 0;
  }

  const handler = ACTION_HANDLERS[invocation.action];
  const result = await handler({
    action: invocation.action,
    rootDir: invocation.rootDir,
    args: invocation.remainingArgs,
  });

  if (result.stdout) {
    stdout.write(result.stdout);
  }

  if (result.stderr) {
    stderr.write(result.stderr);
  }

  return result.exitCode;
};

if (import.meta.main) {
  process.exitCode = await runManagePerson(process.argv.slice(2));
}
