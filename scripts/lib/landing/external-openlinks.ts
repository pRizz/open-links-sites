import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";

import { PERSON_ID_PATTERN } from "../person-contract";
import { normalizeText } from "../placeholder-text";
import type { ValidationIssue } from "../validation-output";

export const LANDING_CONFIG_DIRECTORY = posix.join("config", "landing");
export const EXTERNAL_OPENLINKS_CONFIG_FILE_NAME = "external-openlinks.json";
export const EXTERNAL_OPENLINKS_CACHE_FILE_NAME = "external-openlinks-cache.json";
export const EXTERNAL_OPENLINKS_MEDIA_DIRECTORY = "external-openlinks-media";
export const DEFAULT_EXTERNAL_BADGE_LABEL = "External";
export const LANDING_REGISTRY_ASSETS_DIRECTORY = "registry";
export const EXTERNAL_OPENLINKS_CACHE_VERSION = 1;

const LANDING_MEDIA_PATH_PREFIX = `${LANDING_CONFIG_DIRECTORY}/${EXTERNAL_OPENLINKS_MEDIA_DIRECTORY}/`;

export interface LandingConfigLayout {
  configDir: string;
  externalOpenLinksConfigPath: string;
  externalOpenLinksCachePath: string;
  externalOpenLinksMediaDir: string;
}

export interface ExternalOpenLinksConfigEntry {
  id: string;
  siteUrl: string;
  enabled: boolean;
  displayName?: string;
  destinationUrl?: string;
  subtitle?: string;
  badgeLabel?: string;
  avatarUrl?: string;
  previewImageUrl?: string;
  headline?: string;
  summary?: string;
}

export interface ExternalOpenLinksConfigPayload {
  entries: ExternalOpenLinksConfigEntry[];
}

export interface ExternalOpenLinksVerification {
  status: "confirmed" | "unclear";
  reasons: string[];
  manifestUrl?: string;
}

export interface ExternalOpenLinksCacheEntry {
  id: string;
  siteUrl: string;
  fetchedAt: string;
  finalUrl: string;
  destinationUrl?: string;
  displayName?: string;
  subtitle?: string;
  headline?: string;
  summary?: string;
  avatarUrl?: string;
  previewImageSourceUrl?: string;
  mirroredPreviewImagePath?: string;
  verification: ExternalOpenLinksVerification;
}

export interface ExternalOpenLinksCachePayload {
  version: typeof EXTERNAL_OPENLINKS_CACHE_VERSION;
  entries: Record<string, ExternalOpenLinksCacheEntry>;
}

interface ExternalOpenLinksConfigParseResult {
  payload?: ExternalOpenLinksConfigPayload;
  issue?: ValidationIssue;
}

interface ExternalOpenLinksCacheParseResult {
  payload?: ExternalOpenLinksCachePayload;
  issue?: ValidationIssue;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValidUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const assertString = (value: unknown, label: string): string => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return normalizedValue;
};

const assertOptionalString = (value: unknown, label: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return assertString(value, label);
};

const assertUrl = (value: unknown, label: string): string => {
  const normalizedValue = assertString(value, label);
  if (!isValidUrl(normalizedValue)) {
    throw new Error(`${label} must be an absolute URL.`);
  }

  return normalizedValue;
};

const assertOptionalUrl = (value: unknown, label: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return assertUrl(value, label);
};

const createValidationIssue = (
  code: string,
  message: string,
  path: string,
  severity: ValidationIssue["severity"] = "problem",
): ValidationIssue => ({
  severity,
  code,
  message,
  personId: "repository",
  file: path.startsWith(EXTERNAL_OPENLINKS_CONFIG_FILE_NAME)
    ? EXTERNAL_OPENLINKS_CONFIG_FILE_NAME
    : path.startsWith(EXTERNAL_OPENLINKS_CACHE_FILE_NAME)
      ? EXTERNAL_OPENLINKS_CACHE_FILE_NAME
      : undefined,
  path,
});

const readJsonFile = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, "utf8")) as T;

const parseExternalOpenLinksConfigEntry = (
  value: unknown,
  sourceLabel: string,
): ExternalOpenLinksConfigEntry => {
  if (!isRecord(value)) {
    throw new Error(`${sourceLabel} must be an object.`);
  }

  const id = assertString(value.id, `${sourceLabel}.id`);
  if (!PERSON_ID_PATTERN.test(id)) {
    throw new Error(`${sourceLabel}.id must match the shared person id pattern.`);
  }

  const siteUrl = assertUrl(value.siteUrl, `${sourceLabel}.siteUrl`);
  const enabled = value.enabled;
  if (typeof enabled !== "boolean") {
    throw new Error(`${sourceLabel}.enabled must be a boolean.`);
  }

  return {
    id,
    siteUrl,
    enabled,
    displayName: assertOptionalString(value.displayName, `${sourceLabel}.displayName`),
    destinationUrl: assertOptionalUrl(value.destinationUrl, `${sourceLabel}.destinationUrl`),
    subtitle: assertOptionalString(value.subtitle, `${sourceLabel}.subtitle`),
    badgeLabel: assertOptionalString(value.badgeLabel, `${sourceLabel}.badgeLabel`),
    avatarUrl: assertOptionalUrl(value.avatarUrl, `${sourceLabel}.avatarUrl`),
    previewImageUrl: assertOptionalUrl(value.previewImageUrl, `${sourceLabel}.previewImageUrl`),
    headline: assertOptionalString(value.headline, `${sourceLabel}.headline`),
    summary: assertOptionalString(value.summary, `${sourceLabel}.summary`),
  };
};

