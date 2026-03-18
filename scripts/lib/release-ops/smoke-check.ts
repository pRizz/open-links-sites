import { existsSync } from "node:fs";
import path from "node:path";

import { loadPersonRegistry } from "../manage-person/person-registry";

export type ReleaseSmokeCheckStatus = "passed" | "failed" | "skipped";

export interface ReleaseSmokeCheck {
  key: "root-index" | "deploy-manifest" | "landing-assets" | "representative-person";
  status: ReleaseSmokeCheckStatus;
  detail: string;
  remediation?: string;
}

export interface RunReleaseSmokeChecksInput {
  rootDir: string;
  siteDir: string;
}

export interface RunReleaseSmokeChecksResult {
  status: "passed" | "failed";
  checks: ReleaseSmokeCheck[];
  failedCheck?: ReleaseSmokeCheck;
}

export interface RunReleaseSmokeChecksDependencies {
  loadPersonRegistry?: typeof loadPersonRegistry;
}

const createCheck = (
  key: ReleaseSmokeCheck["key"],
  status: ReleaseSmokeCheckStatus,
  detail: string,
  remediation?: string,
): ReleaseSmokeCheck => ({
  key,
  status,
  detail,
  remediation,
});

export const runReleaseSmokeChecks = async (
  input: RunReleaseSmokeChecksInput,
  dependencies: RunReleaseSmokeChecksDependencies = {},
): Promise<RunReleaseSmokeChecksResult> => {
  const checks: ReleaseSmokeCheck[] = [];
  const rootIndexPath = path.join(input.siteDir, "index.html");
  if (existsSync(rootIndexPath)) {
    checks.push(createCheck("root-index", "passed", "root landing page exists"));
  } else {
    const failedCheck = createCheck(
      "root-index",
      "failed",
      "root landing page is missing",
      "inspect generated/site/index.html output",
    );
    return {
      status: "failed",
      checks: [...checks, failedCheck],
      failedCheck,
    };
  }

  const deployManifestPath = path.join(input.siteDir, "deploy-manifest.json");
  if (existsSync(deployManifestPath)) {
    checks.push(createCheck("deploy-manifest", "passed", "deploy-manifest.json exists"));
  } else {
    const failedCheck = createCheck(
      "deploy-manifest",
      "failed",
      "deploy-manifest.json is missing",
      "inspect Pages artifact finalization output",
    );
    return {
      status: "failed",
      checks: [...checks, failedCheck],
      failedCheck,
    };
  }

  const landingAssetsPath = path.join(input.siteDir, "landing-assets");
  if (existsSync(landingAssetsPath)) {
    checks.push(createCheck("landing-assets", "passed", "landing-assets output exists"));
  } else {
    const failedCheck = createCheck(
      "landing-assets",
      "failed",
      "landing-assets output is missing",
      "inspect root landing page build output",
    );
    return {
      status: "failed",
      checks: [...checks, failedCheck],
      failedCheck,
    };
  }

  const registry = await (dependencies.loadPersonRegistry ?? loadPersonRegistry)(input.rootDir, {
    includeArchived: true,
  });
  const activePerson = registry.find(
    (person) => person.lifecycleStatus === "active" && person.enabled !== false,
  );

  if (!activePerson) {
    checks.push(
      createCheck(
        "representative-person",
        "skipped",
        "no active people are present, so route smoke verification was skipped",
      ),
    );
  } else {
    const representativeRoutePath = path.join(input.siteDir, activePerson.id, "index.html");
    if (existsSync(representativeRoutePath)) {
      checks.push(
        createCheck(
          "representative-person",
          "passed",
          `representative route exists for ${activePerson.id}`,
        ),
      );
    } else {
      const failedCheck = createCheck(
        "representative-person",
        "failed",
        `representative route is missing for ${activePerson.id}`,
        `inspect generated/site/${activePerson.id}/index.html output`,
      );
      return {
        status: "failed",
        checks: [...checks, failedCheck],
        failedCheck,
      };
    }
  }

  return {
    status: "passed",
    checks,
  };
};
