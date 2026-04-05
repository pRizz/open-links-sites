import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path, { join } from "node:path";

import { stageBuildRoot } from "./upstream-site-builder";

const tempRoots: string[] = [];

const createTempRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-upstream-site-builder-"));
  tempRoots.push(rootDir);
  return rootDir;
};

const writeJson = (filePath: string, value: unknown): void => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("stageBuildRoot", () => {
  test("stages upstream config alongside root files, copied directories, symlinked node_modules, and workspace data", async () => {
    // Arrange
    const rootDir = createTempRoot();
    const repoDir = join(rootDir, "upstream-open-links");
    const workspaceDir = join(rootDir, "workspace");

    mkdirSync(repoDir, { recursive: true });
    writeFileSync(join(repoDir, "index.html"), "<!doctype html>\n", "utf8");
    writeJson(join(repoDir, "package.json"), { name: "open-links-fixture", private: true });
    writeJson(join(repoDir, "tsconfig.json"), { compilerOptions: { module: "esnext" } });
    writeFileSync(join(repoDir, "vite.config.ts"), "export default {};\n", "utf8");
    writeJson(join(repoDir, "config", "deployment.defaults.json"), {
      site: { title: "Fixture deployment defaults" },
    });
    mkdirSync(join(repoDir, "scripts"), { recursive: true });
    mkdirSync(join(repoDir, "src"), { recursive: true });
    writeFileSync(join(repoDir, "scripts", "fixture.ts"), "export const fixture = true;\n", "utf8");
    writeFileSync(join(repoDir, "src", "fixture.ts"), "export const fixture = true;\n", "utf8");
    mkdirSync(join(repoDir, "node_modules"), { recursive: true });
    writeFileSync(join(repoDir, "node_modules", ".fixture"), "", "utf8");

    writeJson(join(workspaceDir, "data", "profile.json"), {
      name: "Fixture User",
    });
    writeJson(join(workspaceDir, "data", "links.json"), {
      links: [],
    });
    mkdirSync(join(workspaceDir, "public"), { recursive: true });
    writeFileSync(join(workspaceDir, "public", "favicon.svg"), "<svg></svg>\n", "utf8");

    // Act
    const buildRoot = await stageBuildRoot(repoDir, workspaceDir, "2026-04-05T12:00:00.000Z");

    // Assert
    expect(existsSync(join(buildRoot, "config", "deployment.defaults.json"))).toBe(true);
    expect(
      JSON.parse(readFileSync(join(buildRoot, "config", "deployment.defaults.json"), "utf8")) as {
        site?: { title?: string };
      },
    ).toEqual({
      site: { title: "Fixture deployment defaults" },
    });
    expect(existsSync(join(buildRoot, "index.html"))).toBe(true);
    expect(existsSync(join(buildRoot, "scripts", "fixture.ts"))).toBe(true);
    expect(existsSync(join(buildRoot, "src", "fixture.ts"))).toBe(true);
    expect(lstatSync(join(buildRoot, "node_modules")).isSymbolicLink()).toBe(true);
    expect(
      JSON.parse(readFileSync(join(buildRoot, "data", "profile.json"), "utf8")) as {
        name?: string;
      },
    ).toEqual({
      name: "Fixture User",
    });
  });
});