const parseExternalOpenLinksCacheEntry = (
  id: string,
  value: unknown,
  sourceLabel: string,
): ExternalOpenLinksCacheEntry => {
  if (!isRecord(value)) {
    throw new Error(`${sourceLabel} must be an object.`);
  }

  const entryId = assertString(value.id, `${sourceLabel}.id`);
  if (entryId !== id) {
    throw new Error(`${sourceLabel}.id must match cache key '${id}'.`);
  }

  const verification = value.verification;
  if (!isRecord(verification)) {
    throw new Error(`${sourceLabel}.verification must be an object.`);
  }

  const verificationStatus = assertString(
    verification.status,
    `${sourceLabel}.verification.status`,
  );
  if (verificationStatus !== "confirmed" && verificationStatus !== "unclear") {
    throw new Error(`${sourceLabel}.verification.status must be 'confirmed' or 'unclear'.`);
  }

  const reasons = verification.reasons;
  if (!Array.isArray(reasons) || !reasons.every((reason) => typeof reason === "string")) {
    throw new Error(`${sourceLabel}.verification.reasons must be a string array.`);
  }

  const fetchedAt = assertString(value.fetchedAt, `${sourceLabel}.fetchedAt`);
  if (Number.isNaN(Date.parse(fetchedAt))) {
    throw new Error(`${sourceLabel}.fetchedAt must be a valid date-time string.`);
  }

  return {
    id: entryId,
    siteUrl: assertUrl(value.siteUrl, `${sourceLabel}.siteUrl`),
    fetchedAt,
    finalUrl: assertUrl(value.finalUrl, `${sourceLabel}.finalUrl`),
    destinationUrl: assertOptionalUrl(value.destinationUrl, `${sourceLabel}.destinationUrl`),
    displayName: assertOptionalString(value.displayName, `${sourceLabel}.displayName`),
    subtitle: assertOptionalString(value.subtitle, `${sourceLabel}.subtitle`),
    headline: assertOptionalString(value.headline, `${sourceLabel}.headline`),
    summary: assertOptionalString(value.summary, `${sourceLabel}.summary`),
    avatarUrl: assertOptionalUrl(value.avatarUrl, `${sourceLabel}.avatarUrl`),
    previewImageSourceUrl: assertOptionalUrl(
      value.previewImageSourceUrl,
      `${sourceLabel}.previewImageSourceUrl`,
    ),
    mirroredPreviewImagePath: assertOptionalString(
      value.mirroredPreviewImagePath,
      `${sourceLabel}.mirroredPreviewImagePath`,
    ),
    verification: {
      status: verificationStatus,
      reasons: reasons.map((reason) => reason.trim()).filter((reason) => reason.length > 0),
      manifestUrl: assertOptionalUrl(
        verification.manifestUrl,
        `${sourceLabel}.verification.manifestUrl`,
      ),
    },
  };
};

const parseExternalOpenLinksConfigPayload = (
  value: unknown,
  pathLabel: string,
): ExternalOpenLinksConfigPayload => {
  if (!isRecord(value)) {
    throw new Error(`${pathLabel} must contain an object payload.`);
  }

  const entries = value.entries;
  if (!Array.isArray(entries)) {
    throw new Error(`${pathLabel}.entries must be an array.`);
  }

  return {
    entries: entries.map((entry, index) =>
      parseExternalOpenLinksConfigEntry(entry, `${pathLabel}.entries[${index}]`),
    ),
  };
};

const parseExternalOpenLinksCachePayload = (
  value: unknown,
  pathLabel: string,
): ExternalOpenLinksCachePayload => {
  if (!isRecord(value)) {
    throw new Error(`${pathLabel} must contain an object payload.`);
  }

  if (value.version !== EXTERNAL_OPENLINKS_CACHE_VERSION) {
    throw new Error(`${pathLabel}.version must equal ${EXTERNAL_OPENLINKS_CACHE_VERSION}.`);
  }

  const entriesValue = value.entries;
  if (!isRecord(entriesValue)) {
    throw new Error(`${pathLabel}.entries must be an object keyed by entry id.`);
  }

  const entries = Object.fromEntries(
    Object.entries(entriesValue).map(([id, entryValue]) => [
      id,
      parseExternalOpenLinksCacheEntry(id, entryValue, `${pathLabel}.entries.${id}`),
    ]),
  );

  return {
    version: EXTERNAL_OPENLINKS_CACHE_VERSION,
    entries,
  };
};

