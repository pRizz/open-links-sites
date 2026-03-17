import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { validateRepository } from "./validate";

const tempRoots: string[] = [];

const createTempRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-scaffold-"));
  tempRoots.push(rootDir);
  return rootDir;
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("scaffold-person", () => {
  test("creates a valid person folder from defaults", async () => {
    const rootDir = createTempRoot();
    const cliResult = Bun.spawnSync({
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

    expect(cliResult.exitCode).toBe(0);

    const validation = await validateRepository(rootDir);
    expect(validation.valid).toBe(true);

    const manifest = JSON.parse(
      readFileSync(join(rootDir, "people", "fixture-user", "person.json"), "utf8"),
    ) as { id: string; displayName: string };
    expect(manifest.id).toBe("fixture-user");
    expect(manifest.displayName).toBe("Fixture User");
  });
});
