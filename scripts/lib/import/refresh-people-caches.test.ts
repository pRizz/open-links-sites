import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getTemplateAssetPath, loadHydratedDefaultTemplates } from "../person-contract";
import { getGeneratedWorkspaceLayout } from "./cache-layout";
import { refreshPeopleCaches } from "./refresh-people-caches";

const tempRoots: string[] = [];

const writeJson = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const createTempRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-refresh-caches-"));
  tempRoots.push(rootDir);
  return rootDir;
};

const scaffoldPerson = (
  rootDir: string,
  input: {
    personId: string;
    personName: string;
    lifecycleStatus?: "active" | "disabled" | "archived";
    enabled?: boolean;
  },
): void => {
  const templates = loadHydratedDefaultTemplates({
    personId: input.personId,
    personName: input.personName,
    primaryLinkUrl: `https://example.com/${input.personId}`,
    profileHeadline: "Fixture headline",
    profileBio: "Fixture bio.",
    profileLocation: "Fixture location",
    siteTitle: `${input.personName} | OpenLinks`,
    siteDescription: "Fixture description.",
  });
  const personDir = join(rootDir, "people", input.personId);
  mkdirSync(join(personDir, "assets"), { recursive: true });

  const person = templates.person as {
    enabled: boolean;
    lifecycle: Record<string, unknown>;
  };
  person.enabled = input.enabled ?? input.lifecycleStatus !== "disabled";

  if (input.lifecycleStatus && input.lifecycleStatus !== "active") {
    person.lifecycle = {
      status: input.lifecycleStatus,
      changedAt: "2026-03-25T12:00:00.000Z",
      ...(input.lifecycleStatus === "disabled"
        ? { disabledAt: "2026-03-25T12:00:00.000Z" }
        : { archivedAt: "2026-03-25T12:00:00.000Z" }),
    };
  }

  writeJson(join(personDir, "person.json"), person);
  writeJson(join(personDir, "profile.json"), templates.profile);
  writeJson(join(personDir, "links.json"), templates.links);
  writeJson(join(personDir, "site.json"), templates.site);
  cpSync(
    getTemplateAssetPath("avatar-placeholder.svg"),
    join(personDir, "assets", "avatar-placeholder.svg"),
  );
};

