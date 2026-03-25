import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getPersonHelperLayout } from "./lib/import/cache-layout";
import { runManagePerson } from "./manage-person";
import {
  createCapturedWriters,
  createImportActionHandler,
  createManagePersonTestHarness,
  writeJson,
} from "./test-support/manage-person.fixtures";

const { createFixtureRoot, cleanup } = createManagePersonTestHarness();

afterEach(() => {
  cleanup();
});

describe("manage-person update and enrichment", () => {
  test("update: applies task-based changes after matching a person by name", async () => {
    // Arrange
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    // Act
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

    // Assert
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
    // Arrange
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();
    const personPath = join(rootDir, "people", "alice-example", "person.json");
    const before = readFileSync(personPath, "utf8");

    // Act
    const exitCode = await runManagePerson(
      ["update", "--person", "alice-example", "--seed-url", "not-a-valid-url"],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
      },
    );

    // Assert
    expect(exitCode).toBe(1);
    expect(stdout.join("")).toBe("");
    expect(stderr.join("")).toContain("Restored prior state");
    expect(readFileSync(personPath, "utf8")).toBe(before);
  });

  test("enrichment-bridge: passes the full-refresh flag into the upstream bridge and syncs helper caches", async () => {
    // Arrange
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();
    let receivedFullRefresh = false;

    // Act
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

    // Assert
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
    // Arrange
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    // Act
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

    // Assert
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
    // Arrange
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    // Act
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

    // Assert
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
});
