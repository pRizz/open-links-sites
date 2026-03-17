import { execFileSync } from "node:child_process";

export interface ResolveStableBuildTimestampOptions {
  explicitValue?: string;
  fallbackNow?: () => string;
  loadGitCommitTimestamp?: () => string | undefined;
}

export const resolveStableBuildTimestamp = (
  options: ResolveStableBuildTimestampOptions = {},
): string => {
  const explicitValue = options.explicitValue?.trim();
  if (explicitValue) {
    return explicitValue;
  }

  const gitCommitTimestamp =
    typeof options.loadGitCommitTimestamp === "function"
      ? options.loadGitCommitTimestamp()
      : loadGitCommitTimestampFromGit();
  if (gitCommitTimestamp) {
    return gitCommitTimestamp;
  }

  return (options.fallbackNow ?? (() => new Date().toISOString()))();
};

const loadGitCommitTimestampFromGit = (): string | undefined => {
  try {
    const output = execFileSync("git", ["log", "-1", "--format=%cI", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return output.length > 0 ? output : undefined;
  } catch {
    return undefined;
  }
};
