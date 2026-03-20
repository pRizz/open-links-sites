import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

import { normalizeText } from "../placeholder-text";
import {
  type ExternalOpenLinksCacheEntry,
  type ExternalOpenLinksCachePayload,
  type ExternalOpenLinksConfigEntry,
  deriveDisplayNameFromTitle,
  ensureLandingConfigDirectories,
  hostnameForUrl,
  loadExternalOpenLinksCache,
  loadExternalOpenLinksConfig,
  resolveLandingMediaRelativePath,
  writeExternalOpenLinksCache,
} from "./external-openlinks";

type FetchLike = typeof fetch;

interface HtmlTagAttributes {
  [key: string]: string;
}

interface ExtractedExternalSiteMetadata {
  finalUrl: string;
  destinationUrl?: string;
  displayName?: string;
  summary?: string;
  avatarUrl?: string;
  previewImageUrl?: string;
  manifestUrl?: string;
  verification: ExternalOpenLinksCacheEntry["verification"];
}

export interface RefreshExternalOpenLinksEntryResult {
  id: string;
  status: "updated" | "unchanged" | "warning" | "failed";
  detail: string;
}

export interface RefreshExternalOpenLinksResult {
  status: "passed" | "failed";
  cachePath: string;
  entries: RefreshExternalOpenLinksEntryResult[];
  summary: string;
}

export interface RefreshExternalOpenLinksDependencies {
  fetch?: FetchLike;
}

const IMAGE_CONTENT_TYPE_EXTENSION_MAP: Record<string, string> = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeUrl = (value: string | undefined): string | undefined => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return undefined;
  }

  try {
    return new URL(normalizedValue).toString();
  } catch {
    return undefined;
  }
};

const resolveRelativeUrl = (value: string | undefined, baseUrl: string): string | undefined => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return undefined;
  }

  try {
    return new URL(normalizedValue, baseUrl).toString();
  } catch {
    return undefined;
  }
};

