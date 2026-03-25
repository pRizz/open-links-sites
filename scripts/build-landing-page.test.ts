import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { buildLandingPage } from "./lib/build/build-landing-page";
import { getGeneratedSiteLayout } from "./lib/build/site-layout";
import {
  createBuildSiteTestHarness,
  seedExternalLandingFixtures,
} from "./test-support/build-site.fixtures";

const { createTempRoot, cleanup } = createBuildSiteTestHarness();

afterEach(() => {
  cleanup();
});

describe("build-landing-page", () => {
  test("builds the landing shell and core files into generated/site", async () => {
    // Arrange
    const rootDir = createTempRoot();
    seedExternalLandingFixtures(rootDir);

    // Act
    const result = await buildLandingPage({
      rootDir,
      publicOrigin: "https://example.com/open-links-sites",
    });

    // Assert
    const layout = getGeneratedSiteLayout(rootDir);
    expect(result.siteDir).toBe(layout.siteDir);
    expect(existsSync(join(layout.siteDir, "index.html"))).toBe(true);
    expect(existsSync(layout.landingAssetsDir)).toBe(true);
    expect(existsSync(join(layout.siteDir, "site.webmanifest"))).toBe(true);
    expect(existsSync(layout.landingRegistryPath)).toBe(true);
  });

  test("writes the landing registry payload and mirrors preview assets", async () => {
    // Arrange
    const rootDir = createTempRoot();
    seedExternalLandingFixtures(rootDir);

    // Act
    await buildLandingPage({
      rootDir,
      publicOrigin: "https://example.com/open-links-sites",
    });

    // Assert
    const layout = getGeneratedSiteLayout(rootDir);
    const registryPayload = JSON.parse(readFileSync(layout.landingRegistryPath, "utf8")) as {
      entries: Array<{ id: string; previewImageUrl?: string }>;
    };
    expect(registryPayload.entries.map((entry) => entry.id)).toEqual(["openlinks-us"]);
    expect(registryPayload.entries[0]?.previewImageUrl).toBe(
      "/open-links-sites/landing-assets/registry/openlinks-us-preview.jpg",
    );
    expect(existsSync(join(layout.landingRegistryAssetsDir, "openlinks-us-preview.jpg"))).toBe(
      true,
    );
  });

  test("emits a JavaScript bundle that references the landing registry payload", async () => {
    // Arrange
    const rootDir = createTempRoot();
    seedExternalLandingFixtures(rootDir);

    // Act
    await buildLandingPage({
      rootDir,
      publicOrigin: "https://example.com/open-links-sites",
    });

    // Assert
    const layout = getGeneratedSiteLayout(rootDir);
    const landingScriptName = readdirSync(layout.landingAssetsDir).find((fileName) =>
      fileName.endsWith(".js"),
    );
    expect(landingScriptName).toBeDefined();
    if (!landingScriptName) {
      throw new Error("Expected the landing build to emit a JavaScript bundle.");
    }

    const landingScript = readFileSync(join(layout.landingAssetsDir, landingScriptName), "utf8");
    expect(landingScript).toContain("landing-registry.json");
  });

  test("writes deployment-safe html and manifest asset paths for subpath deploys", async () => {
    // Arrange
    const rootDir = createTempRoot();
    seedExternalLandingFixtures(rootDir);

    // Act
    await buildLandingPage({
      rootDir,
      publicOrigin: "https://example.com/open-links-sites",
    });

    // Assert
    const layout = getGeneratedSiteLayout(rootDir);
    const html = readFileSync(join(layout.siteDir, "index.html"), "utf8");
    expect(html).toContain("OpenLinks Sites");
    expect(html).toContain("/open-links-sites/landing-assets/");
    expect(html).toContain("/open-links-sites/favicon.ico");
    expect(html).toContain("/open-links-sites/site.webmanifest");

    const manifest = readFileSync(join(layout.siteDir, "site.webmanifest"), "utf8");
    expect(manifest).toContain('"./android-chrome-192x192.png"');
    expect(manifest).not.toContain('"/android-chrome-192x192.png"');
  });

  test("keeps root deployments on root-relative asset paths", async () => {
    // Arrange
    const rootDir = createTempRoot();

    // Act
    await buildLandingPage({
      rootDir,
      publicOrigin: "https://links.example.com",
    });

    // Assert
    const html = readFileSync(join(getGeneratedSiteLayout(rootDir).siteDir, "index.html"), "utf8");
    expect(html).toContain("/landing-assets/");
    expect(html).not.toContain("/open-links-sites/landing-assets/");
  });
});
