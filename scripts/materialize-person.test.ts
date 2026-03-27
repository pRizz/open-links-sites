import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { getGeneratedWorkspaceLayout, getPersonHelperLayout } from "./lib/import/cache-layout";
import { materializePerson } from "./lib/materialize-person";

const tempRoots: string[] = [];
const originalOpenLinksRepoDir = process.env.OPEN_LINKS_REPO_DIR;

const createTempRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-materialize-"));
  tempRoots.push(rootDir);
  return rootDir;
};

const createUpstreamFixtureRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-upstream-fixture-"));
  tempRoots.push(rootDir);

  mkdirSync(join(rootDir, "scripts"), { recursive: true });
  mkdirSync(join(rootDir, "schema"), { recursive: true });
  mkdirSync(join(rootDir, "data", "cache"), { recursive: true });
  mkdirSync(join(rootDir, "data", "policy"), { recursive: true });
  mkdirSync(join(rootDir, "public", "history", "followers"), { recursive: true });

  writeFileSync(join(rootDir, "package.json"), '{\n  "name": "open-links"\n}\n', "utf8");
  writeFileSync(
    join(rootDir, "schema", "remote-cache-policy.schema.json"),
    '{\n  "$id": "remote-cache-policy"\n}\n',
    "utf8",
  );
  writeFileSync(
    join(rootDir, "data", "policy", "remote-cache-policy.json"),
    '{\n  "version": 1\n}\n',
    "utf8",
  );
  writeFileSync(
    join(rootDir, "data", "cache", "rich-authenticated-cache.json"),
    '{\n  "version": 1,\n  "entries": {}\n}\n',
    "utf8",
  );
  writeFileSync(
    join(rootDir, "public", "history", "followers", "index.json"),
    '{\n  "entries": []\n}\n',
    "utf8",
  );
  writeFileSync(
    join(rootDir, "public", "history", "followers", "github.csv"),
    "capturedAt,count\n",
    "utf8",
  );

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
  mkdirSync(helperLayout.dirs.followerHistory, { recursive: true });

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
  writeJson(helperLayout.files.followerHistoryIndex, {
    version: 1,
    updatedAt: "2026-03-17T12:00:00.000Z",
    entries: [
      {
        linkId: "primary-link",
        label: "Primary Link",
        platform: "github",
        handle: "fixture-user",
        canonicalUrl: "https://example.com/fixture-user",
        audienceKind: "followers",
        csvPath: "history/followers/github.csv",
        latestAudienceCount: 42,
        latestAudienceCountRaw: "42 followers",
        latestObservedAt: "2026-03-17T12:00:00.000Z",
      },
    ],
  });
  writeFileSync(join(helperLayout.dirs.profileAvatar, "profile-avatar.jpg"), "avatar");
  writeFileSync(join(helperLayout.dirs.contentImages, "example.jpg"), "image");
  writeFileSync(
    join(helperLayout.dirs.followerHistory, "github.csv"),
    [
      "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
      "2026-03-17T12:00:00.000Z,primary-link,github,fixture-user,https://example.com/fixture-user,followers,42,42 followers,manual",
      "",
    ].join("\n"),
    "utf8",
  );
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }

  if (originalOpenLinksRepoDir === undefined) {
    process.env.OPEN_LINKS_REPO_DIR = undefined;
  } else {
    process.env.OPEN_LINKS_REPO_DIR = originalOpenLinksRepoDir;
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
    expect(readFileSync(generatedLayout.files.followerHistoryIndex, "utf8")).toBe(
      readFileSync(helperLayout.files.followerHistoryIndex, "utf8"),
    );
    expect(readFileSync(join(generatedLayout.dirs.followerHistory, "github.csv"), "utf8")).toBe(
      readFileSync(join(helperLayout.dirs.followerHistory, "github.csv"), "utf8"),
    );
  });

  test("workspace-support: copies upstream schema and policy files and initializes an empty history root", async () => {
    const rootDir = createTempRoot();
    const upstreamRoot = createUpstreamFixtureRoot();
    process.env.OPEN_LINKS_REPO_DIR = upstreamRoot;
    scaffoldFixture(rootDir);

    const workspace = await materializePerson({
      personId: "fixture-user",
      rootDir,
    });

    const remoteCacheSchemaPath = join(
      workspace.outputDir,
      "schema",
      "remote-cache-policy.schema.json",
    );
    const remoteCachePolicyPath = join(
      workspace.outputDir,
      "data",
      "policy",
      "remote-cache-policy.json",
    );
    const authenticatedCachePath = join(
      workspace.outputDir,
      "data",
      "cache",
      "rich-authenticated-cache.json",
    );
    const followerHistoryIndexPath = join(
      workspace.outputDir,
      "public",
      "history",
      "followers",
      "index.json",
    );
    const followerHistoryCsvPath = join(
      workspace.outputDir,
      "public",
      "history",
      "followers",
      "github.csv",
    );

    expect(existsSync(remoteCacheSchemaPath)).toBe(true);
    expect(existsSync(remoteCachePolicyPath)).toBe(true);
    expect(existsSync(authenticatedCachePath)).toBe(true);
    expect(existsSync(followerHistoryIndexPath)).toBe(true);
    expect(existsSync(followerHistoryCsvPath)).toBe(false);
    expect(readFileSync(remoteCacheSchemaPath, "utf8")).toBe(
      readFileSync(join(upstreamRoot, "schema", "remote-cache-policy.schema.json"), "utf8"),
    );
    expect(readFileSync(remoteCachePolicyPath, "utf8")).toBe(
      readFileSync(join(upstreamRoot, "data", "policy", "remote-cache-policy.json"), "utf8"),
    );
    expect(readFileSync(authenticatedCachePath, "utf8")).toBe(
      readFileSync(join(upstreamRoot, "data", "cache", "rich-authenticated-cache.json"), "utf8"),
    );
    expect(JSON.parse(readFileSync(followerHistoryIndexPath, "utf8"))).toEqual({
      version: 1,
      updatedAt: "1970-01-01T00:00:00.000Z",
      entries: [],
    });
  });
});
