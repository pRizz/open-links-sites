import type { ImportIntakeResult, ImportedLinkCandidate } from "./contracts";

export interface UpstreamLinktreeBootstrapLink {
  label?: string;
  url?: string;
  sourceOrder?: number;
  linktreeType?: string;
  thumbnailUrl?: string;
}

export interface UpstreamLinktreeBootstrapSnapshot {
  kind?: "linktree";
  sourceUrl?: string;
  fetchedUrl?: string;
  title?: string;
  description?: string;
  avatar?: string;
  linkCount?: number;
  socialLinkCount?: number;
  links?: Array<{
    label?: string;
    url?: string;
  }>;
  socialLinks?: Array<{
    label?: string;
    url?: string;
  }>;
  warnings?: string[];
}

export interface UpstreamLinktreeBootstrapResult {
  kind?: "linktree";
  sourceUrl?: string;
  fetchedUrl?: string;
  profile?: {
    name?: string;
    bio?: string;
    avatar?: string;
    socialLinks?: UpstreamLinktreeBootstrapLink[];
  };
  links?: UpstreamLinktreeBootstrapLink[];
  snapshot?: UpstreamLinktreeBootstrapSnapshot;
  warnings?: string[];
}

const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeImportedLink = (
  candidate: UpstreamLinktreeBootstrapLink,
): ImportedLinkCandidate | null => {
  const label = safeTrim(candidate.label);
  const url = safeTrim(candidate.url);

  if (!label || !url) {
    return null;
  }

  return {
    label,
    url,
    sourceOrder:
      typeof candidate.sourceOrder === "number" && Number.isFinite(candidate.sourceOrder)
        ? candidate.sourceOrder
        : 0,
  };
};

export const adaptLinktreeBootstrapResult = (
  input: UpstreamLinktreeBootstrapResult,
): ImportIntakeResult => {
  const warnings = (input.warnings ?? []).filter(
    (value): value is string => typeof value === "string",
  );
  const links = (input.links ?? [])
    .map(normalizeImportedLink)
    .filter((value): value is ImportedLinkCandidate => value !== null)
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
  const profileLinks = (input.profile?.socialLinks ?? [])
    .map(normalizeImportedLink)
    .filter((value): value is ImportedLinkCandidate => value !== null)
    .sort((left, right) => left.sourceOrder - right.sourceOrder)
    .slice(0, 6);

  return {
    kind: "linktree",
    sourceUrl: safeTrim(input.sourceUrl),
    profile: {
      name: safeTrim(input.profile?.name),
      bio: safeTrim(input.profile?.bio),
      avatar: safeTrim(input.profile?.avatar),
      profileLinks,
    },
    links,
    snapshot: {
      kind: "linktree",
      sourceUrl: safeTrim(input.snapshot?.sourceUrl) ?? safeTrim(input.sourceUrl),
      fetchedUrl: safeTrim(input.snapshot?.fetchedUrl) ?? safeTrim(input.fetchedUrl),
      title: safeTrim(input.snapshot?.title) ?? safeTrim(input.profile?.name),
      description: safeTrim(input.snapshot?.description) ?? safeTrim(input.profile?.bio),
      avatar: safeTrim(input.snapshot?.avatar) ?? safeTrim(input.profile?.avatar),
      linkCount:
        typeof input.snapshot?.linkCount === "number" && Number.isFinite(input.snapshot.linkCount)
          ? input.snapshot.linkCount
          : links.length,
      socialLinkCount:
        typeof input.snapshot?.socialLinkCount === "number" &&
        Number.isFinite(input.snapshot.socialLinkCount)
          ? input.snapshot.socialLinkCount
          : profileLinks.length,
      links: links.map((link) => ({
        label: link.label,
        url: link.url,
      })),
      socialLinks: profileLinks.map((link) => ({
        label: link.label,
        url: link.url,
      })),
      warnings,
    },
    warnings,
  };
};
