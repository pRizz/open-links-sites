import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";

import { getGeneratedWorkspaceLayout, getPersonHelperLayout } from "./cache-layout";

const syncFile = (sourcePath: string, targetPath: string): boolean => {
  rmSync(targetPath, { force: true });

  if (!existsSync(sourcePath)) {
    return false;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath);
  return true;
};

const syncDirectory = (sourcePath: string, targetPath: string): boolean => {
  rmSync(targetPath, { recursive: true, force: true });

  if (!existsSync(sourcePath)) {
    return false;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { recursive: true });
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
