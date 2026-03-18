import { afterEach, describe, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getPersonHelperLayout } from "./lib/import/cache-layout";
import type { UpstreamLinktreeBootstrapResult } from "./lib/import/linktree-intake";
import {
  MANAGE_PERSON_ACTIONS,
  buildManagePersonHelpText,
  parseManagePersonInvocation,
} from "./lib/manage-person/action-contract";
import {
  type ImportPersonDependencies,
  runImportPersonAction,
} from "./lib/manage-person/import-person";
import { findPersonMatches, loadPersonRegistry } from "./lib/manage-person/person-registry";
import { getTemplateAssetPath, loadHydratedDefaultTemplates } from "./lib/person-contract";
import { runManagePerson } from "./manage-person";
import { validateRepository } from "./validate";

const tempRoots: string[] = [];

const writeJson = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const createFixtureRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-manage-person-"));
  tempRoots.push(rootDir);

  const fixtures = [
    { personId: "alice-example", personName: "Alice Example" },
    { personId: "bob-sample", personName: "Bob Sample" },
  ];

  for (const fixture of fixtures) {
    const templates = loadHydratedDefaultTemplates({
      personId: fixture.personId,
      personName: fixture.personName,
      primaryLinkUrl: `https://example.com/${fixture.personId}`,
      profileHeadline: "TODO: add a short headline",
      profileBio: "TODO: add a one or two sentence bio for this person.",
      profileLocation: "TODO: add location",
      siteTitle: `${fixture.personName} | OpenLinks`,
      siteDescription: "TODO: add a concise site description for this person.",
    });
    const personDir = join(rootDir, "people", fixture.personId);
    mkdirSync(join(personDir, "assets"), { recursive: true });
    writeJson(join(personDir, "person.json"), templates.person);
    writeJson(join(personDir, "profile.json"), templates.profile);
    writeJson(join(personDir, "links.json"), templates.links);
    writeJson(join(personDir, "site.json"), templates.site);
    cpSync(
      getTemplateAssetPath("avatar-placeholder.svg"),
      join(personDir, "assets", "avatar-placeholder.svg"),
    );
  }

  return rootDir;
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

const createCapturedWriters = (): {
  stdout: string[];
  stderr: string[];
  stdoutWriter: { write(text: string): void };
  stderrWriter: { write(text: string): void };
} => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout,
    stderr,
    stdoutWriter: { write: (text) => stdout.push(text) },
    stderrWriter: { write: (text) => stderr.push(text) },
  };
};

const createImportActionHandler =
  (dependencies: ImportPersonDependencies) =>
  ({ args, rootDir }: { args: string[]; rootDir: string }) =>
    runImportPersonAction(args, rootDir, {
      nowIso: () => "2026-03-17T12:00:00.000Z",
      ...dependencies,
    });

const createUpstreamLinktreeBootstrapResult = (input: {
  sourceUrl: string;
  fetchedUrl?: string;
  name?: string;
  bio?: string;
  avatar?: string;
  links: Array<{ label: string; url: string; sourceOrder: number }>;
  socialLinks?: Array<{ label: string; url: string; sourceOrder: number }>;
  warnings?: string[];
}): UpstreamLinktreeBootstrapResult => ({
  kind: "linktree",
  sourceUrl: input.sourceUrl,
  fetchedUrl: input.fetchedUrl ?? input.sourceUrl,
  profile: {
    name: input.name,
    bio: input.bio,
    avatar: input.avatar,
    socialLinks: input.socialLinks ?? [],
  },
  links: input.links,
  snapshot: {
    kind: "linktree",
    sourceUrl: input.sourceUrl,
    fetchedUrl: input.fetchedUrl ?? input.sourceUrl,
    title: input.name,
    description: input.bio,
    avatar: input.avatar,
    linkCount: input.links.length,
    socialLinkCount: (input.socialLinks ?? []).length,
    links: input.links.map((link) => ({
      label: link.label,
      url: link.url,
    })),
    socialLinks: (input.socialLinks ?? []).map((link) => ({
      label: link.label,
      url: link.url,
    })),
    warnings: input.warnings ?? [],
  },
  warnings: input.warnings ?? [],
});

