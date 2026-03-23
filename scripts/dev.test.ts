import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseDevArgs, resolveServedFilePath } from "./dev";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const tempDir = mkdtempSync(join(tmpdir(), "open-links-sites-dev-"));
  tempDirs.push(tempDir);
  return tempDir;
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("dev", () => {
  test("parseDevArgs: uses local defaults when no flags are provided", () => {
    const parsed = parseDevArgs([], "/repo-root");

    expect(parsed).toEqual({
      rootDir: "/repo-root",
      host: "127.0.0.1",
      port: 4173,
      publicOrigin: "http://127.0.0.1:4173",
      canonicalOrigin: "http://127.0.0.1:4173",
      showHelp: false,
    });
  });

  test("parseDevArgs: accepts explicit host, port, and origins", () => {
    const parsed = parseDevArgs(
      [
        "--root",
        "/workspace",
        "--host",
        "localhost",
        "--port",
        "8080",
        "--public-origin",
        "https://preview.example.com/demo",
        "--canonical-origin",
        "https://links.example.com/demo",
      ],
      "/repo-root",
    );

    expect(parsed).toEqual({
      rootDir: "/workspace",
      host: "localhost",
      port: 8080,
      publicOrigin: "https://preview.example.com/demo",
      canonicalOrigin: "https://links.example.com/demo",
      showHelp: false,
    });
  });

  test("parseDevArgs: rejects invalid ports", () => {
    expect(() => parseDevArgs(["--port", "0"])).toThrow(
      "Invalid --port '0'. Use an integer between 1 and 65535.",
    );
  });

  test("resolveServedFilePath: maps root, nested routes, and files", () => {
    const siteDir = createTempDir();
    mkdirSync(join(siteDir, "alice-example"), { recursive: true });
    mkdirSync(join(siteDir, "assets"), { recursive: true });
    writeFileSync(join(siteDir, "index.html"), "root\n", "utf8");
    writeFileSync(join(siteDir, "alice-example", "index.html"), "alice\n", "utf8");
    writeFileSync(join(siteDir, "assets", "main.js"), "console.log('ok');\n", "utf8");

    expect(resolveServedFilePath(siteDir, "/")).toBe(join(siteDir, "index.html"));
    expect(resolveServedFilePath(siteDir, "/alice-example")).toBe(
      join(siteDir, "alice-example", "index.html"),
    );
    expect(resolveServedFilePath(siteDir, "/alice-example/")).toBe(
      join(siteDir, "alice-example", "index.html"),
    );
    expect(resolveServedFilePath(siteDir, "/assets/main.js")).toBe(
      join(siteDir, "assets", "main.js"),
    );
  });

  test("resolveServedFilePath: blocks traversal and missing files", () => {
    const siteDir = createTempDir();
    writeFileSync(join(siteDir, "index.html"), "root\n", "utf8");

    expect(resolveServedFilePath(siteDir, "/../secrets.txt")).toBeNull();
    expect(resolveServedFilePath(siteDir, "/missing")).toBeNull();
  });
});
