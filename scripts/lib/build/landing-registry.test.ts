import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { buildLandingRegistry } from "./landing-registry";

const tempRoots: string[] = [];

const createTempRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-landing-registry-"));
  tempRoots.push(rootDir);
  return rootDir;
};

const scaffoldFixture = (rootDir: string, personId: string, personName: string): void => {
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

  expect(scaffoldResult.exitCode).toBe(0);
};

const writeJson = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("landing-registry", () => {
  test("includes only active enabled people and suppresses placeholder fields", async () => {
    const rootDir = createTempRoot();
    scaffoldFixture(rootDir, "alice-example", "Alice Example");
    scaffoldFixture(rootDir, "bob-disabled", "Bob Disabled");
    scaffoldFixture(rootDir, "carol-archived", "Carol Archived");
    scaffoldFixture(rootDir, "dana-example", "Dana Example");
    scaffoldFixture(rootDir, "eve-example", "Eve Example");

    writeJson(join(rootDir, "people", "bob-disabled", "person.json"), {
      $schema: "../../schemas/person.schema.json",
      id: "bob-disabled",
      displayName: "Bob Disabled",
      enabled: false,
      lifecycle: {
        status: "disabled",
      },
      source: {
        kind: "manual",
        seedUrls: ["https://example.com/bob-disabled"],
      },
      custom: {},
    });
    writeJson(join(rootDir, "people", "carol-archived", "person.json"), {
      $schema: "../../schemas/person.schema.json",
      id: "carol-archived",
      displayName: "Carol Archived",
      enabled: false,
      lifecycle: {
        status: "archived",
      },
      source: {
        kind: "manual",
        seedUrls: ["https://example.com/carol-archived"],
      },
      custom: {},
    });

    writeJson(join(rootDir, "people", "alice-example", "profile.json"), {
      $schema: "https://open-links.dev/schema/profile.schema.json",
      name: "Alice Example",
      headline: "Bitcoin educator and host",
      avatar: "https://cdn.example.com/alice.jpg",
      bio: "Alice curates interviews and explainers for new Bitcoin users.",
      location: "Chicago, IL",
      profileLinks: [],
      custom: {},
    });
    writeJson(join(rootDir, "people", "dana-example", "profile.json"), {
      $schema: "https://open-links.dev/schema/profile.schema.json",
      name: "Dana Example",
      headline: "TODO: add a short headline",
      avatar: "assets/dana.jpg",
      bio: "TODO: add a one or two sentence bio for this person.",
      location: "Austin, TX",
      profileLinks: [],
      custom: {},
    });
    writeJson(join(rootDir, "people", "dana-example", "site.json"), {
      $schema: "https://open-links.dev/schema/site.schema.json",
      title: "Dana Example | OpenLinks",
      description: "Dana publishes product notes and speaking links.",
      baseUrl: "/dana-example/",
      theme: {
        active: "sleek",
        available: ["sleek"],
      },
      custom: {},
    });
    mkdirSync(join(rootDir, "people", "dana-example", "assets"), { recursive: true });
    writeFileSync(join(rootDir, "people", "dana-example", "assets", "dana.jpg"), "avatar");

    const outputPath = join(rootDir, "generated", "site", "people-registry.json");
    const result = await buildLandingRegistry({
      rootDir,
      outputDir: outputPath,
      publicOrigin: "https://example.com/network",
    });

    expect(result.payload.entries.map((entry) => entry.id)).toEqual([
      "alice-example",
      "dana-example",
      "eve-example",
    ]);
    expect(result.payload.entries[0]).toEqual({
      id: "alice-example",
      displayName: "Alice Example",
      path: "/network/alice-example/",
      avatarUrl: "https://cdn.example.com/alice.jpg",
      headline: "Bitcoin educator and host",
      summary: "Alice curates interviews and explainers for new Bitcoin users.",
    });
    expect(result.payload.entries[1]).toEqual({
      id: "dana-example",
      displayName: "Dana Example",
      path: "/network/dana-example/",
      avatarUrl: "/network/dana-example/assets/dana.jpg",
      summary: "Dana publishes product notes and speaking links.",
    });
    expect(result.payload.entries[2]).toEqual({
      id: "eve-example",
      displayName: "Eve Example",
      path: "/network/eve-example/",
    });

    const writtenPayload = JSON.parse(readFileSync(outputPath, "utf8")) as {
      entries: Array<{ id: string }>;
    };
    expect(writtenPayload.entries.map((entry) => entry.id)).toEqual([
      "alice-example",
      "dana-example",
      "eve-example",
    ]);
  });
});
