import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path, { join } from "node:path";
import process from "node:process";

const getDefaultOpenLinksCandidates = (): string[] => [
  process.env.OPEN_LINKS_REPO_DIR ?? "",
  join(homedir(), "Repos", "open-links"),
  join(homedir(), "open-links"),
];
const ROOT_FILE_NAMES = ["index.html", "package.json", "tsconfig.json", "vite.config.ts"] as const;
const SYMLINKED_ROOT_DIRECTORY_NAMES = ["node_modules"] as const;
const COPIED_ROOT_DIRECTORY_NAMES = ["config", "scripts", "src"] as const;
const ROOT_DATA_DIRECTORY = "data";
const ROOT_PUBLIC_DIRECTORY = "public";
const PUBLIC_CACHE_DIRECTORY = path.join(ROOT_PUBLIC_DIRECTORY, "cache");
const FOLLOWER_HISTORY_PUBLIC_ROOT = path.join(ROOT_PUBLIC_DIRECTORY, "history", "followers");
const FOLLOWER_HISTORY_INDEX_RELATIVE_PATH = "history/followers/index.json";
const EXCLUDED_MUTABLE_PUBLIC_PATHS = ["cache", "generated", "history/followers"] as const;

interface LinkRecord {
  id?: unknown;
  url?: unknown;
}

interface LinksPayload {
  links?: LinkRecord[];
}

interface FollowerHistoryIndexEntry {
  linkId?: unknown;
  canonicalUrl?: unknown;
  csvPath?: unknown;
  [key: string]: unknown;
}

interface FollowerHistoryIndexPayload {
  version?: unknown;
  updatedAt?: unknown;
  entries?: FollowerHistoryIndexEntry[];
}

const FOLLOWER_HISTORY_LINK_ID_COLUMN_INDEX = 1;

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
  for (const candidate of getDefaultOpenLinksCandidates()) {
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

const normalizeComparableUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if (
      (parsed.protocol === "https:" && parsed.port === "443") ||
      (parsed.protocol === "http:" && parsed.port === "80")
    ) {
      parsed.port = "";
    }

    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
    }

    return parsed.toString();
  } catch {
    return null;
  }
};

const normalizeRelativePath = (value: string): string =>
  value.split(path.sep).join("/").replace(/^\/+/u, "");

const copyDirectoryIfExists = async (
  sourceDir: string,
  targetDir: string,
  excludedRelativePaths: readonly string[] = [],
): Promise<void> => {
  if (!existsSync(sourceDir)) {
    return;
  }

  await cp(sourceDir, targetDir, {
    recursive: true,
    force: true,
    filter: (sourcePath) => {
      const relativePath = normalizeRelativePath(path.relative(sourceDir, sourcePath));
      if (!relativePath) {
        return true;
      }

      return !excludedRelativePaths.some(
        (excludedPath) =>
          relativePath === excludedPath || relativePath.startsWith(`${excludedPath}/`),
      );
    },
  });
};

const loadAllowedFollowerHistoryUrls = async (
  workspaceDir: string,
): Promise<Map<string, string>> => {
  const linksPath = path.join(workspaceDir, ROOT_DATA_DIRECTORY, "links.json");
  const parsed = JSON.parse(await readFile(linksPath, "utf8")) as LinksPayload;
  const urlsByLinkId = new Map<string, string>();

  for (const link of parsed.links ?? []) {
    if (typeof link?.id !== "string" || typeof link.url !== "string") {
      continue;
    }

    const normalizedUrl = normalizeComparableUrl(link.url);
    if (!normalizedUrl) {
      continue;
    }

    urlsByLinkId.set(link.id.trim(), normalizedUrl);
  }

  return urlsByLinkId;
};

const resolveFollowerHistoryRelativePath = (csvPath: string): string | null => {
  const normalizedPath = path.posix.normalize(csvPath.trim().replaceAll("\\", "/"));
  if (
    normalizedPath.startsWith("../") ||
    normalizedPath === ".." ||
    normalizedPath.startsWith("/") ||
    !normalizedPath.startsWith("history/followers/")
  ) {
    return null;
  }

  return normalizedPath;
};

