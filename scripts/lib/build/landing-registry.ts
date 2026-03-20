import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  LandingRegistryEntry,
  LandingRegistryPayload,
} from "../../../src/landing/registry-contract";
import { loadPersonRegistry } from "../manage-person/person-registry";
import {
  DEFAULT_AVATAR_ASSET,
  DEFAULT_TEMPLATE_REPLACEMENTS,
  isLocalAssetReference,
} from "../person-contract";
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
}

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isPlaceholderText = (value: string | undefined): boolean => {
  if (!value) {
    return true;
  }

  return (
    value.startsWith("TODO:") ||
    value === DEFAULT_TEMPLATE_REPLACEMENTS.profileHeadline ||
    value === DEFAULT_TEMPLATE_REPLACEMENTS.profileBio ||
    value === DEFAULT_TEMPLATE_REPLACEMENTS.siteDescription
  );
};

const readJsonFile = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, "utf8")) as T;

const resolveSummary = (profile: ProfilePayload, site: SitePayload): string | undefined => {
  const profileBio = normalizeText(profile.bio);
  if (profileBio && !isPlaceholderText(profileBio)) {
    return profileBio;
  }

  const siteDescription = normalizeText(site.description);
  return siteDescription && !isPlaceholderText(siteDescription) ? siteDescription : undefined;
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
  return displayNameComparison !== 0 ? displayNameComparison : left.id.localeCompare(right.id);
};

export const buildLandingRegistry = async (
  input: BuildLandingRegistryInput,
  dependencies: BuildLandingRegistryDependencies = {},
): Promise<BuildLandingRegistryResult> => {
  const deployment = resolveDeploymentContext(input);
  const layout = getGeneratedSiteLayout(input.rootDir);
  const outputPath = input.outputDir ?? layout.peopleRegistryPath;
  const registry = await (dependencies.loadPersonRegistry ?? loadPersonRegistry)(input.rootDir);

  const entries = registry
    .filter((person) => person.lifecycleStatus === "active" && person.enabled !== false)
    .map((person) => {
      const profile = readJsonFile<ProfilePayload>(join(person.directoryPath, "profile.json"));
      const site = readJsonFile<SitePayload>(join(person.directoryPath, "site.json"));
      const personRoutePath = resolvePersonRoutePath(deployment.publicBasePath, person.id);
      const headline = normalizeText(profile.headline);

      return {
        id: person.id,
        displayName: person.displayName,
        path: personRoutePath,
        avatarUrl: resolveAvatarUrl(profile.avatar, personRoutePath),
        headline: headline && !isPlaceholderText(headline) ? headline : undefined,
        summary: resolveSummary(profile, site),
      } satisfies LandingRegistryEntry;
    })
    .sort(compareRegistryEntries);

  const payload: LandingRegistryPayload = {
    entries,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return {
    outputPath,
    payload,
  };
};
