import { describe, expect, test } from "bun:test";

import { runReleaseVerification } from "./lib/release-ops/release-verify";
import { createOpenLinksUpstreamState } from "./lib/release-ops/upstream-state";

describe("release-verify", () => {
  test("passes when all verification stages succeed", async () => {
    let capturedBuildInput: unknown;
    let capturedSmokeInput: unknown;

    const result = await runReleaseVerification(
      {
        rootDir: "/tmp/open-links-sites",
        publicOrigin: "https://example.com/open-links-sites",
        canonicalOrigin: "https://links.example.com",
        eventName: "schedule",
      },
      {
        resolveDeployWorkflowContext: () => ({
          mode: "nightly",
          useChangedPaths: false,
          upstreamState: createOpenLinksUpstreamState({
            repository: "pRizz/open-links",
            branch: "main",
            commit: "1234567890abcdef",
            syncedAt: "2026-03-18T00:00:00.000Z",
          }),
          summary: "context",
        }),
        runCommand: () => ({
          status: 0,
        }),
        buildSite: async (input) => {
          capturedBuildInput = input;

          return {
            mode: "full",
            siteDir: "/tmp/open-links-sites/generated/site",
            builtPersonIds: [],
            removedPersonIds: [],
          };
        },
        planPagesDeployment: async () => ({
          artifactDir: "/tmp/open-links-sites/generated/site",
          artifactHash: "artifact-hash",
          changed: true,
          diff: {
            changed: true,
            deletes: [],
            unchanged: [],
            uploads: [],
          },
          localManifest: {
            version: 1,
            artifactHash: "artifact-hash",
            publicOrigin: "https://example.com/open-links-sites",
            files: [],
          },
          maybeRemoteManifest: null,
        }),
        runReleaseSmokeChecks: async (input) => {
          capturedSmokeInput = input;

          return {
            status: "passed",
            checks: [
              {
                key: "root-index",
                status: "passed",
                detail: "root landing page exists",
              },
              {
                key: "representative-person",
                status: "skipped",
                detail: "no active people are present, so route smoke verification was skipped",
              },
            ],
          };
        },
      },
    );

    expect(result.status).toBe("passed");
    expect(result.stages.map((stage) => stage.key)).toEqual([
      "check",
      "validate",
      "build-site",
      "plan-pages",
      "smoke-check",
    ]);
    expect(result.summary).toContain("Status: `passed`");
    expect(result.summary).toContain("Pages changed: `true`");
    expect(capturedBuildInput).toMatchObject({
      publicOrigin: "https://example.com/open-links-sites",
      canonicalOrigin: "https://links.example.com",
    });
    expect(capturedSmokeInput).toMatchObject({
      publicOrigin: "https://example.com/open-links-sites",
      canonicalOrigin: "https://links.example.com",
    });
  });

  test("fails fast when smoke checks fail after build and page planning", async () => {
    const result = await runReleaseVerification(
      {
        rootDir: "/tmp/open-links-sites",
        publicOrigin: "https://example.com/open-links-sites",
        eventName: "schedule",
      },
      {
        resolveDeployWorkflowContext: () => ({
          mode: "nightly",
          useChangedPaths: false,
          upstreamState: createOpenLinksUpstreamState({
            repository: "pRizz/open-links",
            branch: "main",
            commit: "1234567890abcdef",
            syncedAt: "2026-03-18T00:00:00.000Z",
          }),
          summary: "context",
        }),
        runCommand: () => ({
          status: 0,
        }),
        buildSite: async () => ({
          mode: "full",
          siteDir: "/tmp/open-links-sites/generated/site",
          builtPersonIds: [],
          removedPersonIds: [],
        }),
        planPagesDeployment: async () => ({
          artifactDir: "/tmp/open-links-sites/generated/site",
          artifactHash: "artifact-hash",
          changed: false,
          diff: {
            changed: false,
            deletes: [],
            unchanged: [],
            uploads: [],
          },
          localManifest: {
            version: 1,
            artifactHash: "artifact-hash",
            publicOrigin: "https://example.com/open-links-sites",
            files: [],
          },
          maybeRemoteManifest: null,
        }),
        runReleaseSmokeChecks: async () => ({
          status: "failed",
          checks: [
            {
              key: "root-index",
              status: "passed",
              detail: "root landing page exists",
            },
            {
              key: "representative-person",
              status: "failed",
              detail: "representative route is missing for alice-example",
              remediation: "inspect generated/site/alice-example/index.html output",
            },
          ],
          failedCheck: {
            key: "representative-person",
            status: "failed",
            detail: "representative route is missing for alice-example",
            remediation: "inspect generated/site/alice-example/index.html output",
          },
        }),
      },
    );

    expect(result.status).toBe("failed");
    expect(result.stages.at(-1)?.key).toBe("smoke-check");
    expect(result.stages.at(-1)?.status).toBe("failed");
    expect(result.summary).toContain(
      "Next: inspect generated/site/alice-example/index.html output",
    );
  });
});