const parseTagAttributes = (rawTag: string): HtmlTagAttributes => {
  const attributes: HtmlTagAttributes = {};
  const matches = rawTag.matchAll(/([^\s"'=<>`/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gu);

  for (const match of matches) {
    const key = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (key) {
      attributes[key] = value.trim();
    }
  }

  return attributes;
};

const collectTagAttributes = (html: string, tagName: string): HtmlTagAttributes[] => {
  const matches = html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "giu"));
  return [...matches].map((match) => parseTagAttributes(match[0]));
};

const firstMetaContent = (
  tags: HtmlTagAttributes[],
  key: "name" | "property",
  values: string[],
): string | undefined => {
  const normalizedValues = new Set(values.map((value) => value.toLowerCase()));

  for (const tag of tags) {
    const candidate = tag[key]?.toLowerCase();
    if (!candidate || !normalizedValues.has(candidate)) {
      continue;
    }

    const content = normalizeText(tag.content);
    if (content) {
      return content;
    }
  }

  return undefined;
};

const firstLinkHref = (tags: HtmlTagAttributes[], relToken: string): string | undefined => {
  for (const tag of tags) {
    const rel = normalizeText(tag.rel)?.toLowerCase();
    if (!rel) {
      continue;
    }

    if (rel.split(/\s+/u).includes(relToken.toLowerCase())) {
      return normalizeText(tag.href);
    }
  }

  return undefined;
};

const extractTitle = (html: string): string | undefined => {
  const matched = /<title[^>]*>([^<]+)<\/title>/iu.exec(html);
  return normalizeText(matched?.[1]);
};

const toOpenLinksVerification = (
  html: string,
  title: string | undefined,
  manifest: unknown,
  manifestUrl: string | undefined,
): ExternalOpenLinksCacheEntry["verification"] => {
  const reasons: string[] = [];
  const normalizedTitle = normalizeText(title)?.toLowerCase();

  if (normalizedTitle?.includes("openlinks")) {
    reasons.push("page title includes OpenLinks");
  }

  if (html.includes("openlinks-social-fallback")) {
    reasons.push("HTML references the OpenLinks social fallback asset");
  }

  if (isRecord(manifest)) {
    const manifestName = normalizeText(manifest.name)?.toLowerCase();
    const manifestShortName = normalizeText(manifest.short_name)?.toLowerCase();

    if (manifestName?.includes("openlinks")) {
      reasons.push("site.webmanifest name includes OpenLinks");
    }

    if (manifestShortName?.includes("openlinks")) {
      reasons.push("site.webmanifest short_name includes OpenLinks");
    }
  }

  return {
    status: reasons.length > 0 ? "confirmed" : "unclear",
    reasons:
      reasons.length > 0
        ? reasons
        : ["No clear OpenLinks marker was found in the HTML head or site.webmanifest."],
    manifestUrl,
  };
};

const maybeExtractManifest = async (
  fetchImpl: FetchLike,
  manifestUrl: string | undefined,
): Promise<unknown | undefined> => {
  if (!manifestUrl) {
    return undefined;
  }

  try {
    const response = await fetchImpl(manifestUrl, {
      headers: {
        Accept: "application/json, application/manifest+json;q=0.9, */*;q=0.1",
      },
    });

    if (!response.ok) {
      return undefined;
    }

    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
};

const extractExternalSiteMetadata = async (
  fetchImpl: FetchLike,
  configEntry: ExternalOpenLinksConfigEntry,
): Promise<ExtractedExternalSiteMetadata> => {
  const response = await fetchImpl(configEntry.siteUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not load ${configEntry.siteUrl} (${response.status}).`);
  }

  const finalUrl = response.url || configEntry.siteUrl;
  const html = await response.text();
  const metaTags = collectTagAttributes(html, "meta");
  const linkTags = collectTagAttributes(html, "link");
  const title =
    firstMetaContent(metaTags, "property", ["og:title"]) ??
    firstMetaContent(metaTags, "name", ["twitter:title"]) ??
    extractTitle(html);
  const description =
    firstMetaContent(metaTags, "property", ["og:description"]) ??
    firstMetaContent(metaTags, "name", ["description", "twitter:description"]);
  const iconHref =
    firstLinkHref(linkTags, "apple-touch-icon") ??
    firstLinkHref(linkTags, "icon") ??
    firstLinkHref(linkTags, "shortcut");
  const previewImageUrl = resolveRelativeUrl(
    firstMetaContent(metaTags, "property", ["og:image"]) ??
      firstMetaContent(metaTags, "name", ["twitter:image"]),
    finalUrl,
  );
  const destinationUrl =
    resolveRelativeUrl(firstLinkHref(linkTags, "canonical"), finalUrl) ?? normalizeUrl(finalUrl);
  const manifestUrl = resolveRelativeUrl(firstLinkHref(linkTags, "manifest"), finalUrl);
  const manifest = await maybeExtractManifest(fetchImpl, manifestUrl);

  return {
    finalUrl,
    destinationUrl,
    displayName: deriveDisplayNameFromTitle(title),
    summary: description,
    avatarUrl: resolveRelativeUrl(iconHref, finalUrl),
    previewImageUrl,
    manifestUrl,
    verification: toOpenLinksVerification(html, title, manifest, manifestUrl),
  };
};

const determineImageExtension = (url: string, contentType: string | null): string => {
  const normalizedContentType = normalizeText(contentType?.split(";")[0])?.toLowerCase();
  if (normalizedContentType && IMAGE_CONTENT_TYPE_EXTENSION_MAP[normalizedContentType]) {
    return IMAGE_CONTENT_TYPE_EXTENSION_MAP[normalizedContentType];
  }

  const normalizedExtension = extname(new URL(url).pathname).toLowerCase();
  if (normalizedExtension.length > 0 && normalizedExtension.length <= 5) {
    return normalizedExtension;
  }

  return ".img";
};

const syncPreviewImage = async (input: {
  fetchImpl: FetchLike;
  rootDir: string;
  entryId: string;
  sourceUrl?: string;
  previousPath?: string;
}): Promise<{ mirroredPath?: string; warning?: string }> => {
  if (!input.sourceUrl) {
    return {
      mirroredPath: input.previousPath,
    };
  }

  try {
    const response = await input.fetchImpl(input.sourceUrl, {
      headers: {
        Accept: "image/*,*/*;q=0.1",
      },
    });

    if (!response.ok) {
      return {
        mirroredPath: input.previousPath,
        warning: `preview image could not be fetched (${response.status}); keeping previous cache if available`,
      };
    }

    const extension = determineImageExtension(
      input.sourceUrl,
      response.headers.get("content-type"),
    );
    const fileName = `${input.entryId}-preview${extension}`;
    const layout = ensureLandingConfigDirectories(input.rootDir);
    const absolutePath = join(layout.externalOpenLinksMediaDir, fileName);
    const relativePath = resolveLandingMediaRelativePath(fileName);
    const imageBytes = Buffer.from(await response.arrayBuffer());

    writeFileSync(absolutePath, imageBytes);

    if (input.previousPath && input.previousPath !== relativePath) {
      rmSync(join(input.rootDir, input.previousPath), { force: true });
    }

    return {
      mirroredPath: relativePath,
    };
  } catch (error) {
    return {
      mirroredPath: input.previousPath,
      warning:
        error instanceof Error
          ? `preview image fetch failed (${error.message}); keeping previous cache if available`
          : "preview image fetch failed; keeping previous cache if available",
    };
  }
};

const buildRefreshedCacheEntry = async (input: {
  fetchImpl: FetchLike;
  rootDir: string;
  configEntry: ExternalOpenLinksConfigEntry;
  previousEntry?: ExternalOpenLinksCacheEntry;
  fetchedAt: string;
}): Promise<{ entry: ExternalOpenLinksCacheEntry; warnings: string[] }> => {
  const metadata = await extractExternalSiteMetadata(input.fetchImpl, input.configEntry);
  const previewImageSourceUrl = input.configEntry.previewImageUrl ?? metadata.previewImageUrl;
  const previewImageResult = await syncPreviewImage({
    fetchImpl: input.fetchImpl,
    rootDir: input.rootDir,
    entryId: input.configEntry.id,
    sourceUrl: previewImageSourceUrl,
    previousPath: input.previousEntry?.mirroredPreviewImagePath,
  });

  return {
    entry: {
      id: input.configEntry.id,
      siteUrl: input.configEntry.siteUrl,
      fetchedAt: input.fetchedAt,
      finalUrl: metadata.finalUrl,
      destinationUrl: metadata.destinationUrl,
      displayName: metadata.displayName,
      subtitle: hostnameForUrl(metadata.destinationUrl ?? metadata.finalUrl),
      summary: metadata.summary,
      avatarUrl: metadata.avatarUrl,
      previewImageSourceUrl,
      mirroredPreviewImagePath: previewImageResult.mirroredPath,
      verification: metadata.verification,
    },
    warnings: previewImageResult.warning ? [previewImageResult.warning] : [],
  };
};

const serializeCacheEntry = (entry: Omit<ExternalOpenLinksCacheEntry, "fetchedAt">): string =>
  JSON.stringify(entry, Object.keys(entry).sort());

const omitFetchedAt = (
  entry: ExternalOpenLinksCacheEntry,
): Omit<ExternalOpenLinksCacheEntry, "fetchedAt"> => {
  const { fetchedAt: _fetchedAt, ...rest } = entry;
  return rest;
};

const buildRefreshSummary = (result: RefreshExternalOpenLinksResult): string => {
  const updated = result.entries.filter((entry) => entry.status === "updated").length;
  const unchanged = result.entries.filter((entry) => entry.status === "unchanged").length;
  const warnings = result.entries.filter((entry) => entry.status === "warning").length;
  const failed = result.entries.filter((entry) => entry.status === "failed").length;

  return [
    "Refresh External OpenLinks",
    `Status: ${result.status}`,
    `Updated: ${updated} | unchanged: ${unchanged} | warnings: ${warnings} | failed: ${failed}`,
    ...result.entries.map((entry) => `- ${entry.id}: ${entry.status} (${entry.detail})`),
  ].join("\n");
};

export const refreshExternalOpenLinks = async (
  input: { rootDir: string },
  dependencies: RefreshExternalOpenLinksDependencies = {},
): Promise<RefreshExternalOpenLinksResult> => {
  const fetchImpl = dependencies.fetch ?? fetch;
  const layout = ensureLandingConfigDirectories(input.rootDir);
  const configPayload = loadExternalOpenLinksConfig(input.rootDir);
  const previousCachePayload = loadExternalOpenLinksCache(input.rootDir);
  const nextCachePayload: ExternalOpenLinksCachePayload = {
    version: previousCachePayload.version,
    entries: {},
  };
  const results: RefreshExternalOpenLinksEntryResult[] = [];
  const configuredIds = new Set(configPayload.entries.map((entry) => entry.id));
  const now = new Date().toISOString();

  for (const configEntry of configPayload.entries) {
    const previousEntry = previousCachePayload.entries[configEntry.id];
    if (!configEntry.enabled) {
      if (previousEntry) {
        nextCachePayload.entries[configEntry.id] = previousEntry;
      }
      results.push({
        id: configEntry.id,
        status: "unchanged",
        detail: "disabled in config; existing cache was preserved",
      });
      continue;
    }

    try {
      const refreshed = await buildRefreshedCacheEntry({
        fetchImpl,
        rootDir: input.rootDir,
        configEntry,
        previousEntry,
        fetchedAt: now,
      });
      const changed =
        !previousEntry ||
        serializeCacheEntry(omitFetchedAt(previousEntry)) !==
          serializeCacheEntry(omitFetchedAt(refreshed.entry));

      nextCachePayload.entries[configEntry.id] =
        !changed && previousEntry ? previousEntry : refreshed.entry;
      results.push({
        id: configEntry.id,
        status: refreshed.warnings.length > 0 ? "warning" : changed ? "updated" : "unchanged",
        detail:
          refreshed.warnings.length > 0
            ? refreshed.warnings.join("; ")
            : changed
              ? "cache refreshed"
              : "no cache changes",
      });
    } catch (error) {
      if (previousEntry) {
        nextCachePayload.entries[configEntry.id] = previousEntry;
      }
      results.push({
        id: configEntry.id,
        status: "failed",
        detail: error instanceof Error ? error.message : "refresh failed",
      });
    }
  }

  for (const [id, previousEntry] of Object.entries(previousCachePayload.entries)) {
    if (configuredIds.has(id) || nextCachePayload.entries[id]) {
      continue;
    }

    void previousEntry;
  }

  writeExternalOpenLinksCache(input.rootDir, nextCachePayload);

  const retainedPreviewPaths = new Set(
    Object.values(nextCachePayload.entries)
      .map((entry) => entry.mirroredPreviewImagePath)
      .filter((path): path is string => typeof path === "string" && path.length > 0)
      .map((path) => join(input.rootDir, path)),
  );

  for (const fileName of readdirSync(layout.externalOpenLinksMediaDir)) {
    const absolutePath = join(layout.externalOpenLinksMediaDir, fileName);
    if (retainedPreviewPaths.has(absolutePath) || fileName === ".gitkeep") {
      continue;
    }

    rmSync(absolutePath, { force: true, recursive: true });
  }

  const result: RefreshExternalOpenLinksResult = {
    status: results.some((entry) => entry.status === "failed") ? "failed" : "passed",
    cachePath: layout.externalOpenLinksCachePath,
    entries: results,
    summary: "",
  };
  result.summary = buildRefreshSummary(result);

  return result;
};
