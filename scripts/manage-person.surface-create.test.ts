import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MANAGE_PERSON_ACTIONS,
  buildManagePersonHelpText,
  parseManagePersonInvocation,
} from "./lib/manage-person/action-contract";
import { findPersonMatches, loadPersonRegistry } from "./lib/manage-person/person-registry";
import { runManagePerson } from "./manage-person";
import {
  createCapturedWriters,
  createManagePersonTestHarness,
} from "./test-support/manage-person.fixtures";

const { createFixtureRoot, cleanup } = createManagePersonTestHarness();

afterEach(() => {
  cleanup();
});

describe("manage-person surface and create", () => {
  test("surface: exposes the explicit CRUD action set", () => {
    // Arrange
    const helpText = buildManagePersonHelpText();

    // Act
    const actions = MANAGE_PERSON_ACTIONS;

    // Assert
    expect(actions).toEqual(["create", "import", "update", "disable", "archive"]);
    expect(helpText).toContain("bun run manage:person -- <action> [options]");
    expect(helpText).toContain("create");
    expect(helpText).toContain("import");
    expect(helpText).toContain("archive");
  });

  test("surface: parses action, root, and remaining args deterministically", () => {
    // Arrange
    const explicitRootArgs = ["--root", "/tmp/example", "update", "--person", "alice-example"];
    const invalidArgs = ["rename"];

    // Act
    const parsedInvocation = parseManagePersonInvocation(explicitRootArgs, "/cwd");
    const invalidInvocation = parseManagePersonInvocation(invalidArgs, "/cwd");

    // Assert
    expect(parsedInvocation).toEqual({
      action: "update",
      rootDir: "/tmp/example",
      remainingArgs: ["--person", "alice-example"],
      showHelp: false,
      invalidAction: undefined,
    });
    expect(invalidInvocation).toEqual({
      action: null,
      rootDir: "/cwd",
      remainingArgs: [],
      showHelp: false,
      invalidAction: "rename",
    });
  });

  test("surface: registry loads people and supports lookup by id or display name", async () => {
    // Arrange
    const rootDir = createFixtureRoot();

    // Act
    const registry = await loadPersonRegistry(rootDir);

    // Assert
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

  test("surface: router prints help text when no action is provided", async () => {
    // Arrange
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    // Act
    const exitCode = await runManagePerson([], {
      stdout: stdoutWriter,
      stderr: stderrWriter,
    });

    // Assert
    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Manage people in open-links-sites");
  });

  test("surface: router rejects unknown actions cleanly", async () => {
    // Arrange
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    // Act
    const exitCode = await runManagePerson(["rename"], {
      stdout: stdoutWriter,
      stderr: stderrWriter,
    });

    // Assert
    expect(exitCode).toBe(1);
    expect(stdout.join("")).toBe("");
    expect(stderr.join("")).toContain("Unknown action 'rename'.");
  });

  test("create: creates a person from only a name and auto-generates the id", async () => {
    // Arrange
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    // Act
    const exitCode = await runManagePerson(["create", "--name", "Charlie Example"], {
      cwd: rootDir,
      stdout: stdoutWriter,
      stderr: stderrWriter,
    });

    // Assert
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
    // Arrange
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    // Act
    const exitCode = await runManagePerson(
      ["create", "--name", "Dana Example", "--seed-url", "https://linktr.ee/dana-example"],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
      },
    );

    // Assert
    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Seed URL: https://linktr.ee/dana-example");

    const manifest = JSON.parse(
      readFileSync(join(rootDir, "people", "dana-example", "person.json"), "utf8"),
    ) as { source: { seedUrls: string[] } };
    expect(manifest.source.seedUrls).toEqual(["https://linktr.ee/dana-example"]);
  });
});
