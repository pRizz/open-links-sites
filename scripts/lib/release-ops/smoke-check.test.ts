import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runReleaseSmokeChecks } from "./smoke-check";

const tempRoots: string[] = [];

const createTempRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-smoke-"));
  tempRoots.push(rootDir);
  return rootDir;
};

const writeJson = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("release smoke-checks", () => {
  test("passes when built output is deployment-safe for a subpath deploy", async () => {
    const rootDir = createTempRoot();
    const siteDir = join(rootDir, "generated", "site");
    mkdirSync(join(siteDir, "landing-assets"), { recursive: true });
    mkdirSync(join(siteDir, "alice-example", "assets"), { recursive: true });

    writeFileSync(
      join(siteDir, "index.html"),
      [
        '<link rel="icon" href="/apps/links/favicon.ico" />',
        '<link rel="manifest" href="/apps/links/site.webmanifest" />',
        '<script type="module" src="/apps/links/landing-assets/main.js"></script>',
      ].join("\n"),
      "utf8",
    );
    writeJson(join(siteDir, "deploy-manifest.json"), {
      version: 1,
      artifactHash: "hash",
      publicOrigin: "https://cdn.example.com/apps/links",
      files: [],
    });
    writeJson(join(siteDir, "site.webmanifest"), {
      icons: [{ src: "./android-chrome-192x192.png" }],
    });
    writeJson(join(siteDir, "people-registry.json"), {
      entries: [],
    });
    writeFileSync(
      join(siteDir, "landing-assets", "landing.js"),
      'console.log("people-registry.json","Browse Pages");\n',
      "utf8",
    );
    writeFileSync(
      join(siteDir, "alice-example", "index.html"),
      [
        '<link rel="canonical" href="https://links.example.com/alice-example/" />',
        '<link rel="icon" href="/apps/links/alice-example/favicon.svg" />',
        '<link rel="manifest" href="/apps/links/alice-example/site.webmanifest" />',
        '<script type="module" src="/apps/links/alice-example/assets/index.js"></script>',
        '<meta property="og:url" content="https://links.example.com/alice-example/" />',
        '<meta property="og:image" content="https://links.example.com/alice-example/openlinks-social-fallback.svg" />',
        '<meta name="twitter:image" content="https://links.example.com/alice-example/openlinks-social-fallback.svg" />',
      ].join("\n"),
      "utf8",
    );
    writeJson(join(siteDir, "alice-example", "site.webmanifest"), {
      icons: [{ src: "./android-chrome-512x512.png" }],
    });

    const result = await runReleaseSmokeChecks(
      {
        rootDir,
        siteDir,
        publicOrigin: "https://cdn.example.com/apps/links",
        canonicalOrigin: "https://links.example.com",
      },
      {
        loadPersonRegistry: async () => [
          {
            id: "alice-example",
            displayName: "Alice Example",
            enabled: true,
            lifecycleStatus: "active",
            hiddenByDefault: false,
            directoryName: "alice-example",
            directoryPath: join(rootDir, "people", "alice-example"),
            manifestPath: join(rootDir, "people", "alice-example", "person.json"),
          },
        ],
      },
    );

    expect(result.status).toBe("passed");
    expect(result.checks.every((check) => check.status !== "failed")).toBe(true);
  });

  test("fails when representative HTML still contains placeholder.example", async () => {
    const rootDir = createTempRoot();
    const siteDir = join(rootDir, "generated", "site");
    mkdirSync(join(siteDir, "landing-assets"), { recursive: true });
    mkdirSync(join(siteDir, "alice-example"), { recursive: true });

    writeFileSync(
      join(siteDir, "index.html"),
      '<script type="module" src="/open-links-sites/landing-assets/main.js"></script><link rel="icon" href="/open-links-sites/favicon.ico" /><link rel="manifest" href="/open-links-sites/site.webmanifest" />',
      "utf8",
    );
    writeJson(join(siteDir, "deploy-manifest.json"), {
      version: 1,
      artifactHash: "hash",
      publicOrigin: "https://example.com/open-links-sites",
      files: [],
    });
    writeJson(join(siteDir, "site.webmanifest"), {
      icons: [{ src: "./android-chrome-192x192.png" }],
    });
    writeJson(join(siteDir, "people-registry.json"), {
      entries: [],
    });
    writeFileSync(
      join(siteDir, "landing-assets", "landing.js"),
      'console.log("people-registry.json","Browse Pages");\n',
      "utf8",
    );
    writeFileSync(
      join(siteDir, "alice-example", "index.html"),
      '<link rel="canonical" href="https://placeholder.example/alice-example/" /><link rel="icon" href="/open-links-sites/alice-example/favicon.svg" /><link rel="manifest" href="/open-links-sites/alice-example/site.webmanifest" /><script type="module" src="/open-links-sites/alice-example/assets/index.js"></script><meta property="og:url" content="https://placeholder.example/alice-example/" /><meta property="og:image" content="https://placeholder.example/alice-example/openlinks-social-fallback.svg" /><meta name="twitter:image" content="https://placeholder.example/alice-example/openlinks-social-fallback.svg" />',
      "utf8",
    );
    writeJson(join(siteDir, "alice-example", "site.webmanifest"), {
      icons: [{ src: "./android-chrome-512x512.png" }],
    });

    const result = await runReleaseSmokeChecks(
      {
        rootDir,
        siteDir,
        publicOrigin: "https://example.com/open-links-sites",
      },
      {
        loadPersonRegistry: async () => [
          {
            id: "alice-example",
            displayName: "Alice Example",
            enabled: true,
            lifecycleStatus: "active",
            hiddenByDefault: false,
            directoryName: "alice-example",
            directoryPath: join(rootDir, "people", "alice-example"),
            manifestPath: join(rootDir, "people", "alice-example", "person.json"),
          },
        ],
      },
    );

    expect(result.status).toBe("failed");
    expect(result.failedCheck?.key).toBe("representative-person");
    expect(result.failedCheck?.detail).toContain("placeholder.example");
  });
});
