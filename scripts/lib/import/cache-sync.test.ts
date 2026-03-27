import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getGeneratedWorkspaceLayout, getPersonHelperLayout } from "./cache-layout";
import { syncWorkspaceCacheToPerson } from "./cache-sync";

const tempRoots: string[] = [];

const createTempRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-cache-sync-"));
  tempRoots.push(rootDir);
  return rootDir;
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("syncWorkspaceCacheToPerson", () => {
  test("formats synced cache json files with repo biome rules", () => {
    // Arrange
    const rootDir = createTempRoot();
    const workspaceLayout = getGeneratedWorkspaceLayout(rootDir, "alice-example");
    const helperLayout = getPersonHelperLayout(rootDir, "alice-example");
    mkdirSync(workspaceLayout.dataGeneratedDir, { recursive: true });

    writeFileSync(
      workspaceLayout.files.richEnrichmentReport,
      [
        "{",
        '  "generatedAt": "2026-03-25T08:16:30.372Z",',
        '  "entries": [',
        "    {",
        '      "missingProfileFields": [',
        '        "subscribersCount"',
        "      ]",
        "    }",
        "  ]",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    // Act
    const result = syncWorkspaceCacheToPerson({
      rootDir,
      personId: "alice-example",
    });

    // Assert
    expect(result.copiedPaths).toContain(helperLayout.files.richEnrichmentReport);
    const syncedReport = readFileSync(helperLayout.files.richEnrichmentReport, "utf8");
    expect(syncedReport).toContain('"missingProfileFields": ["subscribersCount"]');
    expect(syncedReport).not.toContain(
      '"missingProfileFields": [\n        "subscribersCount"\n      ]',
    );
  });

  test("copies follower-history artifacts back into the per-person helper cache", () => {
    // Arrange
    const rootDir = createTempRoot();
    const workspaceLayout = getGeneratedWorkspaceLayout(rootDir, "alice-example");
    const helperLayout = getPersonHelperLayout(rootDir, "alice-example");
    mkdirSync(workspaceLayout.dirs.followerHistory, { recursive: true });

    writeFileSync(
      workspaceLayout.files.followerHistoryIndex,
      [
        "{",
        '  "version": 1,',
        '  "updatedAt": "2026-03-25T08:16:30.372Z",',
        '  "entries": [',
        "    {",
        '      "linkId": "github",',
        '      "label": "GitHub",',
        '      "platform": "github",',
        '      "handle": "alice-example",',
        '      "canonicalUrl": "https://github.com/alice-example",',
        '      "audienceKind": "followers",',
        '      "csvPath": "history/followers/github.csv",',
        '      "latestAudienceCount": 12,',
        '      "latestAudienceCountRaw": "12 followers",',
        '      "latestObservedAt": "2026-03-25T08:16:30.372Z"',
        "    }",
        "  ]",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(workspaceLayout.dirs.followerHistory, "github.csv"),
      [
        "observedAt,linkId,platform,handle,canonicalUrl,audienceKind,audienceCount,audienceCountRaw,source",
        "2026-03-25T08:16:30.372Z,github,github,alice-example,https://github.com/alice-example,followers,12,12 followers,manual",
        "",
      ].join("\n"),
      "utf8",
    );

    // Act
    const result = syncWorkspaceCacheToPerson({
      rootDir,
      personId: "alice-example",
    });

    // Assert
    expect(result.copiedPaths).toContain(helperLayout.dirs.followerHistory);
    expect(JSON.parse(readFileSync(helperLayout.files.followerHistoryIndex, "utf8"))).toEqual({
      version: 1,
      updatedAt: "2026-03-25T08:16:30.372Z",
      entries: [
        {
          linkId: "github",
          label: "GitHub",
          platform: "github",
          handle: "alice-example",
          canonicalUrl: "https://github.com/alice-example",
          audienceKind: "followers",
          csvPath: "history/followers/github.csv",
          latestAudienceCount: 12,
          latestAudienceCountRaw: "12 followers",
          latestObservedAt: "2026-03-25T08:16:30.372Z",
        },
      ],
    });
    expect(readFileSync(join(helperLayout.dirs.followerHistory, "github.csv"), "utf8")).toContain(
      "alice-example",
    );
  });
});
