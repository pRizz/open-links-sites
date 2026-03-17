import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { getGeneratedWorkspaceLayout, getPersonHelperLayout } from "./lib/import/cache-layout";
import { materializePerson } from "./lib/materialize-person";

const tempRoots: string[] = [];

const createTempRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-materialize-"));
  tempRoots.push(rootDir);
  return rootDir;
};

const scaffoldFixture = (rootDir: string): void => {
  const scaffoldResult = Bun.spawnSync({
    cmd: [
      process.execPath,
      "run",
      "scripts/scaffold-person.ts",
      "--root",
      rootDir,
      "--id",
      "fixture-user",
      "--name",
      "Fixture User",
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

const writeImportCacheFixtures = (rootDir: string, personId: string): void => {
  const helperLayout = getPersonHelperLayout(rootDir, personId);
  mkdirSync(helperLayout.dirs.profileAvatar, { recursive: true });
  mkdirSync(helperLayout.dirs.contentImages, { recursive: true });

  writeJson(helperLayout.files.profileAvatarManifest, {
    sourceUrl: "https://cdn.example.com/avatar.jpg",
    resolvedPath: "cache/profile-avatar/profile-avatar.jpg",
    updatedAt: "2026-03-17T12:00:00.000Z",
  });
  writeJson(helperLayout.files.contentImagesManifest, {
    generatedAt: "2026-03-17T12:00:00.000Z",
    bySlot: {
      "primary-link:image": {
        resolvedPath: "cache/content-images/example.jpg",
        updatedAt: "2026-03-17T12:00:00.000Z",
      },
    },
  });
  writeFileSync(join(helperLayout.dirs.profileAvatar, "profile-avatar.jpg"), "avatar");
  writeFileSync(join(helperLayout.dirs.contentImages, "example.jpg"), "image");
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("materialize-person", () => {
  test("creates a generated single-person workspace without mutating source files", async () => {
    const rootDir = createTempRoot();
    scaffoldFixture(rootDir);

    const sourceProfileBefore = readFileSync(
      join(rootDir, "people", "fixture-user", "profile.json"),
      "utf8",
    );

    const workspace = await materializePerson({
      personId: "fixture-user",
      rootDir,
    });

    expect(workspace.outputDir.startsWith(join(rootDir, "generated"))).toBe(true);

    const materializedProfile = JSON.parse(
      readFileSync(join(workspace.dataDir, "profile.json"), "utf8"),
    ) as { avatar: string };
    expect(materializedProfile.avatar.startsWith("file://")).toBe(true);

    const sourceProfileAfter = readFileSync(
      join(rootDir, "people", "fixture-user", "profile.json"),
      "utf8",
    );
    expect(sourceProfileAfter).toBe(sourceProfileBefore);
  });

  test("import-cache-layout: copies helper cache artifacts into the generated workspace contract", async () => {
    const rootDir = createTempRoot();
    scaffoldFixture(rootDir);
    writeImportCacheFixtures(rootDir, "fixture-user");

    const workspace = await materializePerson({
      personId: "fixture-user",
      rootDir,
    });

    const helperLayout = getPersonHelperLayout(rootDir, "fixture-user");
    const generatedLayout = getGeneratedWorkspaceLayout(rootDir, "fixture-user");

    expect(workspace.layout.outputDir).toBe(generatedLayout.outputDir);
    expect(readFileSync(generatedLayout.files.profileAvatarManifest, "utf8")).toBe(
      readFileSync(helperLayout.files.profileAvatarManifest, "utf8"),
    );
    expect(readFileSync(generatedLayout.files.contentImagesManifest, "utf8")).toBe(
      readFileSync(helperLayout.files.contentImagesManifest, "utf8"),
    );
  });
});