const createWorkspaceStub = (rootDir: string, personId: string) => {
  const layout = getGeneratedWorkspaceLayout(rootDir, personId);
  return {
    personId,
    sourceDir: join(rootDir, "people", personId),
    outputDir: layout.outputDir,
    dataDir: layout.dataDir,
    publicDir: layout.publicDir,
    layout,
  };
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("refreshPeopleCaches", () => {
  test("selects one person or all active people and skips disabled or archived people", async () => {
    const rootDir = createTempRoot();
    scaffoldPerson(rootDir, { personId: "alice-example", personName: "Alice Example" });
    scaffoldPerson(rootDir, { personId: "bob-sample", personName: "Bob Sample" });
    scaffoldPerson(rootDir, {
      personId: "carol-disabled",
      personName: "Carol Disabled",
      lifecycleStatus: "disabled",
      enabled: false,
    });
    scaffoldPerson(rootDir, {
      personId: "dave-archived",
      personName: "Dave Archived",
      lifecycleStatus: "archived",
      enabled: false,
    });

    const processedIds: string[] = [];
    const syncFollowerHistorySelections: boolean[] = [];
    let refreshCounter = 0;
    const dependencies = {
      materializePerson: async ({ personId }: { personId: string; rootDir: string }) => {
        processedIds.push(personId);
        return createWorkspaceStub(rootDir, personId);
      },
      runUpstreamOpenLinks: async ({ syncFollowerHistory }: { syncFollowerHistory?: boolean }) => {
        syncFollowerHistorySelections.push(syncFollowerHistory === true);
        return {
          steps: [],
        };
      },
      syncWorkspaceCacheToPerson: ({ personId }: { rootDir: string; personId: string }) => {
        const cachePath = join(rootDir, "people", personId, "cache", "rich-public-cache.json");
        mkdirSync(join(rootDir, "people", personId, "cache"), { recursive: true });
        refreshCounter += 1;
        writeJson(cachePath, {
          version: 1,
          entries: {
            [personId]: {
              refreshedAt: `2026-03-25T12:00:0${refreshCounter}.000Z`,
            },
          },
        });

        return {
          copiedPaths: [cachePath],
        };
      },
    };

    const singleResult = await refreshPeopleCaches(
      {
        rootDir,
        personQuery: "Alice Example",
        refreshAll: false,
      },
      dependencies,
    );

    expect(singleResult.status).toBe("passed");
    expect(singleResult.counts).toEqual({
      total: 1,
      selected: 1,
      updated: 1,
      unchanged: 0,
      skipped: 0,
      failed: 0,
    });
    expect(singleResult.entries).toEqual([
      {
        personId: "alice-example",
        displayName: "Alice Example",
        status: "updated",
        detail: "cache refreshed",
      },
    ]);
    expect(processedIds).toEqual(["alice-example"]);
    expect(syncFollowerHistorySelections).toEqual([true]);

    processedIds.length = 0;
    syncFollowerHistorySelections.length = 0;

    const allResult = await refreshPeopleCaches(
      {
        rootDir,
        refreshAll: true,
      },
      dependencies,
    );

    expect(allResult.status).toBe("passed");
    expect(allResult.counts).toEqual({
      total: 4,
      selected: 2,
      updated: 2,
      unchanged: 0,
      skipped: 2,
      failed: 0,
    });
    expect(processedIds).toEqual(["alice-example", "bob-sample"]);
    expect(syncFollowerHistorySelections).toEqual([true, true]);
    expect(allResult.entries).toEqual([
      {
        personId: "carol-disabled",
        displayName: "Carol Disabled",
        status: "skipped",
        detail: "not refreshed because lifecycle status is disabled",
      },
      {
        personId: "dave-archived",
        displayName: "Dave Archived",
        status: "skipped",
        detail: "not refreshed because lifecycle status is archived",
      },
      {
        personId: "alice-example",
        displayName: "Alice Example",
        status: "updated",
        detail: "cache refreshed",
      },
      {
        personId: "bob-sample",
        displayName: "Bob Sample",
        status: "updated",
        detail: "cache refreshed",
      },
    ]);
  });

  test("reports a no-op when the cache tree is unchanged", async () => {
    const rootDir = createTempRoot();
    scaffoldPerson(rootDir, { personId: "alice-example", personName: "Alice Example" });
    const cacheDir = join(rootDir, "people", "alice-example", "cache");
    mkdirSync(cacheDir, { recursive: true });
    writeJson(join(cacheDir, "rich-public-cache.json"), {
      version: 1,
      entries: {
        alice: {
          refreshedAt: "2026-03-24T12:00:00.000Z",
        },
      },
    });

    const result = await refreshPeopleCaches(
      {
        rootDir,
        personQuery: "alice-example",
        refreshAll: false,
      },
      {
        materializePerson: async ({ personId }: { personId: string; rootDir: string }) =>
          createWorkspaceStub(rootDir, personId),
        runUpstreamOpenLinks: async () => ({
          steps: [],
        }),
        syncWorkspaceCacheToPerson: () => ({
          copiedPaths: [],
        }),
      },
    );

    expect(result.status).toBe("passed");
    expect(result.counts.unchanged).toBe(1);
    expect(result.entries[0]).toEqual({
      personId: "alice-example",
      displayName: "Alice Example",
      status: "unchanged",
      detail: "no cache changes",
    });
    expect(result.summary).toContain("Unchanged: `1`");
    expect(result.summary).toContain("no cache changes");
  });

  test("continues after one person fails and surfaces the failure in the summary", async () => {
    const rootDir = createTempRoot();
    scaffoldPerson(rootDir, { personId: "alice-example", personName: "Alice Example" });
    scaffoldPerson(rootDir, { personId: "bob-sample", personName: "Bob Sample" });

    const result = await refreshPeopleCaches(
      {
        rootDir,
        refreshAll: true,
      },
      {
        materializePerson: async ({ personId }: { personId: string; rootDir: string }) =>
          createWorkspaceStub(rootDir, personId),
        runUpstreamOpenLinks: async ({ workspace }) => {
          if (workspace.outputDir.endsWith("alice-example")) {
            return {
              steps: [
                {
                  key: "enrich-rich-links",
                  status: "failed",
                  blocking: true,
                  stderr: "remote fetch failed",
                },
              ],
              blockingFailure: {
                key: "enrich-rich-links",
                status: "failed",
                blocking: true,
                stderr: "remote fetch failed",
              },
            };
          }

          return {
            steps: [],
          };
        },
        syncWorkspaceCacheToPerson: ({ personId }: { rootDir: string; personId: string }) => {
          const cachePath = join(rootDir, "people", personId, "cache", "rich-public-cache.json");
          mkdirSync(join(rootDir, "people", personId, "cache"), { recursive: true });
          writeJson(cachePath, {
            version: 1,
            entries: {
              [personId]: {
                refreshedAt: "2026-03-25T12:00:00.000Z",
              },
            },
          });

          return {
            copiedPaths: [cachePath],
          };
        },
      },
    );

    expect(result.status).toBe("failed");
    expect(result.counts).toEqual({
      total: 2,
      selected: 2,
      updated: 1,
      unchanged: 0,
      skipped: 0,
      failed: 1,
    });
    expect(result.entries).toEqual([
      {
        personId: "alice-example",
        displayName: "Alice Example",
        status: "failed",
        detail: "enrich-rich-links failed: remote fetch failed",
      },
      {
        personId: "bob-sample",
        displayName: "Bob Sample",
        status: "updated",
        detail: "cache refreshed",
      },
    ]);
    expect(result.summary).toContain("Failed: `1`");
    expect(result.summary).toContain("remote fetch failed");
  });

  test("restores the original person state when the refresh path mutates files outside cache", async () => {
    const rootDir = createTempRoot();
    scaffoldPerson(rootDir, { personId: "alice-example", personName: "Alice Example" });
    const personPath = join(rootDir, "people", "alice-example", "person.json");
    const cacheDir = join(rootDir, "people", "alice-example", "cache");
    mkdirSync(cacheDir, { recursive: true });
    const cachePath = join(cacheDir, "rich-public-cache.json");
    writeJson(cachePath, {
      version: 1,
      entries: {
        alice: {
          refreshedAt: "2026-03-24T12:00:00.000Z",
        },
      },
    });

    const personBefore = readFileSync(personPath, "utf8");
    const cacheBefore = readFileSync(cachePath, "utf8");

    const result = await refreshPeopleCaches(
      {
        rootDir,
        personQuery: "alice-example",
        refreshAll: false,
      },
      {
        materializePerson: async ({ personId }: { personId: string; rootDir: string }) =>
          createWorkspaceStub(rootDir, personId),
        runUpstreamOpenLinks: async () => ({
          steps: [],
        }),
        syncWorkspaceCacheToPerson: ({ personId }: { rootDir: string; personId: string }) => {
          writeJson(join(rootDir, "people", personId, "person.json"), {
            id: personId,
            displayName: "Mutated Person",
          });
          writeJson(join(rootDir, "people", personId, "cache", "rich-public-cache.json"), {
            version: 1,
            entries: {
              alice: {
                refreshedAt: "2026-03-25T12:00:00.000Z",
              },
            },
          });

          return {
            copiedPaths: [join(rootDir, "people", personId, "cache", "rich-public-cache.json")],
          };
        },
      },
    );

    expect(result.status).toBe("failed");
    expect(result.counts.failed).toBe(1);
    expect(result.entries[0]?.status).toBe("failed");
    expect(result.entries[0]?.detail).toContain("write-scope violation");
    expect(readFileSync(personPath, "utf8")).toBe(personBefore);
    expect(readFileSync(cachePath, "utf8")).toBe(cacheBefore);
  });
});
