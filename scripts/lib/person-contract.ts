import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

export const PEOPLE_ROOT = "people";
export const GENERATED_ROOT = "generated";
export const PERSON_METADATA_FILE = "person.json";
export const PERSON_REQUIRED_FILES = [
  PERSON_METADATA_FILE,
  "profile.json",
  "links.json",
  "site.json",
] as const;
export const PERSON_REQUIRED_DIRECTORIES = ["assets"] as const;
export const PERSON_DISCOVERY_PATTERN = `${PEOPLE_ROOT}/*/${PERSON_METADATA_FILE}`;
export const PERSON_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const LOCAL_ASSET_PATH_PREFIX = "assets/";
export const TEMPLATE_ROOT = "templates/default";
export const DEFAULT_THEME_IDS = ["sleek", "daybreak", "sleek-emerald", "sleek-mono"] as const;
export const DEFAULT_AVATAR_ASSET = "assets/avatar-placeholder.svg";
export const LOCAL_ASSET_URI_BASE = "https://local-assets.open-links.invalid/";

export const TEMPLATE_VARIABLES = {
  personId: "__PERSON_ID__",
  personName: "__PERSON_NAME__",
  primaryLinkUrl: "__PRIMARY_LINK_URL__",
  profileHeadline: "__PROFILE_HEADLINE__",
  profileBio: "__PROFILE_BIO__",
  profileLocation: "__PROFILE_LOCATION__",
  siteTitle: "__SITE_TITLE__",
  siteDescription: "__SITE_DESCRIPTION__",
} as const;

export type PersonRequiredFile = (typeof PERSON_REQUIRED_FILES)[number];
export type PersonRequiredDirectory = (typeof PERSON_REQUIRED_DIRECTORIES)[number];
export type TemplateVariableName = keyof typeof TEMPLATE_VARIABLES;
export type TemplateReplacementMap = Record<TemplateVariableName, string>;

export const DEFAULT_TEMPLATE_REPLACEMENTS: TemplateReplacementMap = {
  personId: "example-person",
  personName: "Example Person",
  primaryLinkUrl: "https://example.com/example-person",
  profileHeadline: "TODO: add a short headline",
  profileBio: "TODO: add a one or two sentence bio for this person.",
  profileLocation: "TODO: add location",
  siteTitle: "Example Person | OpenLinks",
  siteDescription: "TODO: add a concise site description for this person.",
};

export const TEMPLATE_FILE_MAP = {
  person: "person.json",
  profile: "profile.json",
  links: "links.json",
  site: "site.json",
} as const;

export type TemplateFileKind = keyof typeof TEMPLATE_FILE_MAP;

export const resolveRepoPath = (relativePath: string): string =>
  fileURLToPath(new URL(`../../${relativePath}`, import.meta.url));

export const getPersonDirectory = (personId: string): string => posix.join(PEOPLE_ROOT, personId);

export const getPersonFilePath = (personId: string, fileName: PersonRequiredFile): string =>
  posix.join(getPersonDirectory(personId), fileName);

export const getPersonDirectoryPath = (
  personId: string,
  directoryName: PersonRequiredDirectory,
): string => posix.join(getPersonDirectory(personId), directoryName);

export const getRequiredPersonPaths = (personId: string): string[] => [
  ...PERSON_REQUIRED_FILES.map((fileName) => getPersonFilePath(personId, fileName)),
  ...PERSON_REQUIRED_DIRECTORIES.map((directoryName) =>
    getPersonDirectoryPath(personId, directoryName),
  ),
];

export const isPersonId = (value: string): boolean => PERSON_ID_PATTERN.test(value);

export const folderMatchesPersonId = (folderName: string, personId: string): boolean =>
  folderName === personId;

export const isLocalAssetReference = (value: string): boolean =>
  value.startsWith(LOCAL_ASSET_PATH_PREFIX) && !value.includes("..");

export const looksLikeLocalAssetPath = (value: string): boolean =>
  !/^[a-z][a-z0-9+.-]*:/iu.test(value) && value.includes("assets/");

export const normalizeLocalAssetToUri = (value: string): string =>
  new URL(value, LOCAL_ASSET_URI_BASE).toString();

export const getTemplatePath = (fileName: PersonRequiredFile): string =>
  resolveRepoPath(posix.join(TEMPLATE_ROOT, fileName));

export const getTemplateAssetPath = (assetName: string): string =>
  resolveRepoPath(posix.join(TEMPLATE_ROOT, "assets", assetName));

export const listTemplateFiles = (): string[] =>
  PERSON_REQUIRED_FILES.map((fileName) => posix.join(TEMPLATE_ROOT, fileName));

export const listTemplateAssets = (): string[] => [posix.join(TEMPLATE_ROOT, DEFAULT_AVATAR_ASSET)];

export const readTemplate = (fileName: PersonRequiredFile): string =>
  readFileSync(getTemplatePath(fileName), "utf8");

export const collectUnresolvedTemplateTokens = (templateContents: string): string[] => {
  const matches = templateContents.match(/__[A-Z0-9_]+__/g) ?? [];

  return [...new Set(matches)];
};

export const applyTemplateReplacements = (
  templateContents: string,
  replacements: TemplateReplacementMap,
): string => {
  let hydrated = templateContents;

  for (const [key, token] of Object.entries(TEMPLATE_VARIABLES) as [
    TemplateVariableName,
    string,
  ][]) {
    hydrated = hydrated.replaceAll(token, replacements[key]);
  }

  const unresolved = collectUnresolvedTemplateTokens(hydrated);
  if (unresolved.length > 0) {
    throw new Error(`Unresolved template tokens: ${unresolved.join(", ")}`);
  }

  return hydrated;
};

export const loadHydratedDefaultTemplates = (
  replacements: TemplateReplacementMap = DEFAULT_TEMPLATE_REPLACEMENTS,
): Record<TemplateFileKind, unknown> => ({
  person: JSON.parse(applyTemplateReplacements(readTemplate("person.json"), replacements)),
  profile: JSON.parse(applyTemplateReplacements(readTemplate("profile.json"), replacements)),
  links: JSON.parse(applyTemplateReplacements(readTemplate("links.json"), replacements)),
  site: JSON.parse(applyTemplateReplacements(readTemplate("site.json"), replacements)),
});
