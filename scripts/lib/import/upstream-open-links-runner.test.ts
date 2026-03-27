import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getGeneratedWorkspaceLayout } from "./cache-layout";
import {
  type RunUpstreamScriptInput,
  type UpstreamRunnerStep,
  runUpstreamOpenLinks,
} from "./upstream-open-links-runner";

const tempRoots: string[] = [];

const writeJson = (filePath: string, value: unknown): void => {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const createWorkspace = (input: {
  avatarUrl?: string;
  links: Array<Record<string, unknown>>;
}) => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-upstream-runner-"));
  tempRoots.push(rootDir);

  const layout = getGeneratedWorkspaceLayout(rootDir, "fixture-person");
  mkdirSync(layout.dataDir, { recursive: true });
  mkdirSync(layout.dataCacheDir, { recursive: true });
  mkdirSync(layout.dataGeneratedDir, { recursive: true });

  writeFileSync(
    join(layout.dataDir, "profile.json"),
    `${JSON.stringify(
      {
        avatar: input.avatarUrl ?? "https://cdn.example.com/fixture-avatar.jpg",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(
    join(layout.dataDir, "links.json"),
    `${JSON.stringify(
      {
        links: input.links,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return layout;
};

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("runUpstreamOpenLinks", () => {
  test("reruns enrich-rich-links after public-rich-sync so generated metadata can use refreshed counts", async () => {
    // Arrange
    const layout = createWorkspace({
      links: [
        {
          id: "x-community",
          label: "Community",
          url: "https://x.com/i/communities/1871996451812769951",
          type: "rich",
          enabled: true,
          icon: "x",
        },
      ],
    });
    const calls: Array<Pick<RunUpstreamScriptInput, "stepKey" | "scriptName" | "args">> = [];

    const runUpstreamScript = (input: RunUpstreamScriptInput): UpstreamRunnerStep => {
      calls.push({
        stepKey: input.stepKey,
        scriptName: input.scriptName,
        args: input.args,
      });

      if (input.stepKey === "refresh-generated-rich-metadata") {
        writeJson(join(layout.dataGeneratedDir, "rich-metadata.json"), {
          generatedAt: "2026-03-25T20:05:00.000Z",
          links: {
            "x-community": {
              metadata: {
                membersCount: 785,
                membersCountRaw: "785 Members",
              },
            },
          },
        });
      }

      return {
        key: input.stepKey,
        status: "ran",
        blocking: false,
        stdout:
          input.stepKey === "validate-data"
            ? JSON.stringify({
                success: true,
              })
            : undefined,
      };
    };

    // Act
    const result = await runUpstreamOpenLinks(
      {
        workspace: layout,
        fullRefresh: false,
      },
      {
        resolveOpenLinksRepoDir: () => "/tmp/open-links",
        runUpstreamScript,
      },
    );

    // Assert
    expect(result.blockingFailure).toBeUndefined();
    expect(calls.map((call) => call.stepKey)).toEqual([
      "enrich-rich-links",
      "sync-profile-avatar",
      "sync-content-images",
      "public-rich-sync",
      "refresh-generated-rich-metadata",
      "validate-data",
    ]);
    expect(
      JSON.parse(readFileSync(layout.files.generatedRichMetadata, "utf8")) as {
        generatedAt?: string;
        links?: Record<
          string,
          {
            metadata?: {
              membersCount?: number;
              membersCountRaw?: string;
            };
          }
        >;
      },
    ).toEqual({
      generatedAt: "2026-03-25T20:05:00.000Z",
      links: {
        "x-community": {
          metadata: {
            membersCount: 785,
            membersCountRaw: "785 Members",
          },
        },
      },
    });
  });

  test("does not rerun enrich-rich-links when no public rich targets are eligible", async () => {
    // Arrange
    const layout = createWorkspace({
      links: [
        {
          id: "x-community",
          label: "Community",
          url: "https://x.com/i/communities/1871996451812769951",
          type: "rich",
          enabled: true,
          icon: "x",
          enrichment: {
            enabled: false,
          },
        },
      ],
    });
    const calls: Array<Pick<RunUpstreamScriptInput, "stepKey" | "scriptName" | "args">> = [];

    const runUpstreamScript = (input: RunUpstreamScriptInput): UpstreamRunnerStep => {
      calls.push({
        stepKey: input.stepKey,
        scriptName: input.scriptName,
        args: input.args,
      });

      return {
        key: input.stepKey,
        status: "ran",
        blocking: false,
        stdout:
          input.stepKey === "validate-data"
            ? JSON.stringify({
                success: true,
              })
            : undefined,
      };
    };

    // Act
    const result = await runUpstreamOpenLinks(
      {
        workspace: layout,
        fullRefresh: false,
      },
      {
        resolveOpenLinksRepoDir: () => "/tmp/open-links",
        runUpstreamScript,
      },
    );

    // Assert
    expect(result.blockingFailure).toBeUndefined();
    expect(calls.map((call) => call.stepKey)).toEqual([
      "enrich-rich-links",
      "sync-profile-avatar",
      "sync-content-images",
      "validate-data",
    ]);
    expect(result.steps.map((step) => step.key)).toEqual([
      "enrich-rich-links",
      "sync-profile-avatar",
      "sync-content-images",
      "public-rich-sync",
      "validate-data",
    ]);
    expect(result.steps.find((step) => step.key === "public-rich-sync")).toEqual({
      key: "public-rich-sync",
      status: "skipped",
      blocking: false,
      reason: "no eligible x, medium, or primal rich links were present",
    });
  });

  test("runs sync-follower-history only when explicitly enabled and before validation", async () => {
    // Arrange
    const layout = createWorkspace({
      links: [
        {
          id: "github",
          label: "GitHub",
          url: "https://github.com/fixture-person",
          type: "rich",
          enabled: true,
        },
      ],
    });
    const calls: Array<Pick<RunUpstreamScriptInput, "stepKey" | "scriptName" | "args">> = [];

    const runUpstreamScript = (input: RunUpstreamScriptInput): UpstreamRunnerStep => {
      calls.push({
        stepKey: input.stepKey,
        scriptName: input.scriptName,
        args: input.args,
      });

      return {
        key: input.stepKey,
        status: "ran",
        blocking: false,
        stdout:
          input.stepKey === "validate-data"
            ? JSON.stringify({
                success: true,
              })
            : undefined,
      };
    };

    // Act
    const result = await runUpstreamOpenLinks(
      {
        workspace: layout,
        fullRefresh: true,
        syncFollowerHistory: true,
      },
      {
        resolveOpenLinksRepoDir: () => "/tmp/open-links",
        runUpstreamScript,
      },
    );

    // Assert
    expect(result.blockingFailure).toBeUndefined();
    expect(calls.map((call) => call.stepKey)).toEqual([
      "enrich-rich-links",
      "sync-profile-avatar",
      "sync-content-images",
      "sync-follower-history",
      "validate-data",
    ]);
    expect(result.steps.map((step) => step.key)).toEqual([
      "enrich-rich-links",
      "sync-profile-avatar",
      "sync-content-images",
      "public-rich-sync",
      "sync-follower-history",
      "validate-data",
    ]);
  });
});
