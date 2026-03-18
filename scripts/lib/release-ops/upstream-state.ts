import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path, { dirname, join } from "node:path";
import process from "node:process";

export interface OpenLinksUpstreamState {
  version: 1;
  repository: string;
  branch: string;
  commit: string;
  syncedAt: string;
}

export interface ResolveLatestUpstreamStateInput {
  rootDir: string;
  upstreamRepoDir?: string;
  syncedAt?: string;
}

const DEFAULT_UPSTREAM_REPOSITORY = "pRizz/open-links";
const DEFAULT_UPSTREAM_BRANCH = "main";
const UPSTREAM_STATE_RELATIVE_PATH = ["config", "upstream-open-links.json"] as const;
const DEFAULT_OPEN_LINKS_CANDIDATES = [
  process.env.OPEN_LINKS_REPO_DIR,
  join(homedir(), "Repos", "open-links"),
  join(homedir(), "open-links"),
] as const;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeGitHubRepository = (value: string): string | null => {
  const trimmedValue = value.trim();
  const sshMatch = /^git@github\.com:(.+?)(?:\.git)?$/u.exec(trimmedValue);
  if (sshMatch) {
    return sshMatch[1];
  }

  const httpsMatch = /^https:\/\/github\.com\/(.+?)(?:\.git)?$/u.exec(trimmedValue);
  if (httpsMatch) {
    return httpsMatch[1];
  }

  return null;
};

const runGit = (repoDir: string, args: string[]): string => {
  const result = spawnSync("git", ["-C", repoDir, ...args], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const details = [result.stderr?.trim(), result.stdout?.trim()].filter(Boolean).join("\n");
    throw new Error(
      details
        ? `Git command failed in ${repoDir}: git ${args.join(" ")}\n${details}`
        : `Git command failed in ${repoDir}: git ${args.join(" ")}`,
    );
  }

  return result.stdout.trim();
};

export const getOpenLinksUpstreamStatePath = (rootDir: string): string =>
  path.resolve(rootDir, ...UPSTREAM_STATE_RELATIVE_PATH);

export const createOpenLinksUpstreamState = (
  input: Omit<OpenLinksUpstreamState, "version">,
): OpenLinksUpstreamState => ({
  version: 1,
  repository: input.repository,
  branch: input.branch,
  commit: input.commit,
  syncedAt: input.syncedAt,
});

export const shortCommit = (value: string): string => value.slice(0, 12);

export const readOpenLinksUpstreamState = (rootDir: string): OpenLinksUpstreamState => {
  const statePath = getOpenLinksUpstreamStatePath(rootDir);
  const parsed = JSON.parse(readFileSync(statePath, "utf8")) as Partial<OpenLinksUpstreamState>;

  if (
    parsed.version !== 1 ||
    !isNonEmptyString(parsed.repository) ||
    !isNonEmptyString(parsed.branch) ||
    !isNonEmptyString(parsed.commit) ||
    !isNonEmptyString(parsed.syncedAt)
  ) {
    throw new Error(`Invalid upstream state file at ${statePath}.`);
  }

  return {
    version: 1,
    repository: parsed.repository,
    branch: parsed.branch,
    commit: parsed.commit,
    syncedAt: parsed.syncedAt,
  };
};

export const writeOpenLinksUpstreamState = async (
  rootDir: string,
  state: OpenLinksUpstreamState,
): Promise<string> => {
  const statePath = getOpenLinksUpstreamStatePath(rootDir);
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return statePath;
};

export const resolveOpenLinksRepoDir = (explicitRepoDir?: string): string => {
  const candidates = [explicitRepoDir, ...DEFAULT_OPEN_LINKS_CANDIDATES];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (existsSync(join(candidate, "package.json")) && existsSync(join(candidate, "scripts"))) {
      return candidate;
    }
  }

  throw new Error(
    "Could not locate the upstream open-links repo. Set OPEN_LINKS_REPO_DIR or place it under ~/Repos/open-links.",
  );
};

export const resolveLatestOpenLinksUpstreamState = ({
  rootDir,
  upstreamRepoDir,
  syncedAt,
}: ResolveLatestUpstreamStateInput): OpenLinksUpstreamState => {
  const trackedState = readOpenLinksUpstreamState(rootDir);
  const repoDir = resolveOpenLinksRepoDir(upstreamRepoDir);
  const repository =
    normalizeGitHubRepository(runGit(repoDir, ["remote", "get-url", "origin"])) ??
    trackedState.repository ??
    DEFAULT_UPSTREAM_REPOSITORY;
  const branch = trackedState.branch || DEFAULT_UPSTREAM_BRANCH;
  const commit = runGit(repoDir, ["rev-parse", "HEAD"]);

  return createOpenLinksUpstreamState({
    repository,
    branch,
    commit,
    syncedAt: syncedAt ?? new Date().toISOString(),
  });
};

export const resolvePinnedOpenLinksCommit = (rootDir: string): string =>
  readOpenLinksUpstreamState(rootDir).commit;
