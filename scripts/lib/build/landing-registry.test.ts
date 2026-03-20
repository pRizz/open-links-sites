import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { buildLandingRegistry } from "./landing-registry";

const tempRoots: string[] = [];

const createTempRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-landing-registry-"));
  tempRoots.push(rootDir);
  return rootDir;
};

const scaffoldFixture = (rootDir: string, personId: string, personName: string): void => {
  const scaffoldResult = Bun.spawnSync({
    cmd: [
      process.execPath,
      "run",
      "scripts/scaffold-person.ts",
      "--root",
      rootDir,
      "--id",
      personId,
      "--name",
      personName,
    ],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(scaffoldResult.exitCode).toBe(0);
};

const writeJson = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const seedExternalLandingFixtures = (
  rootDir: string,
  input?: { withOverrides?: boolean },
): void => {
  const mediaDir = join(rootDir, "config", "landing", "external-openlinks-media");
  mkdirSync(mediaDir, { recursive: true });
  writeFileSync(join(mediaDir, "openlinks-us-preview.jpg"), "preview");

  writeJson(join(rootDir, "config", "landing", "external-openlinks.json"), {
    entries: [
      {
        id: "openlinks-us",
        siteUrl: "https://openlinks.us/",
        enabled: true,
        ...(input?.withOverrides
          ? {
              displayName: "Peter on OpenLinks",
              destinationUrl: "https://openlinks.us/about",
              subtitle: "personal.openlinks.us",
              badgeLabel: "Featured",
              avatarUrl: "https://cdn.example.com/peter-avatar.jpg",
              headline: "Operator curated profile",
              summary: "Manual copy wins over extracted metadata.",
            }
          : {}),
      },
    ],
  });
  writeJson(join(rootDir, "config", "landing", "external-openlinks-cache.json"), {
    version: 1,
    entries: {
      "openlinks-us": {
        id: "openlinks-us",
        siteUrl: "https://openlinks.us/",
        fetchedAt: "2026-03-20T18:00:00.000Z",
        finalUrl: "https://openlinks.us/",
        destinationUrl: "https://openlinks.us/",
        displayName: "OpenLinks US",
        subtitle: "openlinks.us",
        summary: "Extracted OpenLinks profile.",
        avatarUrl: "https://cdn.example.com/extracted-avatar.jpg",
        previewImageSourceUrl: "https://cdn.example.com/openlinks-us-preview.jpg",
        mirroredPreviewImagePath:
          "config/landing/external-openlinks-media/openlinks-us-preview.jpg",
        verification: {
          status: "confirmed",
          reasons: ["page title includes OpenLinks"],
          manifestUrl: "https://openlinks.us/site.webmanifest",
        },
      },
    },
  });
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("landing-registry", () => {
  test("merges active local pages with enabled external entries and copies preview assets", async () => {
    const rootDir = createTempRoot();
    scaffoldFixture(rootDir, "alice-example", "Alice Example");
    scaffoldFixture(rootDir, "bob-disabled", "Bob Disabled");
    scaffoldFixture(rootDir, "carol-archived", "Carol Archived");
    scaffoldFixture(rootDir, "dana-example", "Dana Example");
    scaffoldFixture(rootDir, "eve-example", "Eve Example");
    seedExternalLandingFixtures(rootDir);

    writeJson(join(rootDir, "people", "bob-disabled", "person.json"), {
      $schema: "../../schemas/person.schema.json",
      id: "bob-disabled",
      displayName: "Bob Disabled",
      enabled: false,
      lifecycle: {
        status: "disabled",
      },
      source: {
        kind: "manual",
        seedUrls: ["https://example.com/bob-disabled"],
      },
      custom: {},
    });
    writeJson(join(rootDir, "people", "carol-archived", "person.json"), {
      $schema: "../../schemas/person.schema.json",
      id: "carol-archived",
      displayName: "Carol Archived",
      enabled: false,
      lifecycle: {
        status: "archived",
      },
      source: {
        kind: "manual",
        seedUrls: ["https://example.com/carol-archived"],
      },
      custom: {},
    });

    writeJson(join(rootDir, "people", "alice-example", "profile.json"), {
      $schema: "https://open-links.dev/schema/profile.schema.json",
      name: "Alice Example",
      headline: "Bitcoin educator and host",
      avatar: "https://cdn.example.com/alice.jpg",
      bio: "Alice curates interviews and explainers for new Bitcoin users.",
      location: "Chicago, IL",
      profileLinks: [],
      custom: {},
    });
    writeJson(join(rootDir, "people", "dana-example", "profile.json"), {
      $schema: "https://open-links.dev/schema/profile.schema.json",
      name: "Dana Example",
      headline: "TODO: add a short headline",
      avatar: "assets/dana.jpg",
      bio: "TODO: add a one or two sentence bio for this person.",
      location: "Austin, TX",
      profileLinks: [],
      custom: {},
    });
    writeJson(join(rootDir, "people", "dana-example", "site.json"), {
      $schema: "https://open-links.dev/schema/site.schema.json",
      title: "Dana Example | OpenLinks",
      description: "Dana publishes product notes and speaking links.",
      baseUrl: "/dana-example/",
      theme: {
        active: "sleek",
        available: ["sleek"],
      },
      custom: {},
    });
    mkdirSync(join(rootDir, "people", "dana-example", "assets"), { recursive: true });
    writeFileSync(join(rootDir, "people", "dana-example", "assets", "dana.jpg"), "avatar");

    const outputPath = join(rootDir, "generated", "site", "landing-registry.json");
    const result = await buildLandingRegistry({
      rootDir,
      outputDir: outputPath,
      publicOrigin: "https://example.com/network",
    });

    expect(result.payload.entries.map((entry) => entry.id)).toEqual([
      "alice-example",
      "dana-example",
      "eve-example",
      "openlinks-us",
    ]);
    expect(result.payload.entries[0]).toEqual({
      id: "alice-example",
      kind: "local",
      displayName: "Alice Example",
      href: "/network/alice-example/",
      subtitle: "/alice-example",
      avatarUrl: "https://cdn.example.com/alice.jpg",
      headline: "Bitcoin educator and host",
      summary: "Alice curates interviews and explainers for new Bitcoin users.",
    });
    expect(result.payload.entries[1]).toEqual({
      id: "dana-example",
      kind: "local",
      displayName: "Dana Example",
      href: "/network/dana-example/",
      subtitle: "/dana-example",
      avatarUrl: "/network/dana-example/assets/dana.jpg",
      summary: "Dana publishes product notes and speaking links.",
    });
    expect(result.payload.entries[2]).toEqual({
      id: "eve-example",
      kind: "local",
      displayName: "Eve Example",
      href: "/network/eve-example/",
      subtitle: "/eve-example",
    });
    expect(result.payload.entries[3]).toEqual({
      id: "openlinks-us",
      kind: "external",
      displayName: "OpenLinks US",
      href: "https://openlinks.us/",
      subtitle: "openlinks.us",
      badgeLabel: "External",
      openInNewTab: true,
      avatarUrl: "https://cdn.example.com/extracted-avatar.jpg",
      previewImageUrl: "/network/landing-assets/registry/openlinks-us-preview.jpg",
      summary: "Extracted OpenLinks profile.",
    });

    expect(
      existsSync(
        join(
          rootDir,
          "generated",
          "site",
          "landing-assets",
          "registry",
          "openlinks-us-preview.jpg",
        ),
      ),
    ).toBe(true);

    const writtenPayload = JSON.parse(readFileSync(outputPath, "utf8")) as {
      entries: Array<{ id: string }>;
    };
    expect(writtenPayload.entries.map((entry) => entry.id)).toEqual([
      "alice-example",
      "dana-example",
      "eve-example",
      "openlinks-us",
    ]);
  });

  test("manual config overrides win over extracted cache fields", async () => {
    const rootDir = createTempRoot();
    seedExternalLandingFixtures(rootDir, {
      withOverrides: true,
    });

    const result = await buildLandingRegistry({
      rootDir,
      publicOrigin: "https://example.com/network",
    });

    expect(result.payload.entries).toEqual([
      {
        id: "openlinks-us",
        kind: "external",
        displayName: "Peter on OpenLinks",
        href: "https://openlinks.us/about",
        subtitle: "personal.openlinks.us",
        badgeLabel: "Featured",
        openInNewTab: true,
        avatarUrl: "https://cdn.example.com/peter-avatar.jpg",
        previewImageUrl: "/network/landing-assets/registry/openlinks-us-preview.jpg",
        headline: "Operator curated profile",
        summary: "Manual copy wins over extracted metadata.",
      },
    ]);
  });
});
