import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

export type BuildSelectionMode = "none" | "full" | "targeted";

export interface BuildSelection {
  mode: BuildSelectionMode;
  personIds: string[];
  reasons: string[];
  changedPaths: string[];
  ignoredPaths: string[];
}

const PERSON_PATH_PATTERN = /^people\/([^/]+)\//u;
const FULL_REBUILD_PREFIXES = ["schemas/", "scripts/", "src/", "templates/"] as const;
const FULL_REBUILD_EXACT_PATHS = [
  "biome.json",
  "bun.lock",
  "landing.html",
  "package.json",
  "tsconfig.json",
  "vite.landing.config.ts",
] as const;
const IGNORED_PREFIXES = [
  ".agents/",
  ".codex/",
  ".planning/",
  "docs/",
  "generated/",
  ".github/",
] as const;
const IGNORED_EXACT_PATHS = [".gitignore", "LICENSE", "README.md"] as const;

const normalizePath = (value: string): string => value.trim().replaceAll(path.sep, "/");

const isIgnoredPath = (value: string): boolean =>
  (IGNORED_EXACT_PATHS as readonly string[]).includes(value) ||
  IGNORED_PREFIXES.some((prefix) => value.startsWith(prefix));

const isFullRebuildPath = (value: string): boolean =>
  (FULL_REBUILD_EXACT_PATHS as readonly string[]).includes(value) ||
  FULL_REBUILD_PREFIXES.some((prefix) => value.startsWith(prefix));

export const detectBuildSelection = (rawChangedPaths: string[]): BuildSelection => {
  const changedPaths = rawChangedPaths.map(normalizePath).filter((entry) => entry.length > 0);
  const personIds = new Set<string>();
  const reasons: string[] = [];
  const ignoredPaths: string[] = [];
  let forceFullRebuild = false;

  for (const changedPath of changedPaths) {
    const maybePersonMatch = changedPath.match(PERSON_PATH_PATTERN);
    if (maybePersonMatch) {
      personIds.add(maybePersonMatch[1] ?? "");
      continue;
    }

    if (isIgnoredPath(changedPath)) {
      ignoredPaths.push(changedPath);
      continue;
    }

    if (isFullRebuildPath(changedPath)) {
      forceFullRebuild = true;
      reasons.push(changedPath);
      continue;
    }

    forceFullRebuild = true;
    reasons.push(`uncertain:${changedPath}`);
  }

  if (forceFullRebuild) {
    return {
      mode: "full",
      personIds: [],
      reasons: reasons.length > 0 ? reasons : ["shared build inputs changed"],
      changedPaths,
      ignoredPaths,
    };
  }

  if (personIds.size > 0) {
    return {
      mode: "targeted",
      personIds: [...personIds].sort((left, right) => left.localeCompare(right)),
      reasons: ["person-only changes"],
      changedPaths,
      ignoredPaths,
    };
  }

  return {
    mode: "none",
    personIds: [],
    reasons:
      ignoredPaths.length > 0 ? ["only ignored paths changed"] : ["no changed paths were provided"],
    changedPaths,
    ignoredPaths,
  };
};

export const loadChangedPaths = (input: {
  baseRef?: string;
  changedPaths?: string[];
  changedPathsFile?: string;
}): string[] => {
  if (input.changedPaths && input.changedPaths.length > 0) {
    return input.changedPaths;
  }

  if (input.changedPathsFile) {
    return readFileSync(input.changedPathsFile, "utf8")
      .split(/\r?\n/u)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  const baseRef = input.baseRef ?? "HEAD~1";
  const output = execFileSync("git", ["diff", "--name-only", baseRef, "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return output
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const formatBuildSelectionHuman = (selection: BuildSelection): string =>
  [
    `Mode: ${selection.mode}`,
    `People: ${selection.personIds.join(", ") || "none"}`,
    `Reasons: ${selection.reasons.join(", ") || "none"}`,
    `Changed paths: ${selection.changedPaths.length}`,
    `Ignored paths: ${selection.ignoredPaths.length}`,
  ].join("\n");
