import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  MANAGE_PERSON_ACTIONS,
  buildManagePersonHelpText,
  parseManagePersonInvocation,
} from "./lib/manage-person/action-contract";
import { getTemplateAssetPath, loadHydratedDefaultTemplates } from "./lib/person-contract";
import { findPersonMatches, loadPersonRegistry } from "./lib/manage-person/person-registry";
import { runManagePerson } from "./manage-person";

const tempRoots: string[] = [];

const writeJson = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const createFixtureRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-manage-person-"));
  tempRoots.push(rootDir);

  const fixtures = [
    { personId: "alice-example", personName: "Alice Example" },
    { personId: "bob-sample", personName: "Bob Sample" },
  ];

  for (const fixture of fixtures) {
    const templates = loadHydratedDefaultTemplates({
      personId: fixture.personId,
      personName: fixture.personName,
      primaryLinkUrl: `https://example.com/${fixture.personId}`,
      profileHeadline: "TODO: add a short headline",
      profileBio: "TODO: add a one or two sentence bio for this person.",
      profileLocation: "TODO: add location",
      siteTitle: `${fixture.personName} | OpenLinks`,
      siteDescription: "TODO: add a concise site description for this person.",
    });
    const personDir = join(rootDir, "people", fixture.personId);
    mkdirSync(join(personDir, "assets"), { recursive: true });
    writeJson(join(personDir, "person.json"), templates.person);
    writeJson(join(personDir, "profile.json"), templates.profile);
    writeJson(join(personDir, "links.json"), templates.links);
    writeJson(join(personDir, "site.json"), templates.site);
    cpSync(
      getTemplateAssetPath("avatar-placeholder.svg"),
      join(personDir, "assets", "avatar-placeholder.svg"),
    );
  }

  return rootDir;
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("manage-person surface", () => {
  test("surface: exposes the explicit CRUD action set", () => {
    expect(MANAGE_PERSON_ACTIONS).toEqual(["create", "update", "disable", "archive"]);
    expect(buildManagePersonHelpText()).toContain("bun run manage:person -- <action> [options]");
    expect(buildManagePersonHelpText()).toContain("create");
    expect(buildManagePersonHelpText()).toContain("archive");
  });

  test("surface: parses action, root, and remaining args deterministically", () => {
    expect(
      parseManagePersonInvocation(
        ["--root", "/tmp/example", "update", "--person", "alice-example"],
        "/cwd",
      ),
    ).toEqual({
      action: "update",
      rootDir: "/tmp/example",
      remainingArgs: ["--person", "alice-example"],
      showHelp: false,
      invalidAction: undefined,
    });

    expect(parseManagePersonInvocation(["rename"], "/cwd")).toEqual({
      action: null,
      rootDir: "/cwd",
      remainingArgs: [],
      showHelp: false,
      invalidAction: "rename",
    });
  });

  test("surface: registry loads people and supports lookup by id or display name", async () => {
    const rootDir = createFixtureRoot();
    const registry = await loadPersonRegistry(rootDir);

    expect(registry.map((person) => person.id)).toEqual(["alice-example", "bob-sample"]);
    expect(findPersonMatches(registry, "alice-example").map((person) => person.displayName)).toEqual([
      "Alice Example",
    ]);
    expect(findPersonMatches(registry, "Bob Sample").map((person) => person.id)).toEqual([
      "bob-sample",
    ]);
    expect(findPersonMatches(registry, "alice").map((person) => person.id)).toEqual([
      "alice-example",
    ]);
  });

  test("surface: router prints help and rejects unknown actions cleanly", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const helpExitCode = await runManagePerson([], {
      stdout: { write: (text) => stdout.push(text) },
      stderr: { write: (text) => stderr.push(text) },
    });

    expect(helpExitCode).toBe(0);
    expect(stdout.join("")).toContain("Manage people in open-links-sites");

    stdout.length = 0;
    stderr.length = 0;

    const invalidExitCode = await runManagePerson(["rename"], {
      stdout: { write: (text) => stdout.push(text) },
      stderr: { write: (text) => stderr.push(text) },
    });

    expect(invalidExitCode).toBe(1);
    expect(stderr.join("")).toContain("Unknown action 'rename'.");
  });
});
