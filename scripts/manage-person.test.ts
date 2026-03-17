import { afterEach, describe, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MANAGE_PERSON_ACTIONS,
  buildManagePersonHelpText,
  parseManagePersonInvocation,
} from "./lib/manage-person/action-contract";
import { findPersonMatches, loadPersonRegistry } from "./lib/manage-person/person-registry";
import { getTemplateAssetPath, loadHydratedDefaultTemplates } from "./lib/person-contract";
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

const createCapturedWriters = (): {
  stdout: string[];
  stderr: string[];
  stdoutWriter: { write(text: string): void };
  stderrWriter: { write(text: string): void };
} => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout,
    stderr,
    stdoutWriter: { write: (text) => stdout.push(text) },
    stderrWriter: { write: (text) => stderr.push(text) },
  };
};

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
    expect(
      findPersonMatches(registry, "alice-example").map((person) => person.displayName),
    ).toEqual(["Alice Example"]);
    expect(findPersonMatches(registry, "Bob Sample").map((person) => person.id)).toEqual([
      "bob-sample",
    ]);
    expect(findPersonMatches(registry, "alice").map((person) => person.id)).toEqual([
      "alice-example",
    ]);
  });

  test("surface: router prints help and rejects unknown actions cleanly", async () => {
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    const helpExitCode = await runManagePerson([], {
      stdout: stdoutWriter,
      stderr: stderrWriter,
    });

    expect(helpExitCode).toBe(0);
    expect(stdout.join("")).toContain("Manage people in open-links-sites");

    stdout.length = 0;
    stderr.length = 0;

    const invalidExitCode = await runManagePerson(["rename"], {
      stdout: stdoutWriter,
      stderr: stderrWriter,
    });

    expect(invalidExitCode).toBe(1);
    expect(stderr.join("")).toContain("Unknown action 'rename'.");
  });

  test("create: creates a person from only a name and auto-generates the id", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    const exitCode = await runManagePerson(["create", "--name", "Charlie Example"], {
      cwd: rootDir,
      stdout: stdoutWriter,
      stderr: stderrWriter,
    });

    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Created charlie-example (Charlie Example).");
    expect(stdout.join("")).toContain("Validation: 0 problems");

    const personPath = join(rootDir, "people", "charlie-example", "person.json");
    expect(existsSync(personPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(personPath, "utf8")) as {
      id: string;
      displayName: string;
      source: { seedUrls: string[] };
    };
    expect(manifest.id).toBe("charlie-example");
    expect(manifest.displayName).toBe("Charlie Example");
    expect(manifest.source.seedUrls).toEqual(["https://example.com/charlie-example"]);
  });

  test("create: writes an optional seed url into the scaffolded source metadata", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    const exitCode = await runManagePerson(
      ["create", "--name", "Dana Example", "--seed-url", "https://linktr.ee/dana-example"],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Seed URL: https://linktr.ee/dana-example");

    const manifest = JSON.parse(
      readFileSync(join(rootDir, "people", "dana-example", "person.json"), "utf8"),
    ) as { source: { seedUrls: string[] } };
    expect(manifest.source.seedUrls).toEqual(["https://linktr.ee/dana-example"]);
  });

  test("update: applies task-based changes after matching a person by name", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    const exitCode = await runManagePerson(
      [
        "update",
        "--person",
        "Alice Example",
        "--headline",
        "Builder and operator",
        "--site-title",
        "Alice Example | Links",
        "--notes",
        "Needs import follow-up",
      ],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Updated alice-example (Alice Example).");
    expect(stdout.join("")).toContain("Applied tasks: headline, site title, operator notes");

    const profile = JSON.parse(
      readFileSync(join(rootDir, "people", "alice-example", "profile.json"), "utf8"),
    ) as { headline: string };
    const site = JSON.parse(
      readFileSync(join(rootDir, "people", "alice-example", "site.json"), "utf8"),
    ) as { title: string };
    const manifest = JSON.parse(
      readFileSync(join(rootDir, "people", "alice-example", "person.json"), "utf8"),
    ) as { notes: string };

    expect(profile.headline).toBe("Builder and operator");
    expect(site.title).toBe("Alice Example | Links");
    expect(manifest.notes).toBe("Needs import follow-up");
  });

  test("update: rolls back writes when validation introduces blocking problems", async () => {
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();
    const personPath = join(rootDir, "people", "alice-example", "person.json");
    const before = readFileSync(personPath, "utf8");

    const exitCode = await runManagePerson(
      ["update", "--person", "alice-example", "--seed-url", "not-a-valid-url"],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
      },
    );

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toBe("");
    expect(stderr.join("")).toContain("Restored prior state");
    expect(readFileSync(personPath, "utf8")).toBe(before);
  });
});
