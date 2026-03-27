import process from "node:process";

import { refreshPeopleCaches } from "./lib/import/refresh-people-caches";

interface RefreshPeopleCachesInvocation {
  rootDir: string;
  personQuery?: string;
  refreshAll: boolean;
  showHelp: boolean;
  usageError?: string;
}

type OutputWriter = {
  write(text: string): void;
};

export const buildRefreshPeopleCachesHelpText = (): string =>
  [
    "Refresh per-person cache and follower-history analytics artifacts without mutating canonical source files.",
    "",
    "Usage:",
    "  bun run refresh:people:caches -- --person <id-or-name> [--root <path>]",
    "  bun run refresh:people:caches -- --all [--root <path>]",
    "",
    "Options:",
    "  --person <query>          Refresh one active person by id or display name.",
    "  --all                     Refresh every active person and skip disabled or archived people.",
    "  --root <path>             Repo root. Defaults to the current working directory.",
    "  --help                    Show this help text.",
  ].join("\n");

export const parseRefreshPeopleCachesInvocation = (
  argv: string[],
  cwd: string,
): RefreshPeopleCachesInvocation => {
  const readSingleFlag = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    if (index < 0) {
      return undefined;
    }

    return argv[index + 1];
  };

  const showHelp = argv.includes("--help");
  const personQuery = readSingleFlag("--person");
  const refreshAll = argv.includes("--all");

  let usageError: string | undefined;
  if (!showHelp) {
    if (refreshAll && personQuery) {
      usageError = "Choose exactly one selector: --person or --all.";
    } else if (!refreshAll && !personQuery) {
      usageError = "Choose exactly one selector: --person or --all.";
    }
  }

  return {
    rootDir: readSingleFlag("--root") ?? cwd,
    personQuery,
    refreshAll,
    showHelp,
    usageError,
  };
};

export interface RunRefreshPeopleCachesOptions {
  cwd?: string;
  stdout?: OutputWriter;
  stderr?: OutputWriter;
}

export const runRefreshPeopleCaches = async (
  argv: string[],
  options: RunRefreshPeopleCachesOptions = {},
): Promise<number> => {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const invocation = parseRefreshPeopleCachesInvocation(argv, options.cwd ?? process.cwd());

  if (invocation.showHelp) {
    stdout.write(`${buildRefreshPeopleCachesHelpText()}\n`);
    return 0;
  }

  if (invocation.usageError) {
    stderr.write(`${invocation.usageError}\n\n${buildRefreshPeopleCachesHelpText()}\n`);
    return 1;
  }

  try {
    const result = await refreshPeopleCaches({
      rootDir: invocation.rootDir,
      personQuery: invocation.personQuery,
      refreshAll: invocation.refreshAll,
    });
    stdout.write(`${result.summary}\n`);
    return result.status === "failed" ? 1 : 0;
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
};

if (import.meta.main) {
  process.exitCode = await runRefreshPeopleCaches(process.argv.slice(2));
}
