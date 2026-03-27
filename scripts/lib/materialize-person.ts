import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { getGeneratedWorkspaceLayout, getPersonHelperLayout } from "./import/cache-layout";
import { GENERATED_ROOT, PERSON_REQUIRED_FILES, isLocalAssetReference } from "./person-contract";
import { discoverPeople } from "./person-discovery";
import { resolveOpenLinksRepoDir } from "./release-ops/upstream-state";
import { validateDiscoveredPerson } from "./validate-person";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const syncUpstreamWorkspaceSupportFiles = (outputDir: string): void => {
  let upstreamRepoDir: string;
  try {
    upstreamRepoDir = resolveOpenLinksRepoDir();
  } catch {
    return;
  }

  cpSync(join(upstreamRepoDir, "schema"), join(outputDir, "schema"), {
    recursive: true,
  });
  cpSync(join(upstreamRepoDir, "data", "policy"), join(outputDir, "data", "policy"), {
    recursive: true,
  });
  cpSync(
    join(upstreamRepoDir, "data", "cache", "rich-authenticated-cache.json"),
    join(outputDir, "data", "cache", "rich-authenticated-cache.json"),
  );
};

const writeEmptyFollowerHistoryIndex = (targetPath: string): void => {
  writeFileSync(
    targetPath,
    `${JSON.stringify(
      {
        version: 1,
        updatedAt: "1970-01-01T00:00:00.000Z",
        entries: [],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

const translateLocalAssetReferences = (value: unknown, publicRoot: string): unknown => {
  if (typeof value === "string") {
    return isLocalAssetReference(value) ? pathToFileURL(join(publicRoot, value)).toString() : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => translateLocalAssetReferences(entry, publicRoot));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        translateLocalAssetReferences(entryValue, publicRoot),
      ]),
    );
  }

  return value;
};

export interface MaterializePersonInput {
  personId: string;
  rootDir: string;
}

export interface MaterializedWorkspace {
  personId: string;
  sourceDir: string;
  outputDir: string;
  dataDir: string;
  publicDir: string;
  layout: ReturnType<typeof getGeneratedWorkspaceLayout>;
}

export const materializePerson = async (
  input: MaterializePersonInput,
): Promise<MaterializedWorkspace> => {
  const discoveredPeople = await discoverPeople(input.rootDir);
  const person = discoveredPeople.find((entry) => entry.directoryName === input.personId);

  if (!person) {
    throw new Error(`Could not find people/${input.personId}/person.json`);
  }

  const validation = await validateDiscoveredPerson(person);
  const blockingIssues = validation.issues.filter((issue) => issue.severity === "problem");
  if (blockingIssues.length > 0) {
    throw new Error(
      `Cannot materialize ${input.personId} because validation still has problems: ${blockingIssues
        .map((issue) => issue.code)
        .join(", ")}`,
    );
  }

  const outputDir = join(input.rootDir, GENERATED_ROOT, input.personId);
  const layout = getGeneratedWorkspaceLayout(input.rootDir, input.personId);
  const helperLayout = getPersonHelperLayout(input.rootDir, input.personId);
  const dataDir = layout.dataDir;
  const publicDir = layout.publicDir;

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });
  mkdirSync(layout.dataCacheDir, { recursive: true });
  mkdirSync(layout.dataGeneratedDir, { recursive: true });
  mkdirSync(layout.dirs.profileAvatar, { recursive: true });
  mkdirSync(layout.dirs.contentImages, { recursive: true });
  mkdirSync(layout.dirs.richAuthenticated, { recursive: true });
  mkdirSync(layout.dirs.followerHistory, { recursive: true });
  syncUpstreamWorkspaceSupportFiles(outputDir);

  for (const fileName of PERSON_REQUIRED_FILES) {
    if (fileName === "person.json") {
      continue;
    }

    const sourcePath = join(person.directoryPath, fileName);
    const sourceValue = JSON.parse(readFileSync(sourcePath, "utf8")) as unknown;
    const materializedValue = translateLocalAssetReferences(sourceValue, publicDir);
    writeFileSync(
      join(dataDir, fileName),
      `${JSON.stringify(materializedValue, null, 2)}\n`,
      "utf8",
    );
  }

  cpSync(join(person.directoryPath, "assets"), join(publicDir, "assets"), {
    recursive: true,
  });

  const helperFileMappings: Array<[string, string]> = [
    [helperLayout.files.profileAvatarManifest, layout.files.profileAvatarManifest],
    [helperLayout.files.profileAvatarRuntimeManifest, layout.files.profileAvatarRuntimeManifest],
    [helperLayout.files.contentImagesManifest, layout.files.contentImagesManifest],
    [helperLayout.files.contentImagesRuntimeManifest, layout.files.contentImagesRuntimeManifest],
    [helperLayout.files.richPublicCache, layout.files.richPublicCache],
    [helperLayout.files.richAuthenticatedCache, layout.files.richAuthenticatedCache],
    [helperLayout.files.generatedRichMetadata, layout.files.generatedRichMetadata],
    [helperLayout.files.richEnrichmentReport, layout.files.richEnrichmentReport],
  ];

  for (const [sourcePath, targetPath] of helperFileMappings) {
    try {
      cpSync(sourcePath, targetPath);
    } catch (error) {
      const maybeError = error as NodeJS.ErrnoException;
      if (maybeError.code !== "ENOENT") {
        throw error;
      }
    }
  }

  const helperDirectoryMappings: Array<[string, string]> = [
    [helperLayout.dirs.profileAvatar, layout.dirs.profileAvatar],
    [helperLayout.dirs.contentImages, layout.dirs.contentImages],
    [helperLayout.dirs.richAuthenticated, layout.dirs.richAuthenticated],
    [helperLayout.dirs.followerHistory, layout.dirs.followerHistory],
  ];

  for (const [sourcePath, targetPath] of helperDirectoryMappings) {
    try {
      cpSync(sourcePath, targetPath, {
        recursive: true,
      });
    } catch (error) {
      const maybeError = error as NodeJS.ErrnoException;
      if (maybeError.code !== "ENOENT") {
        throw error;
      }
    }
  }

  if (!existsSync(layout.files.followerHistoryIndex)) {
    writeEmptyFollowerHistoryIndex(layout.files.followerHistoryIndex);
  }

  return {
    personId: input.personId,
    sourceDir: person.directoryPath,
    outputDir,
    dataDir,
    publicDir,
    layout,
  };
};
