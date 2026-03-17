import { join } from "node:path";

import { GENERATED_ROOT, getPersonDirectory } from "../person-contract";

export const PERSON_CACHE_DIRECTORY = "cache";
export const PERSON_IMPORTS_DIRECTORY = "imports";

export interface PersonHelperLayout {
  personDir: string;
  cacheDir: string;
  importsDir: string;
  files: {
    profileAvatarManifest: string;
    profileAvatarRuntimeManifest: string;
    contentImagesManifest: string;
    contentImagesRuntimeManifest: string;
    richPublicCache: string;
    richAuthenticatedCache: string;
    generatedRichMetadata: string;
    richEnrichmentReport: string;
    sourceSnapshot: string;
    lastImportReport: string;
  };
  dirs: {
    profileAvatar: string;
    contentImages: string;
    richAuthenticated: string;
  };
}

export interface GeneratedWorkspaceLayout {
  outputDir: string;
  dataDir: string;
  publicDir: string;
  dataCacheDir: string;
  dataGeneratedDir: string;
  publicCacheDir: string;
  files: {
    profileAvatarManifest: string;
    profileAvatarRuntimeManifest: string;
    contentImagesManifest: string;
    contentImagesRuntimeManifest: string;
    richPublicCache: string;
    richAuthenticatedCache: string;
    generatedRichMetadata: string;
    richEnrichmentReport: string;
  };
  dirs: {
    profileAvatar: string;
    contentImages: string;
    richAuthenticated: string;
  };
}

export const getPersonHelperLayout = (rootDir: string, personId: string): PersonHelperLayout => {
  const personDir = join(rootDir, getPersonDirectory(personId));
  const cacheDir = join(personDir, PERSON_CACHE_DIRECTORY);
  const importsDir = join(personDir, PERSON_IMPORTS_DIRECTORY);

  return {
    personDir,
    cacheDir,
    importsDir,
    files: {
      profileAvatarManifest: join(cacheDir, "profile-avatar.json"),
      profileAvatarRuntimeManifest: join(cacheDir, "profile-avatar.runtime.json"),
      contentImagesManifest: join(cacheDir, "content-images.json"),
      contentImagesRuntimeManifest: join(cacheDir, "content-images.runtime.json"),
      richPublicCache: join(cacheDir, "rich-public-cache.json"),
      richAuthenticatedCache: join(cacheDir, "rich-authenticated-cache.json"),
      generatedRichMetadata: join(cacheDir, "rich-metadata.json"),
      richEnrichmentReport: join(cacheDir, "rich-enrichment-report.json"),
      sourceSnapshot: join(importsDir, "source-snapshot.json"),
      lastImportReport: join(importsDir, "last-import.json"),
    },
    dirs: {
      profileAvatar: join(cacheDir, "profile-avatar"),
      contentImages: join(cacheDir, "content-images"),
      richAuthenticated: join(cacheDir, "rich-authenticated"),
    },
  };
};

export const getGeneratedWorkspaceLayout = (
  rootDir: string,
  personId: string,
): GeneratedWorkspaceLayout => {
  const outputDir = join(rootDir, GENERATED_ROOT, personId);
  const dataDir = join(outputDir, "data");
  const publicDir = join(outputDir, "public");
  const dataCacheDir = join(dataDir, "cache");
  const dataGeneratedDir = join(dataDir, "generated");
  const publicCacheDir = join(publicDir, "cache");

  return {
    outputDir,
    dataDir,
    publicDir,
    dataCacheDir,
    dataGeneratedDir,
    publicCacheDir,
    files: {
      profileAvatarManifest: join(dataCacheDir, "profile-avatar.json"),
      profileAvatarRuntimeManifest: join(dataCacheDir, "profile-avatar.runtime.json"),
      contentImagesManifest: join(dataCacheDir, "content-images.json"),
      contentImagesRuntimeManifest: join(dataCacheDir, "content-images.runtime.json"),
      richPublicCache: join(dataCacheDir, "rich-public-cache.json"),
      richAuthenticatedCache: join(dataCacheDir, "rich-authenticated-cache.json"),
      generatedRichMetadata: join(dataGeneratedDir, "rich-metadata.json"),
      richEnrichmentReport: join(dataGeneratedDir, "rich-enrichment-report.json"),
    },
    dirs: {
      profileAvatar: join(publicCacheDir, "profile-avatar"),
      contentImages: join(publicCacheDir, "content-images"),
      richAuthenticated: join(publicCacheDir, "rich-authenticated"),
    },
  };
};
