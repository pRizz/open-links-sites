import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import type {
  LandingRegistryEntry,
  LandingRegistryPayload,
} from "../../../src/landing/registry-contract";
import {
  DEFAULT_EXTERNAL_BADGE_LABEL,
  type ExternalOpenLinksCachePayload,
  type ExternalOpenLinksConfigEntry,
  LANDING_REGISTRY_ASSETS_DIRECTORY,
  hostnameForUrl,
  loadExternalOpenLinksCache,
  loadExternalOpenLinksConfig,
  resolveLandingMediaAbsolutePath,
} from "../landing/external-openlinks";
import { loadPersonRegistry } from "../manage-person/person-registry";
import { DEFAULT_AVATAR_ASSET, isLocalAssetReference } from "../person-contract";
import { normalizeText, resolveNonPlaceholderText } from "../placeholder-text";
import {
  type DeploymentContextInput,
  resolveDeploymentContext,
  resolvePersonRoutePath,
} from "./deployment-context";
import { getGeneratedSiteLayout } from "./site-layout";

interface ProfilePayload {
  avatar?: unknown;
  headline?: unknown;
  bio?: unknown;
}

interface SitePayload {
  description?: unknown;
}

export interface BuildLandingRegistryInput extends DeploymentContextInput {
  rootDir: string;
  outputDir?: string;
}

export interface BuildLandingRegistryResult {
  outputPath: string;
  payload: LandingRegistryPayload;
}

export interface BuildLandingRegistryDependencies {
  loadPersonRegistry?: typeof loadPersonRegistry;
  loadExternalOpenLinksConfig?: typeof loadExternalOpenLinksConfig;
  loadExternalOpenLinksCache?: typeof loadExternalOpenLinksCache;
}

const readJsonFile = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, "utf8")) as T;

const resolveSummary = (profile: ProfilePayload, site: SitePayload): string | undefined => {
  const profileBio = resolveNonPlaceholderText(profile.bio);
  if (profileBio) {
    return profileBio;
  }

  return resolveNonPlaceholderText(site.description);
};

const resolveAvatarUrl = (avatar: unknown, personRoutePath: string): string | undefined => {
  const normalizedAvatar = normalizeText(avatar);
  if (!normalizedAvatar || normalizedAvatar === DEFAULT_AVATAR_ASSET) {
    return undefined;
  }

  if (isLocalAssetReference(normalizedAvatar)) {
    return `${personRoutePath}${normalizedAvatar}`;
  }

  return normalizedAvatar;
};

const compareRegistryEntries = (
  left: LandingRegistryEntry,
  right: LandingRegistryEntry,
): number => {
  const displayNameComparison = left.displayName.localeCompare(right.displayName);
  if (displayNameComparison !== 0) {
    return displayNameComparison;
  }

  const kindPriority = left.kind === right.kind ? 0 : left.kind === "local" ? -1 : 1;
  if (kindPriority !== 0) {
    return kindPriority;
  }

  return left.id.localeCompare(right.id);
};

const copyMirroredPreviewImage = (input: {
  rootDir: string;
  relativePath: string;
  outputDir: string;
  publicBasePath: string;
}): string => {
  const sourcePath = resolveLandingMediaAbsolutePath(input.rootDir, input.relativePath);
  if (!existsSync(sourcePath)) {
    throw new Error(`Cached external preview image is missing: ${input.relativePath}`);
  }

  mkdirSync(input.outputDir, { recursive: true });
  const targetFileName = basename(input.relativePath);
  copyFileSync(sourcePath, join(input.outputDir, targetFileName));
  return `${input.publicBasePath}landing-assets/${LANDING_REGISTRY_ASSETS_DIRECTORY}/${targetFileName}`;
};

