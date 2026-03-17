import { describe, expect, test } from "bun:test";

import {
  DEFAULT_TEMPLATE_REPLACEMENTS,
  PERSON_DISCOVERY_PATTERN,
  PERSON_REQUIRED_DIRECTORIES,
  PERSON_REQUIRED_FILES,
  TEMPLATE_FILE_MAP,
  applyTemplateReplacements,
  collectUnresolvedTemplateTokens,
  folderMatchesPersonId,
  getPersonDirectory,
  getRequiredPersonPaths,
  isLocalAssetReference,
  isPersonId,
  loadHydratedDefaultTemplates,
  readTemplate,
} from "./person-contract";

describe("person contract", () => {
  test("defines the canonical file and directory contract", () => {
    expect(PERSON_REQUIRED_FILES).toEqual([
      "person.json",
      "profile.json",
      "links.json",
      "site.json",
    ]);
    expect(PERSON_REQUIRED_DIRECTORIES).toEqual(["assets"]);
    expect(PERSON_DISCOVERY_PATTERN).toBe("people/*/person.json");
  });

  test("enforces stable person ids and folder alignment", () => {
    expect(isPersonId("alice-smith")).toBe(true);
    expect(isPersonId("Alice Smith")).toBe(false);
    expect(getPersonDirectory("alice-smith")).toBe("people/alice-smith");
    expect(getRequiredPersonPaths("alice-smith")).toEqual([
      "people/alice-smith/person.json",
      "people/alice-smith/profile.json",
      "people/alice-smith/links.json",
      "people/alice-smith/site.json",
      "people/alice-smith/assets",
    ]);
    expect(folderMatchesPersonId("alice-smith", "alice-smith")).toBe(true);
    expect(folderMatchesPersonId("alice", "alice-smith")).toBe(false);
  });

  test("hydrates default templates into a complete starter person source shape", () => {
    const templates = loadHydratedDefaultTemplates();

    expect(Object.keys(templates).sort()).toEqual(Object.keys(TEMPLATE_FILE_MAP).sort());

    expect(templates.person).toMatchObject({
      id: DEFAULT_TEMPLATE_REPLACEMENTS.personId,
      displayName: DEFAULT_TEMPLATE_REPLACEMENTS.personName,
      enabled: true,
    });
    expect(templates.profile).toMatchObject({
      name: DEFAULT_TEMPLATE_REPLACEMENTS.personName,
      headline: DEFAULT_TEMPLATE_REPLACEMENTS.profileHeadline,
      avatar: "assets/avatar-placeholder.svg",
    });
    expect(templates.links).toMatchObject({
      order: ["primary-link"],
    });
    expect(templates.site).toMatchObject({
      baseUrl: `/${DEFAULT_TEMPLATE_REPLACEMENTS.personId}/`,
      theme: {
        active: "sleek",
      },
    });
    expect(isLocalAssetReference((templates.profile as { avatar: string }).avatar)).toBe(true);
  });

  test("requires every template token to be replaced before use", () => {
    const rawPersonTemplate = readTemplate("person.json");
    expect(collectUnresolvedTemplateTokens(rawPersonTemplate)).toContain("__PERSON_ID__");

    const hydratedPersonTemplate = applyTemplateReplacements(
      rawPersonTemplate,
      DEFAULT_TEMPLATE_REPLACEMENTS,
    );
    expect(collectUnresolvedTemplateTokens(hydratedPersonTemplate)).toHaveLength(0);
  });
});
