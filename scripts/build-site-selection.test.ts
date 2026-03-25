import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildSite } from "./lib/build/build-site";
import { detectBuildSelection } from "./lib/build/change-detection";
import { executeBuildSelection } from "./lib/build/selective-build";
import { getGeneratedPersonSiteDir, getGeneratedSiteLayout } from "./lib/build/site-layout";
import {
  createBuildSiteTestHarness,
  disableFixture,
  scaffoldFixture,
} from "./test-support/build-site.fixtures";

const { createTempRoot, cleanup } = createBuildSiteTestHarness();

afterEach(() => {
  cleanup();
});

describe("build-site selection", () => {
  test("full-build: only active people are built while landing output stays at root", async () => {
    // Arrange
    const rootDir = createTempRoot();
    scaffoldFixture(rootDir, "alice-example", "Alice Example");
    scaffoldFixture(rootDir, "bob-sample", "Bob Sample");
    scaffoldFixture(rootDir, "carol-paused", "Carol Paused");
    disableFixture(rootDir, "carol-paused");

    // Act
    const result = await buildSite(
      {
        rootDir,
        buildTimestamp: "2026-03-17T12:00:00.000Z",
      },
      {
        buildPersonSite: async ({ personId, rootDir: targetRootDir }) => {
          const outputDir = getGeneratedPersonSiteDir(targetRootDir, personId);
          mkdirSync(outputDir, { recursive: true });
          writeFileSync(join(outputDir, "index.html"), `${personId}\n`, "utf8");

          return {
            personId,
            outputDir,
            sourceDir: join(targetRootDir, "people", personId),
            workspaceDir: join(targetRootDir, "generated", personId),
            basePath: `/${personId}/`,
          };
        },
        buildLandingPage: async ({ rootDir: targetRootDir }) => {
          const layout = getGeneratedSiteLayout(targetRootDir);
          mkdirSync(layout.siteDir, { recursive: true });
          writeFileSync(join(layout.siteDir, "index.html"), "landing\n", "utf8");
          mkdirSync(layout.landingAssetsDir, { recursive: true });
          writeFileSync(layout.landingRegistryPath, '{"entries":[]}\n', "utf8");

          return {
            siteDir: layout.siteDir,
          };
        },
      },
    );

    // Assert
    expect(result.mode).toBe("full");
    expect(result.builtPersonIds).toEqual(["alice-example", "bob-sample"]);
    expect(existsSync(join(getGeneratedSiteLayout(rootDir).siteDir, "index.html"))).toBe(true);
    expect(
      existsSync(join(getGeneratedPersonSiteDir(rootDir, "alice-example"), "index.html")),
    ).toBe(true);
    expect(existsSync(join(getGeneratedPersonSiteDir(rootDir, "bob-sample"), "index.html"))).toBe(
      true,
    );
    expect(existsSync(join(getGeneratedPersonSiteDir(rootDir, "carol-paused"), "index.html"))).toBe(
      false,
    );
  });

  test("selective-merge: targeted selection restores the base site and only rebuilds changed people", async () => {
    // Arrange
    const rootDir = createTempRoot();
    scaffoldFixture(rootDir, "alice-example", "Alice Example");
    scaffoldFixture(rootDir, "bob-sample", "Bob Sample");
    disableFixture(rootDir, "bob-sample");

    // Act
    const result = await executeBuildSelection(
      {
        rootDir,
        publicOrigin: "https://example.com/open-links-sites",
        selection: detectBuildSelection([
          "people/alice-example/profile.json",
          "people/bob-sample/person.json",
        ]),
        buildTimestamp: "2026-03-17T12:00:00.000Z",
      },
      {
        restoreLiveSite: async ({ rootDir: targetRootDir }) => {
          const layout = getGeneratedSiteLayout(targetRootDir);
          mkdirSync(join(layout.siteDir, "bob-sample"), { recursive: true });
          writeFileSync(join(layout.siteDir, "bob-sample", "index.html"), "old bob\n", "utf8");

          return {
            fileCount: 1,
            publicOrigin: "https://example.com/open-links-sites",
            siteDir: layout.siteDir,
          };
        },
        buildSite: async ({
          rootDir: targetRootDir,
          personIds,
          preserveExisting,
          removePersonIds,
          includeLandingPage,
        }) => {
          expect(preserveExisting).toBe(true);
          expect(includeLandingPage).toBe(true);

          for (const personId of personIds ?? []) {
            const outputDir = getGeneratedPersonSiteDir(targetRootDir, personId);
            mkdirSync(outputDir, { recursive: true });
            writeFileSync(join(outputDir, "index.html"), `${personId}\n`, "utf8");
          }

          if (includeLandingPage) {
            const layout = getGeneratedSiteLayout(targetRootDir);
            mkdirSync(layout.siteDir, { recursive: true });
            mkdirSync(layout.landingAssetsDir, { recursive: true });
            writeFileSync(join(layout.siteDir, "index.html"), "landing\n", "utf8");
            writeFileSync(layout.landingRegistryPath, '{"entries":[]}\n', "utf8");
          }

          for (const personId of removePersonIds ?? []) {
            rmSync(getGeneratedPersonSiteDir(targetRootDir, personId), {
              recursive: true,
              force: true,
            });
          }

          return {
            mode: "targeted",
            siteDir: getGeneratedSiteLayout(targetRootDir).siteDir,
            builtPersonIds: personIds ?? [],
            removedPersonIds: removePersonIds ?? [],
          };
        },
      },
    );

    // Assert
    expect(result.mode).toBe("targeted");
    expect(result.builtPersonIds).toEqual(["alice-example"]);
    expect(result.removedPersonIds).toEqual(["bob-sample"]);
    expect(
      existsSync(join(getGeneratedPersonSiteDir(rootDir, "alice-example"), "index.html")),
    ).toBe(true);
    expect(existsSync(join(getGeneratedSiteLayout(rootDir).siteDir, "index.html"))).toBe(true);
    expect(existsSync(getGeneratedSiteLayout(rootDir).landingRegistryPath)).toBe(true);
    expect(existsSync(join(getGeneratedPersonSiteDir(rootDir, "bob-sample"), "index.html"))).toBe(
      false,
    );
  });

  test("selective-merge: restore failure widens to a full rebuild", async () => {
    // Arrange
    const rootDir = createTempRoot();
    scaffoldFixture(rootDir, "alice-example", "Alice Example");

    // Act
    const result = await executeBuildSelection(
      {
        rootDir,
        publicOrigin: "https://example.com/open-links-sites",
        selection: detectBuildSelection(["people/alice-example/profile.json"]),
      },
      {
        restoreLiveSite: async () => {
          throw new Error("network unavailable");
        },
        buildSite: async ({ personIds }) => ({
          mode: personIds ? "targeted" : "full",
          siteDir: getGeneratedSiteLayout(rootDir).siteDir,
          builtPersonIds: personIds ?? ["alice-example"],
          removedPersonIds: [],
        }),
      },
    );

    // Assert
    expect(result.mode).toBe("full");
    expect(result.fallbackReason).toContain("network unavailable");
  });
});