const safeParseExternalOpenLinksConfig = (
  filePath: string,
  allowMissing: boolean,
): ExternalOpenLinksConfigParseResult => {
  if (!existsSync(filePath)) {
    return allowMissing
      ? {
          payload: createEmptyExternalOpenLinksConfigPayload(),
        }
      : {
          issue: createValidationIssue(
            "external_openlinks_config_missing",
            "External OpenLinks config file is missing.",
            EXTERNAL_OPENLINKS_CONFIG_FILE_NAME,
          ),
        };
  }

  try {
    return {
      payload: parseExternalOpenLinksConfigPayload(
        readJsonFile<unknown>(filePath),
        EXTERNAL_OPENLINKS_CONFIG_FILE_NAME,
      ),
    };
  } catch (error) {
    return {
      issue: createValidationIssue(
        "external_openlinks_config_invalid",
        error instanceof Error ? error.message : "External OpenLinks config is invalid.",
        EXTERNAL_OPENLINKS_CONFIG_FILE_NAME,
      ),
    };
  }
};

const safeParseExternalOpenLinksCache = (
  filePath: string,
  allowMissing: boolean,
): ExternalOpenLinksCacheParseResult => {
  if (!existsSync(filePath)) {
    return allowMissing
      ? {
          payload: createEmptyExternalOpenLinksCachePayload(),
        }
      : {
          issue: createValidationIssue(
            "external_openlinks_cache_missing",
            "External OpenLinks cache file is missing.",
            EXTERNAL_OPENLINKS_CACHE_FILE_NAME,
          ),
        };
  }

  try {
    return {
      payload: parseExternalOpenLinksCachePayload(
        readJsonFile<unknown>(filePath),
        EXTERNAL_OPENLINKS_CACHE_FILE_NAME,
      ),
    };
  } catch (error) {
    return {
      issue: createValidationIssue(
        "external_openlinks_cache_invalid",
        error instanceof Error ? error.message : "External OpenLinks cache is invalid.",
        EXTERNAL_OPENLINKS_CACHE_FILE_NAME,
      ),
    };
  }
};

export const createEmptyExternalOpenLinksConfigPayload = (): ExternalOpenLinksConfigPayload => ({
  entries: [],
});

export const createEmptyExternalOpenLinksCachePayload = (): ExternalOpenLinksCachePayload => ({
  version: EXTERNAL_OPENLINKS_CACHE_VERSION,
  entries: {},
});

export const getLandingConfigLayout = (rootDir: string): LandingConfigLayout => {
  const configDir = join(rootDir, LANDING_CONFIG_DIRECTORY);

  return {
    configDir,
    externalOpenLinksConfigPath: join(configDir, EXTERNAL_OPENLINKS_CONFIG_FILE_NAME),
    externalOpenLinksCachePath: join(configDir, EXTERNAL_OPENLINKS_CACHE_FILE_NAME),
    externalOpenLinksMediaDir: join(configDir, EXTERNAL_OPENLINKS_MEDIA_DIRECTORY),
  };
};

export const ensureLandingConfigDirectories = (rootDir: string): LandingConfigLayout => {
  const layout = getLandingConfigLayout(rootDir);
  mkdirSync(layout.configDir, { recursive: true });
  mkdirSync(layout.externalOpenLinksMediaDir, { recursive: true });
  return layout;
};

export const loadExternalOpenLinksConfig = (
  rootDir: string,
  options: { allowMissing?: boolean } = {},
): ExternalOpenLinksConfigPayload => {
  const parsed = safeParseExternalOpenLinksConfig(
    getLandingConfigLayout(rootDir).externalOpenLinksConfigPath,
    options.allowMissing !== false,
  );

  if (!parsed.payload) {
    throw new Error(parsed.issue?.message ?? "Could not parse external OpenLinks config.");
  }

  return parsed.payload;
};

export const loadExternalOpenLinksCache = (
  rootDir: string,
  options: { allowMissing?: boolean } = {},
): ExternalOpenLinksCachePayload => {
  const parsed = safeParseExternalOpenLinksCache(
    getLandingConfigLayout(rootDir).externalOpenLinksCachePath,
    options.allowMissing !== false,
  );

  if (!parsed.payload) {
    throw new Error(parsed.issue?.message ?? "Could not parse external OpenLinks cache.");
  }

  return parsed.payload;
};

