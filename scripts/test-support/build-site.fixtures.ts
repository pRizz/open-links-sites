import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { getPersonHelperLayout } from "../lib/import/cache-layout";

export const writeJson = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const createBuildSiteTestHarness = () => {
  const tempRoots: string[] = [];

  const createTempRoot = (): string => {
    const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-build-"));
    tempRoots.push(rootDir);
    return rootDir;
  };

  const cleanup = (): void => {
    for (const rootDir of tempRoots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  };

  return {
    createTempRoot,
    cleanup,
  };
};

export const scaffoldFixture = (rootDir: string, personId: string, personName: string): void => {
  const scaffoldResult = Bun.spawnSync({
    cmd: [
      process.execPath,
      "run",
      "scripts/scaffold-person.ts",
      "--root",
      rootDir,
      "--id",
      personId,
      "--name",
      personName,
    ],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (scaffoldResult.exitCode !== 0) {
    const stderr = new TextDecoder().decode(scaffoldResult.stderr);
    throw new Error(`Failed to scaffold fixture ${personId}: ${stderr}`);
  }
};

export const disableFixture = (rootDir: string, personId: string): void => {
  const personPath = join(rootDir, "people", personId, "person.json");
  const manifest = JSON.parse(readFileSync(personPath, "utf8")) as Record<string, unknown>;
  manifest.enabled = false;
  manifest.lifecycle = {
    status: "disabled",
    changedAt: "2026-03-17T12:00:00.000Z",
    disabledAt: "2026-03-17T12:00:00.000Z",
  };
  writeFileSync(personPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
};

export const seedExternalLandingFixtures = (rootDir: string): void => {
  mkdirSync(join(rootDir, "config", "landing", "external-openlinks-media"), { recursive: true });
  writeJson(join(rootDir, "config", "landing", "external-openlinks.json"), {
    entries: [
      {
        id: "openlinks-us",
        siteUrl: "https://openlinks.us/",
        enabled: true,
      },
    ],
  });
  writeJson(join(rootDir, "config", "landing", "external-openlinks-cache.json"), {
    version: 1,
    entries: {
      "openlinks-us": {
        id: "openlinks-us",
        siteUrl: "https://openlinks.us/",
        fetchedAt: "2026-03-20T18:00:00.000Z",
        finalUrl: "https://openlinks.us/",
        destinationUrl: "https://openlinks.us/",
        displayName: "OpenLinks US",
        subtitle: "openlinks.us",
        summary: "Connected external site.",
        previewImageSourceUrl: "https://cdn.example.com/openlinks-us-preview.jpg",
        mirroredPreviewImagePath:
          "config/landing/external-openlinks-media/openlinks-us-preview.jpg",
        verification: {
          status: "confirmed",
          reasons: ["page title includes OpenLinks"],
        },
      },
    },
  });
  writeFileSync(
    join(rootDir, "config", "landing", "external-openlinks-media", "openlinks-us-preview.jpg"),
    "preview",
  );
};

export const seedHermeticFixture = (rootDir: string, personId: string): void => {
  writeJson(join(rootDir, "people", personId, "profile.json"), {
    $schema: "https://open-links.dev/schema/profile.schema.json",
    name: "Hermetic Fixture Person",
    headline: "Hermetic Fixture Headline",
    avatar: "assets/avatar-placeholder.svg",
    bio: "Hermetic fixture bio",
    location: "Fixture City",
    profileLinks: [
      {
        label: "Fixture Link",
        url: "https://fixture.example/profile",
      },
    ],
    custom: {
      bootstrapStatus: "ready",
    },
  });
  writeJson(join(rootDir, "people", personId, "links.json"), {
    $schema: "https://open-links.dev/schema/links.schema.json",
    links: [
      {
        id: "fixture-link",
        label: "Fixture Link",
        url: "https://fixture.example/profile",
        type: "simple",
        description: "Fixture profile link",
        enabled: true,
      },
      {
        id: "fixture-social",
        label: "Fixture Social",
        url: "https://social.fixture.example/@fixture",
        type: "simple",
        description: "Fixture social link",
        enabled: true,
      },
    ],
    groups: [],
    order: ["fixture-link", "fixture-social"],
    custom: {},
  });

  const helperLayout = getPersonHelperLayout(rootDir, personId);
  mkdirSync(helperLayout.dirs.contentImages, { recursive: true });
  writeJson(helperLayout.files.contentImagesManifest, {
    generatedAt: "2026-03-17T12:00:00.000Z",
    bySlot: {
      "fixture-link:image": {
        resolvedPath: "cache/content-images/fixture-preview.jpg",
        updatedAt: "2026-03-17T12:00:00.000Z",
      },
    },
  });
  writeFileSync(join(helperLayout.dirs.contentImages, "fixture-preview.jpg"), "fixture-image");
};
