import {
  type ImportIntakeResult,
  type ImportedLinkCandidate,
  cleanSourceTitle,
  deriveDefaultLinkLabel,
  isLikelyProfileLink,
  normalizeComparableUrl,
  normalizeWhitespace,
  toAbsoluteImportUrl,
} from "./contracts";

const normalizeHost = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^www\./u, "");

const HTML_ENTITY_MAP = new Map<string, string>([
  ["&amp;", "&"],
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&#39;", "'"],
  ["&nbsp;", " "],
]);

const decodeHtmlEntities = (value: string): string => {
  let decoded = value;

  for (const [entity, replacement] of HTML_ENTITY_MAP) {
    decoded = decoded.replaceAll(entity, replacement);
  }

  return decoded;
};

const stripHtml = (value: string): string =>
  normalizeWhitespace(decodeHtmlEntities(value.replace(/<[^>]+>/gu, " ")));

const matchFirst = (pattern: RegExp, value: string): string | undefined => {
  const match = value.match(pattern);
  const captured = match?.[1];
  if (!captured) {
    return undefined;
  }

  const normalized = stripHtml(captured);
  return normalized.length > 0 ? normalized : undefined;
};

const queryMetaContent = (
  html: string,
  selectors: Array<{ attr: string; value: string }>,
): string | undefined => {
  for (const selector of selectors) {
    const pattern = new RegExp(
      `<meta\\b[^>]*${selector.attr}=["']${selector.value}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      "iu",
    );
    const fallbackPattern = new RegExp(
      `<meta\\b[^>]*content=["']([^"']+)["'][^>]*${selector.attr}=["']${selector.value}["'][^>]*>`,
      "iu",
    );
    const matched = matchFirst(pattern, html) ?? matchFirst(fallbackPattern, html);
    if (matched) {
      return matched;
    }
  }

  return undefined;
};

const extractAnchorAttribute = (attributes: string, attributeName: string): string | undefined => {
  const match = attributes.match(new RegExp(`${attributeName}=["']([^"']+)["']`, "iu"));
  const captured = match?.[1];
  if (!captured) {
    return undefined;
  }

  const normalized = stripHtml(captured);
  return normalized.length > 0 ? normalized : undefined;
};

const shouldSkipAnchorUrl = (candidateUrl: string, sourceUrl: string): boolean => {
  try {
    const source = new URL(sourceUrl);
    const candidate = new URL(candidateUrl);

    if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
      return false;
    }

    if (
      normalizeComparableUrl(candidate.toString()) === normalizeComparableUrl(source.toString())
    ) {
      return true;
    }

    return normalizeHost(candidate.hostname) === normalizeHost(source.hostname);
  } catch {
    return false;
  }
};

export interface ParseLinktreeLikeHtmlInput {
  sourceUrl: string;
  fetchedUrl?: string;
  html: string;
}

export const parseLinktreeLikeHtml = (input: ParseLinktreeLikeHtmlInput): ImportIntakeResult => {
  const warnings: string[] = [];
  const titleCandidate =
    matchFirst(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu, input.html) ??
    queryMetaContent(input.html, [
      { attr: "property", value: "og:title" },
      { attr: "name", value: "twitter:title" },
    ]) ??
    matchFirst(/<title\b[^>]*>([\s\S]*?)<\/title>/iu, input.html);
  const descriptionCandidate =
    queryMetaContent(input.html, [
      { attr: "name", value: "description" },
      { attr: "property", value: "og:description" },
      { attr: "name", value: "twitter:description" },
    ]) ?? matchFirst(/<p\b[^>]*>([\s\S]*?)<\/p>/iu, input.html);
  const avatarCandidate = queryMetaContent(input.html, [
    { attr: "property", value: "og:image" },
    { attr: "name", value: "twitter:image" },
  ]);
  const resolvedAvatar = avatarCandidate
    ? toAbsoluteImportUrl(avatarCandidate, input.fetchedUrl ?? input.sourceUrl)
    : undefined;

  const anchorPattern = /<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/giu;
  const links: ImportedLinkCandidate[] = [];
  const seen = new Set<string>();
  let sourceOrder = 0;

  for (const match of input.html.matchAll(anchorPattern)) {
    const attributes = `${match[1] ?? ""} ${match[3] ?? ""}`;
    const href = match[2] ?? "";
    const resolvedUrl = toAbsoluteImportUrl(href, input.fetchedUrl ?? input.sourceUrl);
    if (!resolvedUrl || shouldSkipAnchorUrl(resolvedUrl, input.fetchedUrl ?? input.sourceUrl)) {
      continue;
    }

    const comparableUrl = normalizeComparableUrl(resolvedUrl);
    if (seen.has(comparableUrl)) {
      continue;
    }

    seen.add(comparableUrl);
    const label =
      stripHtml(match[4] ?? "") ||
      extractAnchorAttribute(attributes, "aria-label") ||
      extractAnchorAttribute(attributes, "title") ||
      deriveDefaultLinkLabel(resolvedUrl);

    links.push({
      label,
      url: resolvedUrl,
      sourceOrder,
    });
    sourceOrder += 1;
  }

  if (links.length === 0) {
    warnings.push(`No external links were extracted from '${input.sourceUrl}'.`);
  }

  const cleanedName = titleCandidate ? cleanSourceTitle(titleCandidate) : undefined;
  const profileLinks = links.filter((link) => isLikelyProfileLink(link.url)).slice(0, 6);

  return {
    kind: "linktree",
    sourceUrl: input.sourceUrl,
    profile: {
      name: cleanedName && cleanedName.length > 0 ? cleanedName : undefined,
      bio: descriptionCandidate,
      avatar: resolvedAvatar,
      profileLinks,
    },
    links,
    snapshot: {
      kind: "linktree",
      sourceUrl: input.sourceUrl,
      fetchedUrl: input.fetchedUrl ?? input.sourceUrl,
      title: cleanedName,
      description: descriptionCandidate,
      avatar: resolvedAvatar,
      linkCount: links.length,
      links: links.map((link) => ({
        label: link.label,
        url: link.url,
      })),
      warnings,
    },
    warnings,
  };
};
