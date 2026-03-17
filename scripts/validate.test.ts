import { afterEach, describe, expect, test } from "bun:test";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import {
  getTemplateAssetPath,
  loadHydratedDefaultTemplates,
  resolveRepoPath,
} from "./lib/person-contract";
import { validateRepository } from "./validate";

const tempRoots: string[] = [];

const writeJson = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const createFixtureRoot = (personId = "fixture-user"): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-"));
  tempRoots.push(rootDir);

  mkdirSync(join(rootDir, "people", personId, "assets"), { recursive: true });
  const templates = loadHydratedDefaultTemplates({
    personId,
    personName: "Fixture User",
    primaryLinkUrl: `https://example.com/${personId}`,
    profileHeadline: "TODO: add a short headline",
    profileBio: "TODO: add a one or two sentence bio for this person.",
    profileLocation: "TODO: add location",
    siteTitle: "Fixture User | OpenLinks",
    siteDescription: "TODO: add a concise site description for this person.",
  });
  const personDir = join(rootDir, "people", personId);

  writeJson(join(personDir, "person.json"), templates.person);
  writeJson(join(personDir, "profile.json"), templates.profile);
  writeJson(join(personDir, "links.json"), templates.links);
  writeJson(join(personDir, "site.json"), templates.site);
  cpSync(
    getTemplateAssetPath("avatar-placeholder.svg"),
    join(personDir, "assets", "avatar-placeholder.svg"),
  );

  return rootDir;
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("validateRepository", () => {
  test("structure: accepts a valid fixture person and surfaces placeholder guidance", async () => {
    const rootDir = createFixtureRoot();

    const result = await validateRepository(rootDir);

    expect(result.valid).toBe(true);
    expect(result.totals.people).toBe(1);
    expect(result.totals.problems).toBe(0);
    expect(result.totals.warnings).toBeGreaterThan(0);
    expect(result.totals.suggestions).toBeGreaterThan(0);
  });

  test("structure: fails when folder name and person.id diverge", async () => {
    const rootDir = createFixtureRoot();
    const manifestPath = join(rootDir, "people", "fixture-user", "person.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.id = "different-id";
    writeJson(manifestPath, manifest);

    const result = await validateRepository(rootDir);

    expect(result.valid).toBe(false);
    expect(
      result.people[0]?.issues.some((issue) => issue.code === "person_id_folder_mismatch"),
    ).toBe(true);
  });

  test("structure: fails when a required file is missing", async () => {
    const rootDir = createFixtureRoot();
    unlinkSync(join(rootDir, "people", "fixture-user", "site.json"));

    const result = await validateRepository(rootDir);

    expect(result.valid).toBe(false);
    expect(result.people[0]?.issues.some((issue) => issue.code === "missing_required_file")).toBe(
      true,
    );
  });

  test("structure: disabled people still need the full canonical source shape", async () => {
    const rootDir = createFixtureRoot();
    const manifestPath = join(rootDir, "people", "fixture-user", "person.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.enabled = false;
    manifest.lifecycle = {
      status: "disabled",
      changedAt: "2026-03-17T12:00:00.000Z",
      disabledAt: "2026-03-17T12:00:00.000Z",
    };
    writeJson(manifestPath, manifest);

    let result = await validateRepository(rootDir);
    expect(result.valid).toBe(true);

    unlinkSync(join(rootDir, "people", "fixture-user", "profile.json"));
    result = await validateRepository(rootDir);
    expect(result.valid).toBe(false);
    expect(result.people[0]?.enabled).toBe(false);
    expect(result.people[0]?.issues.some((issue) => issue.code === "missing_required_file")).toBe(
      true,
    );
  });

  test("structure: fails when a local asset escapes assets/", async () => {
    const rootDir = createFixtureRoot();
    const profilePath = join(rootDir, "people", "fixture-user", "profile.json");
    const profile = JSON.parse(readFileSync(profilePath, "utf8")) as Record<string, unknown>;
    profile.avatar = "../other/assets/avatar.png";
    writeJson(profilePath, profile);

    const result = await validateRepository(rootDir);

    expect(result.valid).toBe(false);
    expect(
      result.people[0]?.issues.some(
        (issue) => issue.code === "asset_reference_outside_person_assets",
      ),
    ).toBe(true);
  });

  test("cli: emits machine-readable json", async () => {
    const rootDir = createFixtureRoot();
    const cliResult = Bun.spawnSync({
      cmd: [
        process.execPath,
        "run",
        resolveRepoPath("scripts/validate.ts"),
        "--root",
        rootDir,
        "--format",
        "json",
      ],
      cwd: resolveRepoPath("."),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(cliResult.exitCode).toBe(0);
    const parsed = JSON.parse(new TextDecoder().decode(cliResult.stdout)) as {
      valid: boolean;
      totals: { people: number };
    };
    expect(parsed.valid).toBe(true);
    expect(parsed.totals.people).toBe(1);
  });
});