const readCsvCell = (line: string, columnIndex: number): string | null => {
  let currentColumn = 0;
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      const nextCharacter = line[index + 1];
      if (insideQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      if (currentColumn === columnIndex) {
        return currentValue;
      }

      currentColumn += 1;
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  if (currentColumn === columnIndex) {
    return currentValue;
  }

  return null;
};

const filterFollowerHistoryCsvContents = (
  csvContents: string,
  allowedLinkIds: ReadonlySet<string>,
): {
  contents: string;
  retainedLinkIds: Set<string>;
} => {
  const normalizedContents = csvContents.replaceAll("\r\n", "\n");
  const lines = normalizedContents.split("\n");
  const [headerLine = ""] = lines;
  const filteredLines = [headerLine];
  const retainedLinkIds = new Set<string>();

  for (const line of lines.slice(1)) {
    if (line.trim().length === 0) {
      continue;
    }

    const linkId = readCsvCell(line, FOLLOWER_HISTORY_LINK_ID_COLUMN_INDEX)?.trim();
    if (!linkId || !allowedLinkIds.has(linkId)) {
      continue;
    }

    filteredLines.push(line);
    retainedLinkIds.add(linkId);
  }

  filteredLines.push("");

  return {
    contents: filteredLines.join("\n"),
    retainedLinkIds,
  };
};

const stageSanitizedFollowerHistory = async (
  workspaceDir: string,
  buildRoot: string,
  buildTimestamp?: string,
): Promise<void> => {
  const allowedUrlsByLinkId = await loadAllowedFollowerHistoryUrls(workspaceDir);
  const targetHistoryDir = path.join(buildRoot, FOLLOWER_HISTORY_PUBLIC_ROOT);
  await mkdir(targetHistoryDir, { recursive: true });

  const sourceIndexPath = path.join(
    workspaceDir,
    ROOT_PUBLIC_DIRECTORY,
    FOLLOWER_HISTORY_INDEX_RELATIVE_PATH,
  );
  let sourceIndex: FollowerHistoryIndexPayload | null = null;

  if (existsSync(sourceIndexPath)) {
    try {
      sourceIndex = JSON.parse(
        await readFile(sourceIndexPath, "utf8"),
      ) as FollowerHistoryIndexPayload;
    } catch {
      sourceIndex = null;
    }
  }

  const allowedLinkIdsByCsvPath = new Map<string, Set<string>>();
  const filteredEntries: FollowerHistoryIndexEntry[] = [];

  for (const entry of sourceIndex?.entries ?? []) {
    if (typeof entry.linkId !== "string" || typeof entry.canonicalUrl !== "string") {
      continue;
    }

    const normalizedLinkUrl = allowedUrlsByLinkId.get(entry.linkId.trim());
    const normalizedCanonicalUrl = normalizeComparableUrl(entry.canonicalUrl);
    if (
      !normalizedLinkUrl ||
      !normalizedCanonicalUrl ||
      normalizedLinkUrl !== normalizedCanonicalUrl
    ) {
      continue;
    }

    if (typeof entry.csvPath !== "string") {
      continue;
    }

    const relativeCsvPath = resolveFollowerHistoryRelativePath(entry.csvPath);
    if (!relativeCsvPath) {
      continue;
    }

    const sourceCsvPath = path.join(
      workspaceDir,
      ROOT_PUBLIC_DIRECTORY,
      ...relativeCsvPath.split("/"),
    );
    if (!existsSync(sourceCsvPath)) {
      continue;
    }

    filteredEntries.push(entry);
    const allowedLinkIds = allowedLinkIdsByCsvPath.get(relativeCsvPath) ?? new Set<string>();
    allowedLinkIds.add(entry.linkId.trim());
    allowedLinkIdsByCsvPath.set(relativeCsvPath, allowedLinkIds);
  }

  const publishedLinkIdsByCsvPath = new Map<string, Set<string>>();

  for (const [relativeCsvPath, allowedLinkIds] of allowedLinkIdsByCsvPath) {
    const sourceCsvPath = path.join(
      workspaceDir,
      ROOT_PUBLIC_DIRECTORY,
      ...relativeCsvPath.split("/"),
    );
    const targetCsvPath = path.join(
      buildRoot,
      ROOT_PUBLIC_DIRECTORY,
      ...relativeCsvPath.split("/"),
    );
    const filteredCsv = filterFollowerHistoryCsvContents(
      await readFile(sourceCsvPath, "utf8"),
      allowedLinkIds,
    );
    if (filteredCsv.retainedLinkIds.size === 0) {
      continue;
    }

    await mkdir(path.dirname(targetCsvPath), { recursive: true });
    await writeFile(targetCsvPath, filteredCsv.contents, "utf8");
    publishedLinkIdsByCsvPath.set(relativeCsvPath, filteredCsv.retainedLinkIds);
  }

  const sanitizedIndex = {
    version: typeof sourceIndex?.version === "number" ? sourceIndex.version : 1,
    updatedAt:
      buildTimestamp ??
      (typeof sourceIndex?.updatedAt === "string" && sourceIndex.updatedAt.trim().length > 0
        ? sourceIndex.updatedAt
        : new Date().toISOString()),
    entries: filteredEntries.filter((entry) => {
      if (typeof entry.linkId !== "string" || typeof entry.csvPath !== "string") {
        return false;
      }

      const relativeCsvPath = resolveFollowerHistoryRelativePath(entry.csvPath);
      if (!relativeCsvPath) {
        return false;
      }

      return publishedLinkIdsByCsvPath.get(relativeCsvPath)?.has(entry.linkId.trim()) ?? false;
    }),
  };

  await writeFile(
    path.join(targetHistoryDir, "index.json"),
    `${JSON.stringify(sanitizedIndex, null, 2)}\n`,
    "utf8",
  );
};

const stageBuildPublicRoot = async (
  repoDir: string,
  workspaceDir: string,
  buildRoot: string,
  buildTimestamp?: string,
): Promise<void> => {
  const buildPublicDir = path.join(buildRoot, ROOT_PUBLIC_DIRECTORY);
  await mkdir(buildPublicDir, { recursive: true });

  await copyDirectoryIfExists(
    path.join(repoDir, ROOT_PUBLIC_DIRECTORY),
    buildPublicDir,
    EXCLUDED_MUTABLE_PUBLIC_PATHS,
  );
  await copyDirectoryIfExists(
    path.join(workspaceDir, ROOT_PUBLIC_DIRECTORY),
    buildPublicDir,
    EXCLUDED_MUTABLE_PUBLIC_PATHS,
  );
  await copyDirectoryIfExists(
    path.join(workspaceDir, PUBLIC_CACHE_DIRECTORY),
    path.join(buildRoot, PUBLIC_CACHE_DIRECTORY),
  );
  await stageSanitizedFollowerHistory(workspaceDir, buildRoot, buildTimestamp);
};

export const runUpstreamWorkspaceSiteBuild = async (
  input: UpstreamWorkspaceSiteBuildInput,
): Promise<UpstreamWorkspaceSiteBuildResult> => {
  const repoDir = resolveOpenLinksRepoDir();
  const basePath = normalizeBasePath(input.basePath);
  const buildRoot = await stageBuildRoot(repoDir, input.workspaceDir, input.buildTimestamp);
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

export const stageBuildRoot = async (
  repoDir: string,
  workspaceDir: string,
  buildTimestamp?: string,
): Promise<string> => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "open-links-workspace-build-"));
  const buildRoot = path.join(tempRoot, "app");
  await mkdir(buildRoot, { recursive: true });

  for (const fileName of ROOT_FILE_NAMES) {
    await cp(path.join(repoDir, fileName), path.join(buildRoot, fileName));
  }

  for (const directoryName of SYMLINKED_ROOT_DIRECTORY_NAMES) {
    await symlink(path.join(repoDir, directoryName), path.join(buildRoot, directoryName), "dir");
  }

  for (const directoryName of COPIED_ROOT_DIRECTORY_NAMES) {
    await cp(path.join(repoDir, directoryName), path.join(buildRoot, directoryName), {
      recursive: true,
      force: true,
    });
  }

  await cp(
    path.join(workspaceDir, ROOT_DATA_DIRECTORY),
    path.join(buildRoot, ROOT_DATA_DIRECTORY),
    {
      recursive: true,
      force: true,
    },
  );
  await stageBuildPublicRoot(repoDir, workspaceDir, buildRoot, buildTimestamp);

  return buildRoot;
};
