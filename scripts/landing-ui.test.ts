import { describe, expect, test } from "bun:test";
import {
  filterLandingRegistry,
  landingRegistryLinkLabel,
  landingRegistryLinkRel,
  landingRegistryLinkTarget,
} from "../src/landing/registry";
import type { LandingRegistryEntry } from "../src/landing/registry-contract";

describe("landing UI", () => {
  test("external cards render badge, subtitle, and new-tab attributes", () => {
    const externalEntry: LandingRegistryEntry = {
      id: "openlinks-us",
      kind: "external",
      displayName: "Peter on OpenLinks",
      href: "https://openlinks.us/",
      subtitle: "openlinks.us",
      badgeLabel: "External",
      openInNewTab: true,
      previewImageUrl: "/landing-assets/registry/openlinks-us-preview.jpg",
      summary: "Personal profile",
    };

    expect(externalEntry.badgeLabel).toBe("External");
    expect(externalEntry.subtitle).toBe("openlinks.us");
    expect(landingRegistryLinkLabel(externalEntry)).toBe("Visit site");
    expect(landingRegistryLinkTarget(externalEntry)).toBe("_blank");
    expect(landingRegistryLinkRel(externalEntry)).toBe("noopener noreferrer");
  });

  test("search matches subtitle and summary for mixed entries", () => {
    const entries: LandingRegistryEntry[] = [
      {
        id: "alice-example",
        kind: "local",
        displayName: "Alice Example",
        href: "/alice-example/",
        subtitle: "/alice-example",
        summary: "Bitcoin educator",
      },
      {
        id: "openlinks-us",
        kind: "external",
        displayName: "Peter on OpenLinks",
        href: "https://openlinks.us/",
        subtitle: "openlinks.us",
        badgeLabel: "External",
        openInNewTab: true,
        summary: "Personal profile",
      },
    ];

    expect(filterLandingRegistry(entries, "openlinks.us").map((entry) => entry.id)).toEqual([
      "openlinks-us",
    ]);
    expect(filterLandingRegistry(entries, "personal").map((entry) => entry.id)).toEqual([
      "openlinks-us",
    ]);
    expect(filterLandingRegistry(entries, "/alice-example").map((entry) => entry.id)).toEqual([
      "alice-example",
    ]);
  });
});