export const writeExternalOpenLinksCache = (
  rootDir: string,
  payload: ExternalOpenLinksCachePayload,
): string => {
  const layout = ensureLandingConfigDirectories(rootDir);
  writeFileSync(layout.externalOpenLinksCachePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return layout.externalOpenLinksCachePath;
};

export const resolveLandingMediaRelativePath = (fileName: string): string =>
  posix.join(LANDING_CONFIG_DIRECTORY, EXTERNAL_OPENLINKS_MEDIA_DIRECTORY, fileName);

export const resolveLandingMediaAbsolutePath = (rootDir: string, relativePath: string): string =>
  join(rootDir, relativePath);

export const deriveDisplayNameFromTitle = (title: string | undefined): string | undefined => {
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) {
    return undefined;
  }

  const strippedTitle = normalizedTitle
    .replace(/\s*(?:-|:|\|)\s*openlinks\s*$/iu, "")
    .replace(/^openlinks\s*(?:-|:|\|)\s*/iu, "")
    .trim();

  return strippedTitle.length > 0 ? strippedTitle : normalizedTitle;
};

export const hostnameForUrl = (value: string | undefined): string | undefined => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue || !isValidUrl(normalizedValue)) {
    return undefined;
  }

  return new URL(normalizedValue).hostname.replace(/^www\./u, "");
};

export const validateExternalOpenLinksRepository = (input: {
  rootDir: string;
  localIds?: Iterable<string>;
}): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const layout = getLandingConfigLayout(input.rootDir);
  const configResult = safeParseExternalOpenLinksConfig(layout.externalOpenLinksConfigPath, true);
  const cacheResult = safeParseExternalOpenLinksCache(layout.externalOpenLinksCachePath, true);

  if (configResult.issue) {
    issues.push(configResult.issue);
    return issues;
  }

  if (cacheResult.issue) {
    issues.push(cacheResult.issue);
    return issues;
  }

  const configPayload = configResult.payload ?? createEmptyExternalOpenLinksConfigPayload();
  const cachePayload = cacheResult.payload ?? createEmptyExternalOpenLinksCachePayload();
  const localIds = new Set(input.localIds ?? []);
  const seenExternalIds = new Set<string>();

  for (const [index, entry] of configPayload.entries.entries()) {
    const pathPrefix = `${EXTERNAL_OPENLINKS_CONFIG_FILE_NAME}.entries[${index}]`;

    if (seenExternalIds.has(entry.id)) {
      issues.push(
        createValidationIssue(
          "external_openlinks_duplicate_id",
          `External entry id '${entry.id}' is duplicated in config.`,
          `${pathPrefix}.id`,
        ),
      );
    } else {
      seenExternalIds.add(entry.id);
    }

    if (localIds.has(entry.id)) {
      issues.push(
        createValidationIssue(
          "landing_registry_id_conflict",
          `External entry id '${entry.id}' conflicts with a local managed page id.`,
          `${pathPrefix}.id`,
        ),
      );
    }

    if (!entry.enabled) {
      continue;
    }

    const cacheEntry = cachePayload.entries[entry.id];
    if (!cacheEntry) {
      issues.push(
        createValidationIssue(
          "external_openlinks_cache_required",
          `Enabled external entry '${entry.id}' is missing a cache record. Run \`bun run refresh:landing:external\`.`,
          `${pathPrefix}.id`,
        ),
      );
      continue;
    }

    const mirroredPreviewImagePath = cacheEntry.mirroredPreviewImagePath;
    if (mirroredPreviewImagePath) {
      if (!mirroredPreviewImagePath.startsWith(LANDING_MEDIA_PATH_PREFIX)) {
        issues.push(
          createValidationIssue(
            "external_openlinks_media_path_invalid",
            `External entry '${entry.id}' preview image path must stay under ${LANDING_MEDIA_PATH_PREFIX}.`,
            `${EXTERNAL_OPENLINKS_CACHE_FILE_NAME}.entries.${entry.id}.mirroredPreviewImagePath`,
          ),
        );
      } else if (
        !existsSync(resolveLandingMediaAbsolutePath(input.rootDir, mirroredPreviewImagePath))
      ) {
        issues.push(
          createValidationIssue(
            "external_openlinks_media_missing",
            `External entry '${entry.id}' preview image file is missing from the repo cache.`,
            `${EXTERNAL_OPENLINKS_CACHE_FILE_NAME}.entries.${entry.id}.mirroredPreviewImagePath`,
          ),
        );
      }
    }

    if (cacheEntry.verification.status === "unclear") {
      issues.push(
        createValidationIssue(
          "external_openlinks_verification_unclear",
          `External entry '${entry.id}' did not expose clear OpenLinks markers during refresh.`,
          `${EXTERNAL_OPENLINKS_CACHE_FILE_NAME}.entries.${entry.id}.verification.status`,
          "warning",
        ),
      );
    }
  }

  return issues;
};
