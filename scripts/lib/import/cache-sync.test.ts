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
    expect(readFileSync(helperLayout.files.richEnrichmentReport, "utf8")).toBe(
      [
        "{",
        '  "generatedAt": "2026-03-25T08:16:30.372Z",',
        '  "entries": [{ "missingProfileFields": ["subscribersCount"] }]',
        "}",
        "",
      ].join("\n"),
    );
  });
});
