import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { buildLandingPage } from "./lib/build/build-landing-page";
import { buildPersonSite } from "./lib/build/build-person-site";
import { buildSite } from "./lib/build/build-site";
import { detectBuildSelection } from "./lib/build/change-detection";
import { executeBuildSelection } from "./lib/build/selective-build";
import { getGeneratedPersonSiteDir, getGeneratedSiteLayout } from "./lib/build/site-layout";

const tempRoots: string[] = [];

const createTempRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-build-"));
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

const disableFixture = (rootDir: string, personId: string): void => {
  const personPath = join(rootDir, "people", personId, "person.json");
  const manifest = JSON.parse(readFileSync(personPath, "utf8")) as Record<string, unknown>;
  manifest.enabled = false;
  manifest.lifecycle = {
    status: "disabled",
    changedAt: "2026-03-17T12:00:00.000Z",
    disabledAt: "2026-03-17T12:00:00.000Z",
  };
  writeFileSync(personPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("build-site", () => {
  test("landing-page: builds the root landing experience into generated/site", async () => {
    const rootDir = createTempRoot();

    const result = await buildLandingPage({ rootDir });
    const layout = getGeneratedSiteLayout(rootDir);

    expect(result.siteDir).toBe(layout.siteDir);
    expect(existsSync(join(layout.siteDir, "index.html"))).toBe(true);
    expect(existsSync(layout.landingAssetsDir)).toBe(true);

    const html = readFileSync(join(layout.siteDir, "index.html"), "utf8");
    expect(html).toContain("OpenLinks Sites");
  });

  test("person-build: builds one active person through the upstream workspace wrapper", async () => {
    const rootDir = createTempRoot();
    scaffoldFixture(rootDir, "fixture-user", "Fixture User");

    const result = await buildPersonSite({
      rootDir,
      personId: "fixture-user",
      buildTimestamp: "2026-03-17T12:00:00.000Z",
    });

    expect(result.personId).toBe("fixture-user");
    expect(existsSync(join(result.outputDir, "index.html"))).toBe(true);
    expect(existsSync(join(result.outputDir, "assets"))).toBe(true);
  });

  test("full-build: only active people are built while landing output stays at root", async () => {
    const rootDir = createTempRoot();
    scaffoldFixture(rootDir, "alice-example", "Alice Example");
    scaffoldFixture(rootDir, "bob-sample", "Bob Sample");
    scaffoldFixture(rootDir, "carol-paused", "Carol Paused");
    disableFixture(rootDir, "carol-paused");

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

          return {
            siteDir: layout.siteDir,
          };
        },
      },
    );

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
    const rootDir = createTempRoot();
    scaffoldFixture(rootDir, "alice-example", "Alice Example");
    scaffoldFixture(rootDir, "bob-sample", "Bob Sample");
    disableFixture(rootDir, "bob-sample");

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
          expect(includeLandingPage).toBe(false);

          for (const personId of personIds ?? []) {
            const outputDir = getGeneratedPersonSiteDir(targetRootDir, personId);
            mkdirSync(outputDir, { recursive: true });
            writeFileSync(join(outputDir, "index.html"), `${personId}\n`, "utf8");
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

    expect(result.mode).toBe("targeted");
    expect(result.builtPersonIds).toEqual(["alice-example"]);
    expect(result.removedPersonIds).toEqual(["bob-sample"]);
    expect(
      existsSync(join(getGeneratedPersonSiteDir(rootDir, "alice-example"), "index.html")),
    ).toBe(true);
    expect(existsSync(join(getGeneratedPersonSiteDir(rootDir, "bob-sample"), "index.html"))).toBe(
      false,
    );
  });

  test("selective-merge: restore failure widens to a full rebuild", async () => {
    const rootDir = createTempRoot();
    scaffoldFixture(rootDir, "alice-example", "Alice Example");

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

    expect(result.mode).toBe("full");
    expect(result.fallbackReason).toContain("network unavailable");
  });
});
