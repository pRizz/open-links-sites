import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { buildPersonSite } from "./lib/build/build-person-site";
import { resolveOpenLinksRepoDir } from "./lib/build/upstream-site-builder";
import {
  createBuildSiteTestHarness,
  scaffoldFixture,
  seedFollowerHistoryFixture,
  seedHermeticFixture,
} from "./test-support/build-site.fixtures";

const { createTempRoot, cleanup } = createBuildSiteTestHarness();

afterEach(() => {
  cleanup();
});

describe("build-person-site flow", () => {
  test(
    "removes placeholder profile text from the materialized workspace and built bundle",
    async () => {
      // Arrange
      const rootDir = createTempRoot();
      scaffoldFixture(rootDir, "fixture-user", "Fixture User");
      const sourceProfilePath = join(rootDir, "people", "fixture-user", "profile.json");
      const sourceProfile = JSON.parse(readFileSync(sourceProfilePath, "utf8")) as {
        headline?: string;
        bio?: string;
        location?: string;
      };
      expect(sourceProfile.headline).toBe("TODO: add a short headline");
      expect(sourceProfile.bio).toBe("TODO: add a one or two sentence bio for this person.");
      expect(sourceProfile.location).toBe("TODO: add location");

      // Act
      const result = await buildPersonSite({
        rootDir,
        personId: "fixture-user",
        buildTimestamp: "2026-03-17T12:00:00.000Z",
        publicOrigin: "https://cdn.example.com/apps/links",
        canonicalOrigin: "https://links.example.com/apps/links",
      });

      // Assert
      expect(result.personId).toBe("fixture-user");
      expect(existsSync(join(result.outputDir, "index.html"))).toBe(true);
      expect(existsSync(join(result.outputDir, "assets"))).toBe(true);

      const workspaceProfile = JSON.parse(
        readFileSync(join(result.workspaceDir, "data", "profile.json"), "utf8"),
      ) as {
        headline?: string;
        bio?: string;
        location?: string;
      };
      expect(workspaceProfile.headline).toBeUndefined();
      expect(workspaceProfile.bio).toBeUndefined();
      expect(workspaceProfile.location).toBeUndefined();

      const builtScriptName = readdirSync(join(result.outputDir, "assets")).find(
        (fileName) => fileName.startsWith("index-") && fileName.endsWith(".js"),
      );
      expect(builtScriptName).toBeDefined();
      if (!builtScriptName) {
        throw new Error("Expected the person build to emit an index script.");
      }

      const builtScript = readFileSync(join(result.outputDir, "assets", builtScriptName), "utf8");
      expect(builtScript).not.toContain("TODO: add a short headline");
      expect(builtScript).not.toContain("TODO: add a one or two sentence bio for this person.");
      expect(builtScript).not.toContain("TODO: add location");
    },
    { timeout: 30_000 },
  );

  test(
    "uses staged local person content instead of upstream repo fixture data",
    async () => {
      // Arrange
      const rootDir = createTempRoot();
      scaffoldFixture(rootDir, "fixture-user", "Fixture User");
      seedHermeticFixture(rootDir, "fixture-user");

      const upstreamRoot = resolveOpenLinksRepoDir();
      const upstreamProfile = JSON.parse(
        readFileSync(join(upstreamRoot, "data", "profile.json"), "utf8"),
      ) as { name?: string };
      const upstreamLinks = JSON.parse(
        readFileSync(join(upstreamRoot, "data", "links.json"), "utf8"),
      ) as { links?: Array<{ url?: string }> };
      const upstreamName = upstreamProfile.name;
      const upstreamLinkUrl = upstreamLinks.links?.find(
        (link) => typeof link.url === "string",
      )?.url;
      if (!upstreamName || !upstreamLinkUrl) {
        throw new Error("Expected upstream fixture data to expose a name and primary link URL.");
      }

      // Act
      const result = await buildPersonSite({
        rootDir,
        personId: "fixture-user",
        buildTimestamp: "2026-03-17T12:00:00.000Z",
        publicOrigin: "https://cdn.example.com/apps/links",
        canonicalOrigin: "https://links.example.com/apps/links",
      });

      // Assert
      const builtScriptName = readdirSync(join(result.outputDir, "assets")).find(
        (fileName) => fileName.startsWith("index-") && fileName.endsWith(".js"),
      );
      expect(builtScriptName).toBeDefined();
      if (!builtScriptName) {
        throw new Error("Expected the person build to emit an index script.");
      }

      const builtScript = readFileSync(join(result.outputDir, "assets", builtScriptName), "utf8");
      expect(builtScript).toContain("Hermetic Fixture Person");
      expect(builtScript).toContain("https://fixture.example/profile");
      expect(builtScript).not.toContain(upstreamName);
      expect(builtScript).not.toContain(upstreamLinkUrl);
    },
    { timeout: 30_000 },
  );

  test(
    "writes deployment-safe routes and isolated cache artifacts for hermetic builds",
    async () => {
      // Arrange
      const rootDir = createTempRoot();
      scaffoldFixture(rootDir, "fixture-user", "Fixture User");
      seedHermeticFixture(rootDir, "fixture-user");
      const upstreamRoot = resolveOpenLinksRepoDir();

      // Act
      const result = await buildPersonSite({
        rootDir,
        personId: "fixture-user",
        buildTimestamp: "2026-03-17T12:00:00.000Z",
        publicOrigin: "https://cdn.example.com/apps/links",
        canonicalOrigin: "https://links.example.com/apps/links",
      });

      // Assert
      const builtHtml = readFileSync(join(result.outputDir, "index.html"), "utf8");
      expect(builtHtml).toContain("/apps/links/fixture-user/assets/");
      expect(builtHtml).toContain("/apps/links/fixture-user/favicon.svg");
      expect(builtHtml).toContain("/apps/links/fixture-user/site.webmanifest");
      expect(builtHtml).not.toContain("placeholder.example");
      expect(builtHtml).toContain("https://links.example.com/apps/links/fixture-user/");

      const builtManifest = readFileSync(join(result.outputDir, "site.webmanifest"), "utf8");
      expect(builtManifest).toContain('"./android-chrome-192x192.png"');
      expect(builtManifest).not.toContain('"/android-chrome-192x192.png"');

      const builtContentImageNames = readdirSync(join(result.outputDir, "cache", "content-images"));
      expect(builtContentImageNames).toEqual(["fixture-preview.jpg"]);

      const upstreamContentImageNames = new Set(
        readdirSync(join(upstreamRoot, "public", "cache", "content-images")),
      );
      expect(
        builtContentImageNames.some((fileName) => upstreamContentImageNames.has(fileName)),
      ).toBe(false);

      const historyIndex = JSON.parse(
        readFileSync(join(result.outputDir, "history", "followers", "index.json"), "utf8"),
      ) as { entries?: Array<{ linkId?: string }> };
      expect(historyIndex.entries ?? []).toEqual([]);
      expect(readdirSync(join(result.outputDir, "history", "followers")).sort()).toEqual([
        "index.json",
      ]);
    },
    { timeout: 30_000 },
  );

  test(
    "publishes per-person follower-history artifacts when helper history exists",
    async () => {
      // Arrange
      const rootDir = createTempRoot();
      scaffoldFixture(rootDir, "fixture-user", "Fixture User");
      seedHermeticFixture(rootDir, "fixture-user");
      seedFollowerHistoryFixture(rootDir, "fixture-user");

      // Act
      const result = await buildPersonSite({
        rootDir,
        personId: "fixture-user",
        buildTimestamp: "2026-03-17T12:00:00.000Z",
        publicOrigin: "https://cdn.example.com/apps/links",
        canonicalOrigin: "https://links.example.com/apps/links",
      });

      // Assert
      const historyIndex = JSON.parse(
        readFileSync(join(result.outputDir, "history", "followers", "index.json"), "utf8"),
      ) as {
        entries?: Array<{
          audienceKind?: string;
          linkId?: string;
          canonicalUrl?: string;
          csvPath?: string;
          handle?: string;
          label?: string;
          latestAudienceCount?: number;
          latestAudienceCountRaw?: string;
          latestObservedAt?: string;
          platform?: string;
        }>;
      };
      expect(historyIndex.entries).toEqual([
        {
          audienceKind: "followers",
          linkId: "fixture-link",
          canonicalUrl: "https://fixture.example/profile",
          csvPath: "history/followers/fixture.csv",
          handle: "fixture",
          label: "Fixture Link",
          latestAudienceCount: 7,
          latestAudienceCountRaw: "7 followers",
          latestObservedAt: "2026-03-17T12:00:00.000Z",
          platform: "fixture",
        },
      ]);
      expect(
        readFileSync(join(result.outputDir, "history", "followers", "fixture.csv"), "utf8"),
      ).toContain("fixture-link");
    },
    { timeout: 30_000 },
  );
});
