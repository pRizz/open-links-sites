import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import {
  type RegisteredPerson,
  findPersonMatches,
  loadPersonRegistry,
} from "../manage-person/person-registry";
import { materializePerson } from "../materialize-person";
import { formatWorkflowSummary } from "../release-ops/workflow-summary";
import { syncWorkspaceCacheToPerson } from "./cache-sync";
import { type UpstreamRunnerResult, runUpstreamOpenLinks } from "./upstream-open-links-runner";

export interface RefreshPeopleCachesInput {
  rootDir: string;
  personQuery?: string;
  refreshAll: boolean;
}

export interface RefreshPeopleCachesEntry {
  personId: string;
  displayName: string;
  status: "updated" | "unchanged" | "skipped" | "failed";
  detail: string;
}

export interface RefreshPeopleCachesResult {
  status: "passed" | "failed";
  counts: {
    total: number;
    selected: number;
    updated: number;
    unchanged: number;
    skipped: number;
    failed: number;
  };
  entries: RefreshPeopleCachesEntry[];
  summary: string;
}

export interface RefreshPeopleCachesDependencies {
  loadPersonRegistry?: typeof loadPersonRegistry;
  materializePerson?: typeof materializePerson;
  runUpstreamOpenLinks?: (input: {
    workspace: Awaited<ReturnType<typeof materializePerson>>["layout"];
    fullRefresh: boolean;
    syncFollowerHistory?: boolean;
  }) => Promise<UpstreamRunnerResult>;
  syncWorkspaceCacheToPerson?: typeof syncWorkspaceCacheToPerson;
}

interface PersonSnapshot {
  rootDir: string;
  path: string;
}

const CACHE_DIRECTORY_PREFIX = "cache/";

const isRefreshablePerson = (person: RegisteredPerson): boolean =>
  person.lifecycleStatus === "active" && person.enabled !== false;

const readDirectoryFileHashes = (rootDir: string): Map<string, string> => {
  const hashes = new Map<string, string>();

  if (!existsSync(rootDir)) {
    return hashes;
  }

  const visit = (currentDir: string): void => {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = relative(rootDir, absolutePath).split("\\").join("/");
      const fileBuffer = readFileSync(absolutePath);
      hashes.set(relativePath, createHash("sha256").update(fileBuffer).digest("hex"));
    }
  };

  visit(rootDir);
  return hashes;
};

const listChangedPaths = (
  before: Map<string, string>,
  after: Map<string, string>,
  filter: (path: string) => boolean,
): string[] => {
  const paths = new Set<string>();

  for (const path of before.keys()) {
    if (filter(path)) {
      paths.add(path);
    }
  }

  for (const path of after.keys()) {
    if (filter(path)) {
      paths.add(path);
    }
  }

  return [...paths]
    .filter((path) => before.get(path) !== after.get(path))
    .sort((left, right) => left.localeCompare(right));
};

const createPersonSnapshot = (personDir: string): PersonSnapshot => {
  const snapshotRoot = mkdtempSync(join(tmpdir(), "open-links-sites-cache-refresh-"));
  const snapshotPath = join(snapshotRoot, "person");

  if (existsSync(personDir)) {
    cpSync(personDir, snapshotPath, {
      recursive: true,
    });
  }

  return {
    rootDir: snapshotRoot,
    path: snapshotPath,
  };
};

const restorePersonSnapshot = (personDir: string, snapshot: PersonSnapshot): void => {
  rmSync(personDir, { recursive: true, force: true });

  if (!existsSync(snapshot.path)) {
    return;
  }

  cpSync(snapshot.path, personDir, {
    recursive: true,
  });
};

const disposePersonSnapshot = (snapshot: PersonSnapshot): void => {
  rmSync(snapshot.rootDir, { recursive: true, force: true });
};

const formatFailureDetail = (result: UpstreamRunnerResult): string => {
  const blockingStep = result.blockingFailure;
  if (!blockingStep) {
    return "cache refresh failed";
  }

  const commandOutput = [blockingStep.stderr, blockingStep.stdout].find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );

  return commandOutput
    ? `${blockingStep.key} failed: ${commandOutput}`
    : `${blockingStep.key} failed`;
};

const buildRefreshSummary = (
  input: RefreshPeopleCachesInput,
  result: RefreshPeopleCachesResult,
): string =>
  formatWorkflowSummary(
    "Refresh People Caches",
    result.status === "failed" ? "failed" : "passed",
    [
      `- Mode: \`${input.refreshAll ? "all" : "person"}\``,
      input.personQuery ? `- Person: \`${input.personQuery}\`` : undefined,
      `- Total: \`${result.counts.total}\``,
      `- Selected: \`${result.counts.selected}\``,
      `- Updated: \`${result.counts.updated}\``,
      `- Unchanged: \`${result.counts.unchanged}\``,
      `- Skipped: \`${result.counts.skipped}\``,
      `- Failed: \`${result.counts.failed}\``,
    ],
    result.entries.map((entry) => ({
      key: entry.personId,
      status:
        entry.status === "updated"
          ? "changed"
          : entry.status === "unchanged"
            ? "no-op"
            : entry.status === "skipped"
              ? "skipped"
              : "failed",
      detail: `${entry.displayName}: ${entry.detail}`,
      remediation:
        entry.status === "failed"
          ? "inspect the upstream refresh output and rerun a targeted cache refresh"
          : undefined,
    })),
  );

