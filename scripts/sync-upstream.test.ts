import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  createOpenLinksUpstreamState,
  getOpenLinksUpstreamStatePath,
  readOpenLinksUpstreamState,
} from "./lib/release-ops/upstream-state";
import { syncUpstreamState } from "./lib/release-ops/upstream-sync";

const tempRoots: string[] = [];

const createTempRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-sync-"));
  tempRoots.push(rootDir);
  return rootDir;
};

const writeTrackedState = (rootDir: string, commit: string): void => {
  const statePath = getOpenLinksUpstreamStatePath(rootDir);
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(
    statePath,
    `${JSON.stringify(
      createOpenLinksUpstreamState({
        repository: "pRizz/open-links",
        branch: "main",
        commit,
      }),
      null,
      2,
    )}\n`,
    "utf8",
  );
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("sync-upstream", () => {
  test("reports a no-op when tracked and latest commits match", async () => {
    const rootDir = createTempRoot();
    writeTrackedState(rootDir, "abc1234567890");

    const result = await syncUpstreamState(
      {
        rootDir,
        writeState: true,
      },
      {
        readLatestState: async () =>
          createOpenLinksUpstreamState({
            repository: "pRizz/open-links",
            branch: "main",
            commit: "abc1234567890",
          }),
      },
    );

    expect(result.result).toBe("no-op");
    expect(result.changed).toBe(false);
    expect(result.wroteState).toBe(false);
    expect(result.verificationRequired).toBe(false);
    expect(readOpenLinksUpstreamState(rootDir).commit).toBe("abc1234567890");
  });

  test("writes updated tracked state when upstream has moved", async () => {
    const rootDir = createTempRoot();
    writeTrackedState(rootDir, "abc1234567890");

    const result = await syncUpstreamState(
      {
        rootDir,
        writeState: true,
      },
      {
        readLatestState: async () =>
          createOpenLinksUpstreamState({
            repository: "pRizz/open-links",
            branch: "main",
            commit: "def9876543210",
          }),
      },
    );

    expect(result.result).toBe("changed");
    expect(result.changed).toBe(true);
    expect(result.wroteState).toBe(true);
    expect(result.verificationRequired).toBe(true);
    expect(readOpenLinksUpstreamState(rootDir).commit).toBe("def9876543210");
  });

  test("returns blocked when upstream state cannot be resolved", async () => {
    const rootDir = createTempRoot();
    writeTrackedState(rootDir, "abc1234567890");

    const result = await syncUpstreamState(
      {
        rootDir,
        writeState: true,
      },
      {
        readLatestState: async () => {
          throw new Error("origin/main could not be resolved");
        },
      },
    );

    expect(result.result).toBe("blocked");
    expect(result.changed).toBe(false);
    expect(result.verificationRequired).toBe(false);
    expect(result.reason).toContain("origin/main could not be resolved");
    expect(readFileSync(getOpenLinksUpstreamStatePath(rootDir), "utf8")).toContain("abc1234567890");
  });

  test("reads legacy upstream state files that still include syncedAt", () => {
    const rootDir = createTempRoot();
    const statePath = getOpenLinksUpstreamStatePath(rootDir);
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(
      statePath,
      `${JSON.stringify(
        {
          version: 1,
          repository: "pRizz/open-links",
          branch: "main",
          commit: "legacy12345678",
          syncedAt: "2026-03-17T00:00:00.000Z",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(readOpenLinksUpstreamState(rootDir)).toEqual({
      version: 1,
      repository: "pRizz/open-links",
      branch: "main",
      commit: "legacy12345678",
    });
  });
});
