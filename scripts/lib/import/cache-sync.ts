import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { getGeneratedWorkspaceLayout, getPersonHelperLayout } from "./cache-layout";

const CACHE_SYNC_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CACHE_SYNC_BIOME_CONFIG_PATH = join(CACHE_SYNC_REPO_ROOT, "biome.json");
const CACHE_SYNC_BIOME_BIN_PATH = join(
  CACHE_SYNC_REPO_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "biome.cmd" : "biome",
);

const maybeFormatSyncedJsonFile = (targetPath: string): void => {
  if (extname(targetPath) !== ".json") {
    return;
  }

  if (!existsSync(CACHE_SYNC_BIOME_CONFIG_PATH) || !existsSync(CACHE_SYNC_BIOME_BIN_PATH)) {
    return;
  }

  const result = spawnSync(
    CACHE_SYNC_BIOME_BIN_PATH,
    ["format", "--write", "--config-path", CACHE_SYNC_BIOME_CONFIG_PATH, targetPath],
    {
      cwd: CACHE_SYNC_REPO_ROOT,
      encoding: "utf8",
    },
  );

  if (result.status === 0) {
    return;
  }

  const maybeDetail = [result.error?.message, result.stderr, result.stdout].find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );

  throw new Error(
    maybeDetail
      ? `Failed to format synced cache JSON '${targetPath}': ${maybeDetail}`
      : `Failed to format synced cache JSON '${targetPath}'.`,
  );
};

const formatJsonFilesInDirectory = (targetPath: string): void => {
  if (!existsSync(targetPath)) {
    return;
  }

  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    const absolutePath = join(targetPath, entry.name);

    if (entry.isDirectory()) {
      formatJsonFilesInDirectory(absolutePath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    maybeFormatSyncedJsonFile(absolutePath);
  }
};

const syncFile = (sourcePath: string, targetPath: string): boolean => {
  rmSync(targetPath, { force: true });

  if (!existsSync(sourcePath)) {
    return false;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath);
  maybeFormatSyncedJsonFile(targetPath);
  return true;
};

const syncDirectory = (sourcePath: string, targetPath: string): boolean => {
  rmSync(targetPath, { recursive: true, force: true });

  if (!existsSync(sourcePath)) {
    return false;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { recursive: true });
  formatJsonFilesInDirectory(targetPath);
  return true;
};

export interface SyncWorkspaceCacheInput {
  rootDir: string;
  personId: string;
}

export interface SyncWorkspaceCacheResult {
  copiedPaths: string[];
}

export const syncWorkspaceCacheToPerson = (
  input: SyncWorkspaceCacheInput,
): SyncWorkspaceCacheResult => {
  const helperLayout = getPersonHelperLayout(input.rootDir, input.personId);
  const workspaceLayout = getGeneratedWorkspaceLayout(input.rootDir, input.personId);
  const copiedPaths: string[] = [];

  const fileMappings: Array<[string, string]> = [
    [workspaceLayout.files.profileAvatarManifest, helperLayout.files.profileAvatarManifest],
    [
      workspaceLayout.files.profileAvatarRuntimeManifest,
      helperLayout.files.profileAvatarRuntimeManifest,
    ],
    [workspaceLayout.files.contentImagesManifest, helperLayout.files.contentImagesManifest],
    [
      workspaceLayout.files.contentImagesRuntimeManifest,
      helperLayout.files.contentImagesRuntimeManifest,
    ],
    [workspaceLayout.files.richPublicCache, helperLayout.files.richPublicCache],
    [workspaceLayout.files.richAuthenticatedCache, helperLayout.files.richAuthenticatedCache],
    [workspaceLayout.files.generatedRichMetadata, helperLayout.files.generatedRichMetadata],
    [workspaceLayout.files.richEnrichmentReport, helperLayout.files.richEnrichmentReport],
  ];

  for (const [sourcePath, targetPath] of fileMappings) {
    if (syncFile(sourcePath, targetPath)) {
      copiedPaths.push(targetPath);
    }
  }

  const directoryMappings: Array<[string, string]> = [
    [workspaceLayout.dirs.profileAvatar, helperLayout.dirs.profileAvatar],
    [workspaceLayout.dirs.contentImages, helperLayout.dirs.contentImages],
    [workspaceLayout.dirs.richAuthenticated, helperLayout.dirs.richAuthenticated],
  ];

  for (const [sourcePath, targetPath] of directoryMappings) {
    if (syncDirectory(sourcePath, targetPath)) {
      copiedPaths.push(targetPath);
    }
  }

  return {
    copiedPaths,
  };
};