const resolveSelectedPeople = async (
  input: RefreshPeopleCachesInput,
  dependencies: RefreshPeopleCachesDependencies,
): Promise<{
  registry: RegisteredPerson[];
  selected: RegisteredPerson[];
}> => {
  const registry = await (dependencies.loadPersonRegistry ?? loadPersonRegistry)(input.rootDir, {
    includeArchived: true,
  });

  if (input.refreshAll) {
    return {
      registry,
      selected: registry.filter(isRefreshablePerson),
    };
  }

  const personQuery = input.personQuery?.trim();
  if (!personQuery) {
    throw new Error("refresh:people:caches requires --person or --all.");
  }

  const matches = findPersonMatches(registry, personQuery);
  if (matches.length === 0) {
    throw new Error(`No person matched '${personQuery}'.`);
  }

  if (matches.length > 1) {
    throw new Error(
      [
        `Multiple people matched '${personQuery}'.`,
        ...matches.map((match) => `- ${match.id} (${match.displayName})`),
      ].join("\n"),
    );
  }

  const [person] = matches;
  if (!isRefreshablePerson(person)) {
    throw new Error(`Cannot refresh non-active person '${person.id}'.`);
  }

  return {
    registry,
    selected: [person],
  };
};

const refreshOnePersonCache = async (
  person: RegisteredPerson,
  input: RefreshPeopleCachesInput,
  dependencies: RefreshPeopleCachesDependencies,
): Promise<RefreshPeopleCachesEntry> => {
  const snapshot = createPersonSnapshot(person.directoryPath);
  const beforeState = readDirectoryFileHashes(snapshot.path);

  try {
    const workspace = await (dependencies.materializePerson ?? materializePerson)({
      personId: person.id,
      rootDir: input.rootDir,
    });
    const upstreamResult = await (dependencies.runUpstreamOpenLinks ?? runUpstreamOpenLinks)({
      workspace: workspace.layout,
      fullRefresh: true,
      syncFollowerHistory: true,
    });

    if (upstreamResult.blockingFailure) {
      restorePersonSnapshot(person.directoryPath, snapshot);
      return {
        personId: person.id,
        displayName: person.displayName,
        status: "failed",
        detail: formatFailureDetail(upstreamResult),
      };
    }

    (dependencies.syncWorkspaceCacheToPerson ?? syncWorkspaceCacheToPerson)({
      rootDir: input.rootDir,
      personId: person.id,
    });

    const afterState = readDirectoryFileHashes(person.directoryPath);
    const unexpectedChanges = listChangedPaths(
      beforeState,
      afterState,
      (path) => !path.startsWith(CACHE_DIRECTORY_PREFIX),
    );

    if (unexpectedChanges.length > 0) {
      restorePersonSnapshot(person.directoryPath, snapshot);
      return {
        personId: person.id,
        displayName: person.displayName,
        status: "failed",
        detail: `write-scope violation touched ${unexpectedChanges.join(", ")}`,
      };
    }

    const cacheChanges = listChangedPaths(beforeState, afterState, (path) =>
      path.startsWith(CACHE_DIRECTORY_PREFIX),
    );

    return {
      personId: person.id,
      displayName: person.displayName,
      status: cacheChanges.length > 0 ? "updated" : "unchanged",
      detail: cacheChanges.length > 0 ? "cache refreshed" : "no cache changes",
    };
  } catch (error) {
    restorePersonSnapshot(person.directoryPath, snapshot);
    return {
      personId: person.id,
      displayName: person.displayName,
      status: "failed",
      detail: error instanceof Error ? error.message : "cache refresh failed",
    };
  } finally {
    disposePersonSnapshot(snapshot);
  }
};

export const refreshPeopleCaches = async (
  input: RefreshPeopleCachesInput,
  dependencies: RefreshPeopleCachesDependencies = {},
): Promise<RefreshPeopleCachesResult> => {
  const selection = await resolveSelectedPeople(input, dependencies);
  const entries: RefreshPeopleCachesEntry[] = [];

  if (input.refreshAll) {
    for (const person of selection.registry) {
      if (isRefreshablePerson(person)) {
        continue;
      }

      entries.push({
        personId: person.id,
        displayName: person.displayName,
        status: "skipped",
        detail: `not refreshed because lifecycle status is ${person.lifecycleStatus}`,
      });
    }
  }

  for (const person of selection.selected) {
    entries.push(await refreshOnePersonCache(person, input, dependencies));
  }

  const result: RefreshPeopleCachesResult = {
    status: entries.some((entry) => entry.status === "failed") ? "failed" : "passed",
    counts: {
      total: entries.length,
      selected: selection.selected.length,
      updated: entries.filter((entry) => entry.status === "updated").length,
      unchanged: entries.filter((entry) => entry.status === "unchanged").length,
      skipped: entries.filter((entry) => entry.status === "skipped").length,
      failed: entries.filter((entry) => entry.status === "failed").length,
    },
    entries,
    summary: "",
  };

  result.summary = buildRefreshSummary(input, result);
  return result;
};
