import {
  type ImportIntakeResult,
  type ImportedLinkCandidate,
  deriveDefaultLinkLabel,
  isLikelyProfileLink,
  normalizeComparableUrl,
  normalizeWhitespace,
  toAbsoluteImportUrl,
} from "./contracts";

const URL_PATTERN = /(https?:\/\/[^\s<>()]+|mailto:[^\s<>()]+|tel:[^\s<>()]+)/giu;

const trimCapturedUrl = (value: string): string => value.replace(/[),.;:!?]+$/u, "");

const extractLabelHint = (line: string, urlIndex: number): string | undefined => {
  const prefix = line
    .slice(0, Math.max(0, urlIndex))
    .replace(/^[-*+\d.)\s]+/u, "")
    .replace(/[:\-–—\s]+$/u, "");
  const label = normalizeWhitespace(prefix);
  return label.length > 0 ? label : undefined;
};

export interface ParseManualLinkListInput {
  text: string;
}

export const parseManualLinkList = (input: ParseManualLinkListInput): ImportIntakeResult => {
  const links: ImportedLinkCandidate[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const lines = input.text.split(/\r?\n/gu);
  let sourceOrder = 0;

  for (const line of lines) {
    const matches = [...line.matchAll(URL_PATTERN)];
    if (matches.length === 0) {
      continue;
    }

    for (const match of matches) {
      const rawUrl = trimCapturedUrl(match[0] ?? "");
      const resolvedUrl = toAbsoluteImportUrl(rawUrl);
      if (!resolvedUrl) {
        warnings.push(`Skipped invalid URL '${rawUrl}'.`);
        continue;
      }

      const comparableUrl = normalizeComparableUrl(resolvedUrl);
      if (seen.has(comparableUrl)) {
        continue;
      }

      seen.add(comparableUrl);
      const labelHint =
        typeof match.index === "number" ? extractLabelHint(line, match.index) : undefined;
      links.push({
        label: labelHint ?? deriveDefaultLinkLabel(resolvedUrl),
        url: resolvedUrl,
        sourceOrder,
      });
      sourceOrder += 1;
    }
  }

  if (links.length === 0) {
    warnings.push("No importable URLs were found in the pasted manual link list.");
  }

  const profileLinks = links.filter((link) => isLikelyProfileLink(link.url)).slice(0, 6);

  return {
    kind: "links-list",
    profile: {
      profileLinks,
    },
    links,
    snapshot: {
      kind: "links-list",
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