describe("manage-person surface", () => {
  test("surface: exposes the explicit CRUD action set", () => {
    expect(MANAGE_PERSON_ACTIONS).toEqual(["create", "import", "update", "disable", "archive"]);
    expect(buildManagePersonHelpText()).toContain("bun run manage:person -- <action> [options]");
    expect(buildManagePersonHelpText()).toContain("create");
    expect(buildManagePersonHelpText()).toContain("import");
    expect(buildManagePersonHelpText()).toContain("archive");
  });

  test("surface: parses action, root, and remaining args deterministically", () => {
    expect(
      parseManagePersonInvocation(
        ["--root", "/tmp/example", "update", "--person", "alice-example"],
        "/cwd",
      ),
    ).toEqual({
      action: "update",
      rootDir: "/tmp/example",
      remainingArgs: ["--person", "alice-example"],
      showHelp: false,
      invalidAction: undefined,
    });

    expect(parseManagePersonInvocation(["rename"], "/cwd")).toEqual({
      action: null,
      rootDir: "/cwd",
      remainingArgs: [],
      showHelp: false,
      invalidAction: "rename",
    });
  });

  test("surface: registry loads people and supports lookup by id or display name", async () => {
    const rootDir = createFixtureRoot();
    const registry = await loadPersonRegistry(rootDir);

    expect(registry.map((person) => person.id)).toEqual(["alice-example", "bob-sample"]);
    expect(
      findPersonMatches(registry, "alice-example").map((person) => person.displayName),
    ).toEqual(["Alice Example"]);
    expect(findPersonMatches(registry, "Bob Sample").map((person) => person.id)).toEqual([
      "bob-sample",
    ]);
    expect(findPersonMatches(registry, "alice").map((person) => person.id)).toEqual([
      "alice-example",
    ]);
  });

  test("surface: router prints help and rejects unknown actions cleanly", async () => {
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    const helpExitCode = await runManagePerson([], {
      stdout: stdoutWriter,
      stderr: stderrWriter,
    });

    expect(helpExitCode).toBe(0);
    expect(stdout.join("")).toContain("Manage people in open-links-sites");

    stdout.length = 0;
    stderr.length = 0;

    const invalidExitCode = await runManagePerson(["rename"], {
      stdout: stdoutWriter,
      stderr: stderrWriter,
    });

    expect(invalidExitCode).toBe(1);
    expect(stderr.join("")).toContain("Unknown action 'rename'.");
  });

  test("create: creates a person from only a name and auto-generates the id", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    const exitCode = await runManagePerson(["create", "--name", "Charlie Example"], {
      cwd: rootDir,
      stdout: stdoutWriter,
      stderr: stderrWriter,
    });

    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Created charlie-example (Charlie Example).");
    expect(stdout.join("")).toContain("Validation: 0 problems");

    const personPath = join(rootDir, "people", "charlie-example", "person.json");
    expect(existsSync(personPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(personPath, "utf8")) as {
      id: string;
      displayName: string;
      source: { seedUrls: string[] };
    };
    expect(manifest.id).toBe("charlie-example");
    expect(manifest.displayName).toBe("Charlie Example");
    expect(manifest.source.seedUrls).toEqual(["https://example.com/charlie-example"]);
  });

  test("create: writes an optional seed url into the scaffolded source metadata", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    const exitCode = await runManagePerson(
      ["create", "--name", "Dana Example", "--seed-url", "https://linktr.ee/dana-example"],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Seed URL: https://linktr.ee/dana-example");

    const manifest = JSON.parse(
      readFileSync(join(rootDir, "people", "dana-example", "person.json"), "utf8"),
    ) as { source: { seedUrls: string[] } };
    expect(manifest.source.seedUrls).toEqual(["https://linktr.ee/dana-example"]);
  });

  test("import-action: bootstraps a new person from only a source url through manage-person", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();
    const sourceUrl = "https://linktr.ee/charlie-example";

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

  test("import-action: classifies X community urls as simple links during bootstrap", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();
    const sourceUrl = "https://linktr.ee/community-example";

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
        type: "simple",
      },
      {
        id: "website",
        type: "rich",
      },
    ]);
  });

  test("import-merge: imports into an existing person conservatively and preserves curated order", async () => {
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

  test("update: applies task-based changes after matching a person by name", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    const exitCode = await runManagePerson(
      [
        "update",
        "--person",
        "Alice Example",
        "--headline",
        "Builder and operator",
        "--site-title",
        "Alice Example | Links",
        "--notes",
        "Needs import follow-up",
      ],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Updated alice-example (Alice Example).");
    expect(stdout.join("")).toContain("Applied tasks: headline, site title, operator notes");

    const profile = JSON.parse(
      readFileSync(join(rootDir, "people", "alice-example", "profile.json"), "utf8"),
    ) as { headline: string };
    const site = JSON.parse(
      readFileSync(join(rootDir, "people", "alice-example", "site.json"), "utf8"),
    ) as { title: string };
    const manifest = JSON.parse(
      readFileSync(join(rootDir, "people", "alice-example", "person.json"), "utf8"),
    ) as { notes: string };

    expect(profile.headline).toBe("Builder and operator");
    expect(site.title).toBe("Alice Example | Links");
    expect(manifest.notes).toBe("Needs import follow-up");
  });

  test("update: rolls back writes when validation introduces blocking problems", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();
    const personPath = join(rootDir, "people", "alice-example", "person.json");
    const before = readFileSync(personPath, "utf8");

    const exitCode = await runManagePerson(
      ["update", "--person", "alice-example", "--seed-url", "not-a-valid-url"],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toBe("");
    expect(stderr.join("")).toContain("Restored prior state");
    expect(readFileSync(personPath, "utf8")).toBe(before);
  });

  test("enrichment-bridge: passes the full-refresh flag into the upstream bridge and syncs helper caches", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();
    let receivedFullRefresh = false;

    const exitCode = await runManagePerson(
      [
        "import",
        "--person",
        "alice-example",
        "--manual-links",
        "Website https://alice.example.com",
        "--full-refresh",
      ],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
        actionHandlers: {
          import: createImportActionHandler({
            runUpstreamOpenLinks: async ({ workspace, fullRefresh }) => {
              receivedFullRefresh = fullRefresh;
              mkdirSync(workspace.dirs.profileAvatar, { recursive: true });
              writeJson(workspace.files.generatedRichMetadata, {
                generatedAt: "2026-03-17T12:00:00.000Z",
                links: {},
              });
              writeJson(workspace.files.richEnrichmentReport, {
                generatedAt: "2026-03-17T12:00:00.000Z",
                strict: false,
                summary: { total: 0, fetched: 0, partial: 0, failed: 0, skipped: 0 },
                entries: [],
              });
              writeJson(workspace.files.profileAvatarManifest, {
                sourceUrl: "https://cdn.example.com/alice.jpg",
                resolvedPath: "cache/profile-avatar/profile-avatar.jpg",
                updatedAt: "2026-03-17T12:00:00.000Z",
              });
              writeFileSync(join(workspace.dirs.profileAvatar, "profile-avatar.jpg"), "avatar");

              return {
                steps: [
                  { key: "enrich-rich-links", status: "ran", blocking: false },
                  { key: "sync-profile-avatar", status: "ran", blocking: false },
                  { key: "sync-content-images", status: "ran", blocking: false },
                  { key: "public-rich-sync", status: "ran", blocking: false },
                  { key: "validate-data", status: "ran", blocking: false },
                ],
              };
            },
          }),
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(receivedFullRefresh).toBe(true);

    const helperLayout = getPersonHelperLayout(rootDir, "alice-example");
    expect(existsSync(helperLayout.files.generatedRichMetadata)).toBe(true);
    expect(existsSync(helperLayout.files.richEnrichmentReport)).toBe(true);
    expect(existsSync(helperLayout.files.profileAvatarManifest)).toBe(true);
    expect(existsSync(join(helperLayout.dirs.profileAvatar, "profile-avatar.jpg"))).toBe(true);
  });

  test("import-report: keeps useful source data when upstream enrichment later fails", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    const exitCode = await runManagePerson(
      [
        "import",
        "--person",
        "alice-example",
        "--manual-links",
        "Website https://alice.example.com",
      ],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
        actionHandlers: {
          import: createImportActionHandler({
            runUpstreamOpenLinks: async () => ({
              steps: [
                {
                  key: "enrich-rich-links",
                  status: "failed",
                  blocking: true,
                  stderr: "metadata fetch failed",
                },
              ],
              blockingFailure: {
                key: "enrich-rich-links",
                status: "failed",
                blocking: true,
                stderr: "metadata fetch failed",
              },
            }),
          }),
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain("blocking upstream step failed");
    expect(stdout.join("")).toContain("Blocking upstream failures:");
    expect(stdout.join("")).toContain("enrich-rich-links: metadata fetch failed");

    const links = JSON.parse(
      readFileSync(join(rootDir, "people", "alice-example", "links.json"), "utf8"),
    ) as { links: Array<{ url: string }> };
    expect(links.links.some((entry) => entry.url === "https://alice.example.com/")).toBe(true);

    const helperLayout = getPersonHelperLayout(rootDir, "alice-example");
    const report = JSON.parse(readFileSync(helperLayout.files.lastImportReport, "utf8")) as {
      outcome: string;
      exitCode: number;
    };
    expect(report.outcome).toBe("partial");
    expect(report.exitCode).toBe(1);
  });

  test("import-summary: surfaces skipped upstream steps and remediation guidance", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    const exitCode = await runManagePerson(
      [
        "import",
        "--person",
        "alice-example",
        "--manual-links",
        "Website https://alice.example.com",
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
                {
                  key: "public-rich-sync",
                  status: "skipped",
                  blocking: false,
                  reason: "no eligible x, medium, or primal rich links were present",
                },
                { key: "validate-data", status: "ran", blocking: false },
              ],
            }),
          }),
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Skipped upstream steps:");
    expect(stdout.join("")).toContain(
      "sync-profile-avatar: profile.avatar is not a remote http/https URL",
    );
    expect(stdout.join("")).toContain(
      "Use --full-refresh to force a fresh upstream cache rebuild on the next rerun.",
    );
  });

  test("lifecycle-schema: scaffolding templates default to active lifecycle metadata", () => {
    const templates = loadHydratedDefaultTemplates({
      personId: "lifecycle-user",
      personName: "Lifecycle User",
      primaryLinkUrl: "https://example.com/lifecycle-user",
      profileHeadline: "TODO: add a short headline",
      profileBio: "TODO: add a one or two sentence bio for this person.",
      profileLocation: "TODO: add location",
      siteTitle: "Lifecycle User | OpenLinks",
      siteDescription: "TODO: add a concise site description for this person.",
    });

    expect(templates.person).toMatchObject({
      enabled: true,
      lifecycle: {
        status: "active",
      },
    });
  });

  test("lifecycle-schema: validation fails when lifecycle status and enabled diverge", async () => {
    const rootDir = createFixtureRoot();
    const personPath = join(rootDir, "people", "alice-example", "person.json");
    const manifest = JSON.parse(readFileSync(personPath, "utf8")) as Record<string, unknown>;
    manifest.enabled = true;
    manifest.lifecycle = {
      status: "archived",
      changedAt: "2026-03-17T12:00:00.000Z",
      archivedAt: "2026-03-17T12:00:00.000Z",
    };
    writeJson(personPath, manifest);

    const validation = await validateRepository(rootDir);

    expect(validation.valid).toBe(false);
    expect(
      validation.people[0]?.issues.some((issue) => issue.code === "lifecycle_enabled_mismatch"),
    ).toBe(true);
  });

  test("lifecycle-actions: disable requires one explicit confirmation before write", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();
    const personPath = join(rootDir, "people", "alice-example", "person.json");
    const before = readFileSync(personPath, "utf8");

    const exitCode = await runManagePerson(["disable", "--person", "alice-example"], {
      cwd: rootDir,
      stdout: stdoutWriter,
      stderr: stderrWriter,
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toBe("");
    expect(stderr.join("")).toContain("disable requires --confirm");
    expect(readFileSync(personPath, "utf8")).toBe(before);
  });

  test("lifecycle-actions: disable writes lifecycle metadata without deleting the person", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    const exitCode = await runManagePerson(
      ["disable", "--person", "Alice Example", "--confirm", "--reason", "Temporary pause"],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Disabled alice-example (Alice Example).");

    const manifest = JSON.parse(
      readFileSync(join(rootDir, "people", "alice-example", "person.json"), "utf8"),
    ) as {
      enabled: boolean;
      lifecycle: { status: string; disabledAt: string; changedAt: string; reason: string };
    };
    expect(manifest.enabled).toBe(false);
    expect(manifest.lifecycle.status).toBe("disabled");
    expect(typeof manifest.lifecycle.disabledAt).toBe("string");
    expect(typeof manifest.lifecycle.changedAt).toBe("string");
    expect(manifest.lifecycle.reason).toBe("Temporary pause");
    expect(existsSync(join(rootDir, "people", "alice-example", "profile.json"))).toBe(true);

    const registry = await loadPersonRegistry(rootDir);
    expect(registry.find((person) => person.id === "alice-example")?.lifecycleStatus).toBe(
      "disabled",
    );
  });

  test("lifecycle-actions: archive hides people by default but keeps them explicitly retrievable", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    const exitCode = await runManagePerson(
      ["archive", "--person", "alice-example", "--confirm", "--reason", "Offboarded"],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Archived alice-example (Alice Example).");

    const defaultRegistry = await loadPersonRegistry(rootDir);
    expect(defaultRegistry.some((person) => person.id === "alice-example")).toBe(false);

    const archiveAwareRegistry = await loadPersonRegistry(rootDir, {
      includeArchived: true,
    });
    const archivedPerson = archiveAwareRegistry.find((person) => person.id === "alice-example");
    expect(archivedPerson?.lifecycleStatus).toBe("archived");
    expect(archivedPerson?.hiddenByDefault).toBe(true);
  });
});
