import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadPersonRegistry } from "./lib/manage-person/person-registry";
import { loadHydratedDefaultTemplates } from "./lib/person-contract";
import { runManagePerson } from "./manage-person";
import {
  createCapturedWriters,
  createManagePersonTestHarness,
  writeJson,
} from "./test-support/manage-person.fixtures";
import { validateRepository } from "./validate";

const { createFixtureRoot, cleanup } = createManagePersonTestHarness();

afterEach(() => {
  cleanup();
});

describe("manage-person lifecycle", () => {
  test("lifecycle-schema: scaffolding templates default to active lifecycle metadata", () => {
    // Arrange
    const templates = loadHydratedDefaultTemplates({
      personId: "lifecycle-user",
      personName: "Lifecycle User",
      primaryLinkUrl: "https://example.com/lifecycle-user",
      profileHeadline: "TODO: add a short headline",
      profileBio: "TODO: add a one or two sentence bio for this person.",
      profileLocation: "TODO: add location",
      siteTitle: "Lifecycle User | OpenLinks",
      siteDescription: "TODO: add a concise site description for this person.",
    });

    // Act
    const personTemplate = templates.person;

    // Assert
    expect(personTemplate).toMatchObject({
      enabled: true,
      lifecycle: {
        status: "active",
      },
    });
  });

  test("lifecycle-schema: validation fails when lifecycle status and enabled diverge", async () => {
    // Arrange
    const rootDir = createFixtureRoot();
    const personPath = join(rootDir, "people", "alice-example", "person.json");
    const manifest = JSON.parse(readFileSync(personPath, "utf8")) as Record<string, unknown>;
    manifest.enabled = true;
    manifest.lifecycle = {
      status: "archived",
      changedAt: "2026-03-17T12:00:00.000Z",
      archivedAt: "2026-03-17T12:00:00.000Z",
    };
    writeJson(personPath, manifest);

    // Act
    const validation = await validateRepository(rootDir);

    // Assert
    expect(validation.valid).toBe(false);
    expect(
      validation.people[0]?.issues.some((issue) => issue.code === "lifecycle_enabled_mismatch"),
    ).toBe(true);
  });

  test("lifecycle-actions: disable requires one explicit confirmation before write", async () => {
    // Arrange
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();
    const personPath = join(rootDir, "people", "alice-example", "person.json");
    const before = readFileSync(personPath, "utf8");

    // Act
    const exitCode = await runManagePerson(["disable", "--person", "alice-example"], {
      cwd: rootDir,
      stdout: stdoutWriter,
      stderr: stderrWriter,
    });

    // Assert
    expect(exitCode).toBe(1);
    expect(stdout.join("")).toBe("");
    expect(stderr.join("")).toContain("disable requires --confirm");
    expect(readFileSync(personPath, "utf8")).toBe(before);
  });

  test("lifecycle-actions: disable writes lifecycle metadata without deleting the person", async () => {
    // Arrange
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    // Act
    const exitCode = await runManagePerson(
      ["disable", "--person", "Alice Example", "--confirm", "--reason", "Temporary pause"],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
      },
    );

    // Assert
    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Disabled alice-example (Alice Example).");

    const manifest = JSON.parse(
      readFileSync(join(rootDir, "people", "alice-example", "person.json"), "utf8"),
    ) as {
      enabled: boolean;
      lifecycle: { status: string; disabledAt: string; changedAt: string; reason: string };
    };
    expect(manifest.enabled).toBe(false);
    expect(manifest.lifecycle.status).toBe("disabled");
    expect(typeof manifest.lifecycle.disabledAt).toBe("string");
    expect(typeof manifest.lifecycle.changedAt).toBe("string");
    expect(manifest.lifecycle.reason).toBe("Temporary pause");
    expect(existsSync(join(rootDir, "people", "alice-example", "profile.json"))).toBe(true);

    const registry = await loadPersonRegistry(rootDir);
    expect(registry.find((person) => person.id === "alice-example")?.lifecycleStatus).toBe(
      "disabled",
    );
  });

  test("lifecycle-actions: archive hides people by default but keeps them explicitly retrievable", async () => {
    // Arrange
    const rootDir = createFixtureRoot();
    const { stdout, stderr, stdoutWriter, stderrWriter } = createCapturedWriters();

    // Act
    const exitCode = await runManagePerson(
      ["archive", "--person", "alice-example", "--confirm", "--reason", "Offboarded"],
      {
        cwd: rootDir,
        stdout: stdoutWriter,
        stderr: stderrWriter,
      },
    );

    // Assert
    expect(exitCode).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("Archived alice-example (Alice Example).");

    const defaultRegistry = await loadPersonRegistry(rootDir);
    expect(defaultRegistry.some((person) => person.id === "alice-example")).toBe(false);

    const archiveAwareRegistry = await loadPersonRegistry(rootDir, {
      includeArchived: true,
    });
    const archivedPerson = archiveAwareRegistry.find((person) => person.id === "alice-example");
    expect(archivedPerson?.lifecycleStatus).toBe("archived");
    expect(archivedPerson?.hiddenByDefault).toBe(true);
  });
});
