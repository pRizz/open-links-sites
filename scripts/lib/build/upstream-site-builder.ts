import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path, { join } from "node:path";
import process from "node:process";

const DEFAULT_OPEN_LINKS_CANDIDATES = [
  process.env.OPEN_LINKS_REPO_DIR,
  join(homedir(), "Repos", "open-links"),
  join(homedir(), "open-links"),
] as const;
const ROOT_FILE_NAMES = ["index.html", "package.json", "tsconfig.json", "vite.config.ts"] as const;
const ROOT_DIRECTORY_NAMES = ["node_modules", "scripts", "src"] as const;
const ROOT_DATA_DIRECTORY = "data";
const ROOT_PUBLIC_DIRECTORY = "public";

export interface UpstreamWorkspaceSiteBuildInput {
  workspaceDir: string;
  outDir: string;
  basePath: string;
  buildTimestamp?: string;
}

export interface UpstreamWorkspaceSiteBuildResult {
  repoDir: string;
  stdout?: string;
  stderr?: string;
}

export const resolveOpenLinksRepoDir = (): string => {
  for (const candidate of DEFAULT_OPEN_LINKS_CANDIDATES) {
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

const normalizeBasePath = (value: string): string => {
  const prefixed = value.startsWith("/") ? value : `/${value}`;
  return prefixed.endsWith("/") ? prefixed : `${prefixed}/`;
};

export const runUpstreamWorkspaceSiteBuild = async (
  input: UpstreamWorkspaceSiteBuildInput,
): Promise<UpstreamWorkspaceSiteBuildResult> => {
  const repoDir = resolveOpenLinksRepoDir();
  const basePath = normalizeBasePath(input.basePath);
  const buildRoot = await stageBuildRoot(repoDir, input.workspaceDir);
  const distDir = path.join(buildRoot, "dist");
  const result = spawnSync("bunx", ["vite", "build", "--outDir", distDir], {
    cwd: buildRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      BASE_PATH: basePath,
      OPENLINKS_BUILD_TIMESTAMP: input.buildTimestamp ?? process.env.OPENLINKS_BUILD_TIMESTAMP,
    },
  });

  const stdout = result.stdout?.trim() || undefined;
  const stderr = result.stderr?.trim() || undefined;

  try {
    if (result.status !== 0) {
      const details = [stderr, stdout].filter(Boolean).join("\n");
      throw new Error(
        details
          ? `Upstream site build failed (${result.status}).\n${details}`
          : `Upstream site build failed (${result.status}).`,
      );
    }

    await rm(input.outDir, { recursive: true, force: true });
    await mkdir(path.dirname(input.outDir), { recursive: true });
    await cp(distDir, input.outDir, { recursive: true });
  } finally {
    await rm(path.dirname(buildRoot), { recursive: true, force: true });
  }

  return {
    repoDir,
    stdout,
    stderr,
  };
};

const stageBuildRoot = async (repoDir: string, workspaceDir: string): Promise<string> => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "open-links-workspace-build-"));
  const buildRoot = path.join(tempRoot, "app");
  await mkdir(buildRoot, { recursive: true });

  for (const fileName of ROOT_FILE_NAMES) {
    await cp(path.join(repoDir, fileName), path.join(buildRoot, fileName));
  }

  for (const directoryName of ROOT_DIRECTORY_NAMES) {
    await symlink(path.join(repoDir, directoryName), path.join(buildRoot, directoryName), "dir");
  }

  await cp(path.join(repoDir, ROOT_DATA_DIRECTORY), path.join(buildRoot, ROOT_DATA_DIRECTORY), {
    recursive: true,
  });
  await cp(path.join(repoDir, ROOT_PUBLIC_DIRECTORY), path.join(buildRoot, ROOT_PUBLIC_DIRECTORY), {
    recursive: true,
  });
  await cp(
    path.join(workspaceDir, ROOT_DATA_DIRECTORY),
    path.join(buildRoot, ROOT_DATA_DIRECTORY),
    {
      recursive: true,
      force: true,
    },
  );
  await cp(
    path.join(workspaceDir, ROOT_PUBLIC_DIRECTORY),
    path.join(buildRoot, ROOT_PUBLIC_DIRECTORY),
    {
      recursive: true,
      force: true,
    },
  );

  return buildRoot;
};
