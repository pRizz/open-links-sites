import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

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
});
