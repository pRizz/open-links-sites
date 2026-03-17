const TRACKING_QUERY_PARAM_PREFIXES = ["utm_"] as const;
const TRACKING_QUERY_PARAMS = new Set(["fbclid", "gclid", "igshid", "mc_cid", "mc_eid", "si"]);

const PROFILE_HOSTS = new Set([
  "facebook.com",
  "fb.com",
  "gist.github.com",
  "github.com",
  "instagram.com",
  "linkedin.com",
  "lnkd.in",
  "medium.com",
  "primal.net",
  "substack.com",
  "twitter.com",
  "x.com",
  "youtu.be",
  "youtube.com",
]);

const KNOWN_LINK_LABELS = new Map<string, string>([
  ["facebook.com", "Facebook"],
  ["fb.com", "Facebook"],
  ["github.com", "GitHub"],
  ["gist.github.com", "GitHub"],
  ["instagram.com", "Instagram"],
  ["linkedin.com", "LinkedIn"],
  ["lnkd.in", "LinkedIn"],
  ["medium.com", "Medium"],
  ["primal.net", "Primal"],
  ["substack.com", "Substack"],
  ["twitter.com", "X"],
  ["x.com", "X"],
  ["youtu.be", "YouTube"],
  ["youtube.com", "YouTube"],
]);

export type ImportSourceKind = "linktree" | "links-list";

export interface ImportedLinkCandidate {
  label: string;
  url: string;
  description?: string;
  sourceOrder: number;
}

export interface ImportedProfileCandidate {
  name?: string;
  headline?: string;
  bio?: string;
  avatar?: string;
  location?: string;
  profileLinks: ImportedLinkCandidate[];
}

export interface ImportSourceSnapshot {
  kind: ImportSourceKind;
  sourceUrl?: string;
  fetchedUrl?: string;
  title?: string;
  description?: string;
  avatar?: string;
  linkCount: number;
  links: Array<{
    label: string;
    url: string;
  }>;
  warnings: string[];
}

export interface ImportIntakeResult {
  kind: ImportSourceKind;
  sourceUrl?: string;
  profile: ImportedProfileCandidate;
  links: ImportedLinkCandidate[];
  snapshot: ImportSourceSnapshot;
  warnings: string[];
}

const normalizeHost = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^www\./u, "");

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const normalizeWhitespace = (value: string): string => value.replace(/\s+/gu, " ").trim();

export const hasAllowedImportScheme = (value: string): boolean => {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
};

export const isRemoteHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const toAbsoluteImportUrl = (value: string, baseUrl?: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const resolved = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
    return hasAllowedImportScheme(resolved.toString()) ? resolved.toString() : undefined;
  } catch {
    return undefined;
  }
};

export const normalizeComparableUrl = (value: string): string => {
  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:") {
      url.hostname = normalizeHost(url.hostname);
      url.hash = "";

      if (
        (url.protocol === "https:" && url.port === "443") ||
        (url.protocol === "http:" && url.port === "80")
      ) {
        url.port = "";
      }

      for (const key of [...url.searchParams.keys()]) {
        const normalizedKey = key.toLowerCase();
        const isTrackingPrefix = TRACKING_QUERY_PARAM_PREFIXES.some((prefix) =>
          normalizedKey.startsWith(prefix),
        );

        if (TRACKING_QUERY_PARAMS.has(normalizedKey) || isTrackingPrefix) {
          url.searchParams.delete(key);
        }
      }

      const nextPathname = url.pathname.replace(/\/+$/u, "");
      url.pathname = nextPathname.length > 0 ? nextPathname : "/";
      const sortedParams = [...url.searchParams.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      );
      url.search = "";
      for (const [key, entryValue] of sortedParams) {
        url.searchParams.append(key, entryValue);
      }
    }

    return url.toString();
  } catch {
    return normalizeWhitespace(value).toLowerCase();
  }
};

export const isLikelyProfileLink = (value: string): boolean => {
  if (!isRemoteHttpUrl(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    const host = normalizeHost(url.hostname);
    return (
      PROFILE_HOSTS.has(host) || host.endsWith(".substack.com") || host.endsWith(".medium.com")
    );
  } catch {
    return false;
  }
};

export const deriveDefaultLinkLabel = (value: string): string => {
  try {
    const url = new URL(value);

    if (url.protocol === "mailto:") {
      return "Email";
    }

    if (url.protocol === "tel:") {
      return "Phone";
    }

    const host = normalizeHost(url.hostname);
    const knownLabel = KNOWN_LINK_LABELS.get(host);
    if (knownLabel) {
      return knownLabel;
    }

    const hostWithoutTld = host.split(".").slice(0, -1).join(" ") || host;
    return hostWithoutTld
      .split(/[-.\s]+/u)
      .filter((segment) => segment.length > 0)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  } catch {
    return "Imported Link";
  }
};

export const cleanSourceTitle = (value: string): string =>
  normalizeWhitespace(
    value
      .replace(/\s*[|:-]\s*linktree(?:\s*[^|:-]*)?$/iu, "")
      .replace(/\s*[|:-]\s*beacons(?:\s*[^|:-]*)?$/iu, "")
      .replace(/\s*[|:-]\s*links?$/iu, ""),
  );

export const slugifyStableSegment = (value: string): string =>
  safeDecode(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-");