const buildExternalEntry = (input: {
  rootDir: string;
  entry: ExternalOpenLinksConfigEntry;
  cachePayload: ExternalOpenLinksCachePayload;
  landingRegistryAssetsDir: string;
  publicBasePath: string;
}): LandingRegistryEntry => {
  const cacheEntry = input.cachePayload.entries[input.entry.id];
  if (!cacheEntry) {
    throw new Error(
      `Enabled external entry '${input.entry.id}' is missing a cache record. Run bun run refresh:landing:external.`,
    );
  }

  const href = input.entry.destinationUrl ?? cacheEntry.destinationUrl ?? cacheEntry.finalUrl;
  const subtitle =
    input.entry.subtitle ?? cacheEntry.subtitle ?? hostnameForUrl(href ?? input.entry.siteUrl);
  const previewImageUrl = cacheEntry.mirroredPreviewImagePath
    ? copyMirroredPreviewImage({
        rootDir: input.rootDir,
        relativePath: cacheEntry.mirroredPreviewImagePath,
        outputDir: input.landingRegistryAssetsDir,
        publicBasePath: input.publicBasePath,
      })
    : undefined;

  return {
    id: input.entry.id,
    kind: "external",
    displayName:
      input.entry.displayName ?? cacheEntry.displayName ?? hostnameForUrl(href) ?? input.entry.id,
    href,
    subtitle: subtitle ?? input.entry.id,
    badgeLabel: input.entry.badgeLabel ?? DEFAULT_EXTERNAL_BADGE_LABEL,
    openInNewTab: true,
    avatarUrl: input.entry.avatarUrl ?? cacheEntry.avatarUrl,
    previewImageUrl,
    headline: input.entry.headline ?? cacheEntry.headline,
    summary: input.entry.summary ?? cacheEntry.summary,
  } satisfies LandingRegistryEntry;
};

export const buildLandingRegistry = async (
  input: BuildLandingRegistryInput,
  dependencies: BuildLandingRegistryDependencies = {},
): Promise<BuildLandingRegistryResult> => {
  const deployment = resolveDeploymentContext(input);
  const layout = getGeneratedSiteLayout(input.rootDir);
  const outputPath = input.outputDir ?? layout.landingRegistryPath;
  const localRegistry = await (dependencies.loadPersonRegistry ?? loadPersonRegistry)(
    input.rootDir,
  );
  const externalConfigPayload = (
    dependencies.loadExternalOpenLinksConfig ?? loadExternalOpenLinksConfig
  )(input.rootDir);
  const externalCachePayload = (
    dependencies.loadExternalOpenLinksCache ?? loadExternalOpenLinksCache
  )(input.rootDir);

  const localEntries = localRegistry
    .filter((person) => person.lifecycleStatus === "active" && person.enabled !== false)
    .map((person) => {
      const profile = readJsonFile<ProfilePayload>(join(person.directoryPath, "profile.json"));
      const site = readJsonFile<SitePayload>(join(person.directoryPath, "site.json"));
      const personRoutePath = resolvePersonRoutePath(deployment.publicBasePath, person.id);
      const headline = resolveNonPlaceholderText(profile.headline);

      return {
        id: person.id,
        kind: "local",
        displayName: person.displayName,
        href: personRoutePath,
        subtitle: `/${person.id}`,
        avatarUrl: resolveAvatarUrl(profile.avatar, personRoutePath),
        headline,
        summary: resolveSummary(profile, site),
      } satisfies LandingRegistryEntry;
    });

  const localIds = new Set(localEntries.map((entry) => entry.id));
  const externalIds = new Set<string>();
  const externalEntries = externalConfigPayload.entries
    .filter((entry) => entry.enabled)
    .map((entry) => {
      if (localIds.has(entry.id)) {
        throw new Error(`External entry '${entry.id}' conflicts with a local managed page id.`);
      }

      if (externalIds.has(entry.id)) {
        throw new Error(`External entry '${entry.id}' is duplicated in config.`);
      }
      externalIds.add(entry.id);

      return buildExternalEntry({
        rootDir: input.rootDir,
        entry,
        cachePayload: externalCachePayload,
        landingRegistryAssetsDir: layout.landingRegistryAssetsDir,
        publicBasePath: deployment.publicBasePath,
      });
    });

  const payload: LandingRegistryPayload = {
    entries: [...localEntries, ...externalEntries].sort(compareRegistryEntries),
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return {
    outputPath,
    payload,
  };
};
