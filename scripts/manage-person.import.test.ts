import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runManagePerson } from "./manage-person";
import {
  createCapturedWriters,
  createImportActionHandler,
  createManagePersonTestHarness,
  createUpstreamLinktreeBootstrapResult,
  writeJson,
} from "./test-support/manage-person.fixtures";

const { createFixtureRoot, cleanup } = createManagePersonTestHarness();

afterEach(() => {
  cleanup();
});

describe("manage-person import", () => {
  test("import-action: bootstraps a new person from only a source url through manage-person", async () => {
    // Arrange
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();
    const sourceUrl = "https://linktr.ee/charlie-example";

    // Act
    const exitCode = await runManagePerson(["import", "--source-url", sourceUrl], {
      cwd: rootDir,
      stdout: stdoutWriter,
      stderr: stderrWriter,
      actionHandlers: {
        import: createImportActionHandler({
          importIntake: {
            extractLinktreeBootstrap: async () =>
              createUpstreamLinktreeBootstrapResult({
                sourceUrl,
                name: "Charlie Example",
                bio: "Builder, operator, and writer.",
                avatar: "https://cdn.example.com/charlie.jpg?size=avatar-v3_0",
                links: [
                  {
                    label: "GitHub",
                    url: "https://github.com/charlie-example",
                    sourceOrder: 0,
                  },
                  {
                    label: "Website",
                    url: "https://charlie.example.com/",
                    sourceOrder: 1,
                  },
                ],
                socialLinks: [
                  {
                    label: "GitHub",
                    url: "https://github.com/charlie-example",
                    sourceOrder: 0,
                  },
                  {
                    label: "X",
                    url: "https://x.com/charlie_example",
                    sourceOrder: 1,
                  },
                ],
              }),
          },
          runUpstreamOpenLinks: async () => ({
            steps: [
              { key: "enrich-rich-links", status: "ran", blocking: false },
              { key: "sync-profile-avatar", status: "ran", blocking: false },
              { key: "sync-content-images", status: "ran", blocking: false },
              { key: "public-rich-sync", status: "ran", blocking: false },
              { key: "validate-data", status: "ran", blocking: false },
            ],
          }),
        }),
      },
    });

    // Assert
    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Import complete: charlie-example.");
    expect(stdout.join("")).toContain("Created: yes");

    const manifest = JSON.parse(
      readFileSync(join(rootDir, "people", "charlie-example", "person.json"), "utf8"),
    ) as {
      id: string;
      source: { kind: string; url: string; seedUrls: string[] };
    };
    const profile = JSON.parse(
      readFileSync(join(rootDir, "people", "charlie-example", "profile.json"), "utf8"),
    ) as {
      name: string;
      bio: string;
      avatar: string;
      profileLinks: Array<{ label: string; url: string }>;
    };
    const links = JSON.parse(
      readFileSync(join(rootDir, "people", "charlie-example", "links.json"), "utf8"),
    ) as { links: Array<{ label: string; url: string }>; order: string[] };

    expect(manifest.id).toBe("charlie-example");
    expect(manifest.source.kind).toBe("linktree");
    expect(manifest.source.url).toBe(sourceUrl);
    expect(manifest.source.seedUrls).toContain(sourceUrl);
    expect(profile.name).toBe("Charlie Example");
    expect(profile.bio).toBe("Builder, operator, and writer.");
    expect(profile.avatar).toBe("https://cdn.example.com/charlie.jpg?size=avatar-v3_0");
    expect(profile.profileLinks).toEqual([
      {
        label: "GitHub",
        url: "https://github.com/charlie-example",
      },
      {
        label: "X",
        url: "https://x.com/charlie_example",
      },
    ]);
    expect(links.links.map((entry) => entry.label)).toEqual(["GitHub", "Website"]);
    expect(links.links.map((entry) => entry.url)).toEqual([
      "https://github.com/charlie-example",
      "https://charlie.example.com/",
    ]);
    expect(links.order).toEqual(["github", "website"]);
  });

  test("import-action: classifies X community urls as rich links during bootstrap", async () => {
    // Arrange
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();
    const sourceUrl = "https://linktr.ee/community-example";

    // Act
    const exitCode = await runManagePerson(["import", "--source-url", sourceUrl], {
      cwd: rootDir,
      stdout: stdoutWriter,
      stderr: stderrWriter,
      actionHandlers: {
        import: createImportActionHandler({
          importIntake: {
            extractLinktreeBootstrap: async () =>
              createUpstreamLinktreeBootstrapResult({
                sourceUrl,
                name: "Community Example",
                links: [
                  {
                    label: "Community",
                    url: "https://x.com/i/communities/1871996451812769951",
                    sourceOrder: 0,
                  },
                  {
                    label: "Website",
                    url: "https://community.example.com",
                    sourceOrder: 1,
                  },
                ],
              }),
          },
          runUpstreamOpenLinks: async () => ({
            steps: [
              { key: "enrich-rich-links", status: "ran", blocking: false },
              { key: "sync-profile-avatar", status: "ran", blocking: false },
              { key: "sync-content-images", status: "ran", blocking: false },
              { key: "public-rich-sync", status: "ran", blocking: false },
              { key: "validate-data", status: "ran", blocking: false },
            ],
          }),
        }),
      },
    });

    // Assert
    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Import complete: community-example.");

    const links = JSON.parse(
      readFileSync(join(rootDir, "people", "community-example", "links.json"), "utf8"),
    ) as {
      links: Array<{ id: string; type: string }>;
    };

    expect(
      links.links.map((entry) => ({
        id: entry.id,
        type: entry.type,
      })),
    ).toEqual([
      {
        id: "community",
        type: "rich",
      },
      {
        id: "website",
        type: "rich",
      },
    ]);
  });

  test("import-merge: imports into an existing person conservatively and preserves curated order", async () => {
    // Arrange
    const rootDir = createFixtureRoot();
    const personDir = join(rootDir, "people", "alice-example");
    writeJson(join(personDir, "links.json"), {
      $schema: "https://open-links.dev/schema/links.schema.json",
      links: [
        {
          id: "github",
          label: "GitHub",
          url: "https://github.com/alice-example",
          type: "rich",
          enabled: true,
        },
      ],
      groups: [],
      order: ["github"],
      custom: {},
    });
    writeJson(join(personDir, "profile.json"), {
      $schema: "https://open-links.dev/schema/profile.schema.json",
      name: "Alice Example",
      headline: "Curated headline",
      avatar: "assets/avatar-placeholder.svg",
      bio: "Curated bio",
      location: "Chicago",
      profileLinks: [{ label: "GitHub", url: "https://github.com/alice-example" }],
      custom: {},
    });
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    // Act
    const exitCode = await runManagePerson(
      [
        "import",
        "--person",
        "alice-example",
        "--manual-links",
        [
          "GitHub https://github.com/alice-example/",
          "LinkedIn https://www.linkedin.com/in/alice-example",
          "Website https://alice.example.com",
        ].join("\n"),
      ],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
        actionHandlers: {
          import: createImportActionHandler({
            runUpstreamOpenLinks: async () => ({
              steps: [
                { key: "enrich-rich-links", status: "ran", blocking: false },
                {
                  key: "sync-profile-avatar",
                  status: "skipped",
                  blocking: false,
                  reason: "profile.avatar is not a remote http/https URL",
                },
                { key: "sync-content-images", status: "ran", blocking: false },
                { key: "public-rich-sync", status: "ran", blocking: false },
                { key: "validate-data", status: "ran", blocking: false },
              ],
            }),
          }),
        },
      },
    );

    // Assert
    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Skipped duplicates:");
    expect(stdout.join("")).toContain("https://github.com/alice-example/");

    const profile = JSON.parse(readFileSync(join(personDir, "profile.json"), "utf8")) as {
      headline: string;
      bio: string;
      profileLinks: Array<{ url: string }>;
    };
    const links = JSON.parse(readFileSync(join(personDir, "links.json"), "utf8")) as {
      links: Array<{ id: string; url: string }>;
      order: string[];
    };
    const manifest = JSON.parse(readFileSync(join(personDir, "person.json"), "utf8")) as {
      source: { kind: string };
    };

    expect(profile.headline).toBe("Curated headline");
    expect(profile.bio).toBe("Curated bio");
    expect(profile.profileLinks.map((entry) => entry.url)).toEqual([
      "https://github.com/alice-example",
      "https://www.linkedin.com/in/alice-example",
    ]);
    expect(links.links.map((entry) => entry.url)).toEqual([
      "https://github.com/alice-example",
      "https://www.linkedin.com/in/alice-example",
      "https://alice.example.com/",
    ]);
    expect(links.order).toEqual(["github", "linkedin", "website"]);
    expect(manifest.source.kind).toBe("links-list");
  });
});
