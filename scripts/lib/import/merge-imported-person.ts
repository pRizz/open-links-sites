import type { ImportIntakeResult, ImportedLinkCandidate } from "./contracts";
import {
  deriveDefaultLinkLabel,
  isRemoteHttpUrl,
  normalizeComparableUrl,
  normalizeWhitespace,
  slugifyStableSegment,
} from "./contracts";

export interface MutablePersonDocuments {
  person: Record<string, unknown>;
  profile: Record<string, unknown>;
  links: Record<string, unknown>;
  site: Record<string, unknown>;
}

export interface MergeImportedPersonInput {
  documents: MutablePersonDocuments;
  intake: ImportIntakeResult;
  importedAt: string;
}

export interface MergeImportedPersonResult {
  appliedProfileFields: string[];
  addedLinkIds: string[];
  addedProfileLinks: string[];
  skippedDuplicateUrls: string[];
  replacedBootstrapLinks: boolean;
  changed: boolean;
}

type LinkRecord = Record<string, unknown>;

const ensureRecord = (value: unknown, context: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${context} to be an object.`);
  }

  return value as Record<string, unknown>;
};

const ensureObjectArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      )
    : [];

const ensureStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const isPlaceholderString = (value: unknown): boolean => {
  if (typeof value !== "string") {
    return true;
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  if (normalized.length === 0) {
    return true;
  }

  let placeholderUrl = false;
  try {
    const parsed = new URL(normalized);
    placeholderUrl = parsed.hostname === "example.com" || parsed.hostname === "www.example.com";
  } catch {
    placeholderUrl = normalized === "example.com" || normalized.startsWith("https://example.com/");
  }

  return (
    normalized.includes("todo:") ||
    placeholderUrl ||
    normalized.includes("avatar-placeholder") ||
    normalized === "placeholder"
  );
};

const isBootstrapLink = (value: Record<string, unknown>): boolean => {
  const url = typeof value.url === "string" ? value.url : undefined;
  const custom = value.custom;
  const customRecord =
    typeof custom === "object" && custom !== null && !Array.isArray(custom)
      ? (custom as Record<string, unknown>)
      : undefined;

  return (
    (url ? isPlaceholderString(url) : false) ||
    customRecord?.bootstrap === true ||
    customRecord?.bootstrapStatus === "placeholder"
  );
};

const replacePlaceholderValue = (
  record: Record<string, unknown>,
  key: string,
  nextValue: string | undefined,
  appliedLabel: string,
  appliedProfileFields: string[],
): boolean => {
  if (!nextValue || !isPlaceholderString(nextValue)) {
    if (!nextValue) {
      return false;
    }

    const currentValue = record[key];
    if (isPlaceholderString(currentValue)) {
      record[key] = nextValue;
      appliedProfileFields.push(appliedLabel);
      return true;
    }

    return false;
  }

  return false;
};

const resolveSourceRecord = (person: Record<string, unknown>): Record<string, unknown> => {
  const source = person.source;
  if (source === undefined) {
    const created: Record<string, unknown> = {};
    person.source = created;
    return created;
  }

  return ensureRecord(source, "person.source");
};

const normalizeLinkCandidate = (candidate: ImportedLinkCandidate): ImportedLinkCandidate => ({
  ...candidate,
  label: normalizeWhitespace(candidate.label) || deriveDefaultLinkLabel(candidate.url),
});

const createLinkRecord = (
  linkId: string,
  candidate: ImportedLinkCandidate,
  input: MergeImportedPersonInput,
): LinkRecord => {
  const custom: Record<string, unknown> = {
    import: {
      kind: input.intake.kind,
      importedAt: input.importedAt,
    },
  };

  if (input.intake.sourceUrl) {
    (custom.import as Record<string, unknown>).sourceUrl = input.intake.sourceUrl;
  }

  const link: LinkRecord = {
    id: linkId,
    label: candidate.label,
    url: candidate.url,
    type: isRemoteHttpUrl(candidate.url) ? "rich" : "simple",
    enabled: true,
    custom,
  };

  if (candidate.description) {
    link.description = candidate.description;
  }

  return link;
};

const buildUniqueLinkId = (label: string, url: string, existingIds: Set<string>): string => {
  const baseId =
    slugifyStableSegment(label) || slugifyStableSegment(new URL(url).hostname) || "imported-link";
  let nextId = baseId;
  let suffix = 2;

  while (existingIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  existingIds.add(nextId);
  return nextId;
};

const replaceOrAppendProfileLinks = (
  profile: Record<string, unknown>,
  importedLinks: ImportedLinkCandidate[],
): { changed: boolean; addedProfileLinks: string[] } => {
  const existingProfileLinks = ensureObjectArray(profile.profileLinks);
  const hasOnlyPlaceholders =
    existingProfileLinks.length === 0 ||
    existingProfileLinks.every((entry) => isBootstrapLink(entry));
  const comparableExisting = new Set<string>(
    hasOnlyPlaceholders
      ? []
      : existingProfileLinks
          .map((entry) =>
            typeof entry.url === "string" ? normalizeComparableUrl(entry.url) : undefined,
          )
          .filter((entry): entry is string => typeof entry === "string"),
  );

  const nextProfileLinks = hasOnlyPlaceholders ? [] : [...existingProfileLinks];
  const addedProfileLinks: string[] = [];

  for (const candidate of importedLinks.map(normalizeLinkCandidate)) {
    const comparableUrl = normalizeComparableUrl(candidate.url);
    if (comparableExisting.has(comparableUrl)) {
      continue;
    }

    comparableExisting.add(comparableUrl);
    nextProfileLinks.push({
      label: candidate.label,
      url: candidate.url,
    });
    addedProfileLinks.push(candidate.url);
  }

  if (hasOnlyPlaceholders || addedProfileLinks.length > 0) {
    profile.profileLinks = nextProfileLinks;
    return {
      changed: hasOnlyPlaceholders || addedProfileLinks.length > 0,
      addedProfileLinks,
    };
  }

  return {
    changed: false,
    addedProfileLinks,
  };
};

export const mergeImportedPerson = (input: MergeImportedPersonInput): MergeImportedPersonResult => {
  const person = ensureRecord(input.documents.person, "person.json");
  const profile = ensureRecord(input.documents.profile, "profile.json");
  const linksRoot = ensureRecord(input.documents.links, "links.json");
  const site = ensureRecord(input.documents.site, "site.json");

  const appliedProfileFields: string[] = [];
  let changed = false;

  if (
    replacePlaceholderValue(
      person,
      "displayName",
      input.intake.profile.name,
      "display name",
      appliedProfileFields,
    )
  ) {
    changed = true;
  }
  if (
    replacePlaceholderValue(
      profile,
      "name",
      input.intake.profile.name,
      "name",
      appliedProfileFields,
    )
  ) {
    changed = true;
  }
  if (
    replacePlaceholderValue(
      profile,
      "headline",
      input.intake.profile.headline,
      "headline",
      appliedProfileFields,
    )
  ) {
    changed = true;
  }
  if (
    replacePlaceholderValue(profile, "bio", input.intake.profile.bio, "bio", appliedProfileFields)
  ) {
    changed = true;
  }
  if (
    replacePlaceholderValue(
      profile,
      "location",
      input.intake.profile.location,
      "location",
      appliedProfileFields,
    )
  ) {
    changed = true;
  }
  if (
    replacePlaceholderValue(
      profile,
      "avatar",
      input.intake.profile.avatar,
      "avatar",
      appliedProfileFields,
    )
  ) {
    changed = true;
  }

  if (typeof input.intake.profile.name === "string" && isPlaceholderString(site.title)) {
    site.title = `${input.intake.profile.name} | OpenLinks`;
    appliedProfileFields.push("site title");
    changed = true;
  }

  if (typeof input.intake.profile.bio === "string" && isPlaceholderString(site.description)) {
    site.description = input.intake.profile.bio;
    appliedProfileFields.push("site description");
    changed = true;
  }

  const source = resolveSourceRecord(person);
  source.kind = input.intake.kind;
  if (input.intake.sourceUrl) {
    source.url = input.intake.sourceUrl;
  }
  const seedUrls = new Set<string>(ensureStringArray(source.seedUrls));
  if (input.intake.sourceUrl) {
    seedUrls.add(input.intake.sourceUrl);
  }
  for (const candidate of input.intake.links) {
    seedUrls.add(candidate.url);
  }
  source.seedUrls = [...seedUrls];
  source.lastImportedAt = input.importedAt;
  changed = true;

  const profileLinkResult = replaceOrAppendProfileLinks(profile, input.intake.profile.profileLinks);
  if (profileLinkResult.changed) {
    changed = true;
  }

  const existingLinks = ensureObjectArray(linksRoot.links);
  const existingOrder = ensureStringArray(linksRoot.order);
  const replaceBootstrapLinks =
    existingLinks.length === 0 || existingLinks.every((entry) => isBootstrapLink(entry));
  const workingLinks = replaceBootstrapLinks ? [] : [...existingLinks];
  const workingOrder = replaceBootstrapLinks ? [] : [...existingOrder];
  const existingIds = new Set<string>(
    workingLinks
      .map((entry) => (typeof entry.id === "string" ? entry.id : undefined))
      .filter((entry): entry is string => typeof entry === "string"),
  );
  const comparableUrls = new Set<string>(
    workingLinks
      .map((entry) =>
        typeof entry.url === "string" ? normalizeComparableUrl(entry.url) : undefined,
      )
      .filter((entry): entry is string => typeof entry === "string"),
  );
  const addedLinkIds: string[] = [];
  const skippedDuplicateUrls: string[] = [];

  for (const candidate of input.intake.links.map(normalizeLinkCandidate)) {
    const comparableUrl = normalizeComparableUrl(candidate.url);
    if (comparableUrls.has(comparableUrl)) {
      skippedDuplicateUrls.push(candidate.url);
      continue;
    }

    comparableUrls.add(comparableUrl);
    const linkId = buildUniqueLinkId(candidate.label, candidate.url, existingIds);
    workingLinks.push(createLinkRecord(linkId, candidate, input));
    workingOrder.push(linkId);
    addedLinkIds.push(linkId);
  }

  if (replaceBootstrapLinks || addedLinkIds.length > 0) {
    linksRoot.links = workingLinks;
    linksRoot.order = workingOrder;
    changed = true;
  }

  return {
    appliedProfileFields: [...new Set(appliedProfileFields)],
    addedLinkIds,
    addedProfileLinks: profileLinkResult.addedProfileLinks,
    skippedDuplicateUrls: [...new Set(skippedDuplicateUrls)],
    replacedBootstrapLinks: replaceBootstrapLinks && addedLinkIds.length > 0,
    changed,
  };
};
