import { readFileSync } from "node:fs";

import {
  DEFAULT_TEMPLATE_REPLACEMENTS,
  TEMPLATE_FILE_MAP,
  type PersonRequiredFile,
  type TemplateReplacementMap,
  applyTemplateReplacements,
  getTemplateAssetPath,
  readTemplate,
} from "./person-contract";

export interface ScaffoldInput {
  personId: string;
  personName: string;
  primaryLinkUrl?: string;
  profileHeadline?: string;
  profileBio?: string;
  profileLocation?: string;
  siteTitle?: string;
  siteDescription?: string;
}

const resolveReplacements = (input: ScaffoldInput): TemplateReplacementMap => ({
  ...DEFAULT_TEMPLATE_REPLACEMENTS,
  personId: input.personId,
  personName: input.personName,
  primaryLinkUrl:
    input.primaryLinkUrl ?? `https://example.com/${input.personId}`,
  profileHeadline: input.profileHeadline ?? DEFAULT_TEMPLATE_REPLACEMENTS.profileHeadline,
  profileBio: input.profileBio ?? DEFAULT_TEMPLATE_REPLACEMENTS.profileBio,
  profileLocation: input.profileLocation ?? DEFAULT_TEMPLATE_REPLACEMENTS.profileLocation,
  siteTitle: input.siteTitle ?? `${input.personName} | OpenLinks`,
  siteDescription: input.siteDescription ?? DEFAULT_TEMPLATE_REPLACEMENTS.siteDescription,
});

export const renderDefaultTemplates = (
  input: ScaffoldInput,
): Record<PersonRequiredFile, string> => {
  const replacements = resolveReplacements(input);

  return {
    "person.json": applyTemplateReplacements(readTemplate("person.json"), replacements),
    "profile.json": applyTemplateReplacements(readTemplate("profile.json"), replacements),
    "links.json": applyTemplateReplacements(readTemplate("links.json"), replacements),
    "site.json": applyTemplateReplacements(readTemplate("site.json"), replacements),
  };
};

export const loadDefaultAssetPayloads = (): Record<string, Buffer<ArrayBuffer>> => ({
  "avatar-placeholder.svg": readFileSync(getTemplateAssetPath("avatar-placeholder.svg")),
});

export const listRenderableTemplateFiles = (): string[] => Object.values(TEMPLATE_FILE_MAP);
