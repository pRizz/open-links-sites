import { spawnSync } from "node:child_process";
import process from "node:process";

import { type BuildSiteResult, buildSite } from "../build/build-site";
import {
  type BuildSelection,
  detectBuildSelection,
  loadChangedPaths,
} from "../build/change-detection";
import { type ExecuteBuildSelectionResult, executeBuildSelection } from "../build/selective-build";
import { getGeneratedSiteLayout } from "../build/site-layout";
import { type PlanPagesDeploymentResult, planPagesDeployment } from "../deploy/pages-plan";
import { type DeployWorkflowContext, resolveDeployWorkflowContext } from "./deploy-context";
import { type RunReleaseSmokeChecksResult, runReleaseSmokeChecks } from "./smoke-check";
import { type WorkflowSummaryStage, formatWorkflowSummary } from "./workflow-summary";

export interface CommandExecutionResult {
  status: number;
  stdout?: string;
  stderr?: string;
}

export interface RunReleaseVerificationInput {
  rootDir: string;
  publicOrigin: string;
  eventName?: string;
  changedPaths?: string[];
  changedPathsFile?: string;
  baseRef?: string;
}

export interface ReleaseVerificationStage extends WorkflowSummaryStage {}

export interface ReleaseVerificationResult {
  status: "passed" | "failed";
  context: DeployWorkflowContext;
  stages: ReleaseVerificationStage[];
  siteDir?: string;
  buildResult?: BuildSiteResult | ExecuteBuildSelectionResult;
  pagesPlan?: PlanPagesDeploymentResult;
  smokeChecks?: RunReleaseSmokeChecksResult;
  summary: string;
}

export interface ReleaseVerificationDependencies {
  resolveDeployWorkflowContext?: typeof resolveDeployWorkflowContext;
  runCommand?: (rootDir: string, scriptName: string) => CommandExecutionResult;
  buildSite?: typeof buildSite;
  executeBuildSelection?: typeof executeBuildSelection;
  planPagesDeployment?: typeof planPagesDeployment;
  runReleaseSmokeChecks?: typeof runReleaseSmokeChecks;
}

const formatCommandFailure = (result: CommandExecutionResult): string => {
  const details = [result.stderr?.trim(), result.stdout?.trim()].filter(Boolean).join("\n");
  return details || `command failed with exit code ${result.status}`;
};

const defaultRunCommand = (rootDir: string, scriptName: string): CommandExecutionResult => {
  const result = spawnSync(process.execPath, ["run", scriptName], {
    cwd: rootDir,
    encoding: "utf8",
    env: process.env,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout?.trim() || undefined,
    stderr: result.stderr?.trim() || undefined,
  };
};

const formatBuildDetail = (result: BuildSiteResult | ExecuteBuildSelectionResult): string =>
  [
    `mode=${result.mode}`,
    `built=${result.builtPersonIds.length}`,
    `removed=${result.removedPersonIds.length}`,
  ].join(", ");

const formatPagesPlanDetail = (result: PlanPagesDeploymentResult): string =>
  [
    `changed=${result.changed}`,
    `uploads=${result.diff.uploads.length}`,
    `deletes=${result.diff.deletes.length}`,
  ].join(", ");

const formatSmokeCheckDetail = (result: RunReleaseSmokeChecksResult): string => {
  const passedChecks = result.checks.filter((check) => check.status === "passed").length;
  const skippedChecks = result.checks.filter((check) => check.status === "skipped").length;

  if (result.status === "failed" && result.failedCheck) {
    return `${result.failedCheck.key}: ${result.failedCheck.detail}`;
  }

  return `passed=${passedChecks}, skipped=${skippedChecks}`;
};

const buildVerificationSummary = (result: ReleaseVerificationResult): string =>
  formatWorkflowSummary(
    "Release Verify",
    result.status,
    [
      `- Deploy mode: \`${result.context.mode}\``,
      `- Pinned upstream: \`${result.context.upstreamState.repository}@${result.context.upstreamState.commit.slice(0, 12)}\``,
      result.pagesPlan ? `- Pages changed: \`${result.pagesPlan.changed}\`` : undefined,
    ],
    result.stages,
  );

export const runReleaseVerification = async (
  input: RunReleaseVerificationInput,
  dependencies: ReleaseVerificationDependencies = {},
): Promise<ReleaseVerificationResult> => {
  const context = (dependencies.resolveDeployWorkflowContext ?? resolveDeployWorkflowContext)({
    rootDir: input.rootDir,
    eventName: input.eventName,
  });
  const runCommand = dependencies.runCommand ?? defaultRunCommand;
  const stages: ReleaseVerificationStage[] = [];

  const checkCommandResult = runCommand(input.rootDir, "check");
  if (checkCommandResult.status !== 0) {
    stages.push({
      key: "check",
      status: "failed",
      detail: formatCommandFailure(checkCommandResult),
      remediation: "inspect typecheck, lint, or test output from `bun run check`",
    });

    const failedResult: ReleaseVerificationResult = {
      status: "failed",
      context,
      stages,
      summary: "",
    };
    failedResult.summary = buildVerificationSummary(failedResult);
    return failedResult;
  }
  stages.push({
    key: "check",
    status: "passed",
    detail: "typecheck, lint, and test suite passed",
  });

  const validateCommandResult = runCommand(input.rootDir, "validate");
  if (validateCommandResult.status !== 0) {
    stages.push({
      key: "validate",
      status: "failed",
      detail: formatCommandFailure(validateCommandResult),
      remediation: "inspect repository validation output from `bun run validate`",
    });

    const failedResult: ReleaseVerificationResult = {
      status: "failed",
      context,
      stages,
      summary: "",
    };
    failedResult.summary = buildVerificationSummary(failedResult);
    return failedResult;
  }
  stages.push({
    key: "validate",
    status: "passed",
    detail: "repository validation passed",
  });

  let buildResult: BuildSiteResult | ExecuteBuildSelectionResult;
  try {
    if (context.useChangedPaths) {
      const selection: BuildSelection = detectBuildSelection(
        loadChangedPaths({
          baseRef: input.baseRef,
          changedPaths: input.changedPaths,
          changedPathsFile: input.changedPathsFile,
        }),
      );
      buildResult = await (dependencies.executeBuildSelection ?? executeBuildSelection)({
        rootDir: input.rootDir,
        publicOrigin: input.publicOrigin,
        selection,
      });
    } else {
      buildResult = await (dependencies.buildSite ?? buildSite)({
        rootDir: input.rootDir,
      });
    }
  } catch (error) {
    stages.push({
      key: "build-site",
      status: "failed",
      detail: error instanceof Error ? error.message : "site build failed",
      remediation: "inspect build logs and generated workspace output",
    });

    const failedResult: ReleaseVerificationResult = {
      status: "failed",
      context,
      stages,
      summary: "",
    };
    failedResult.summary = buildVerificationSummary(failedResult);
    return failedResult;
  }
  stages.push({
    key: "build-site",
    status: "passed",
    detail: formatBuildDetail(buildResult),
  });

  const siteDir = buildResult.siteDir ?? getGeneratedSiteLayout(input.rootDir).siteDir;
  let pagesPlan: PlanPagesDeploymentResult;
  try {
    pagesPlan = await (dependencies.planPagesDeployment ?? planPagesDeployment)({
      siteDir,
      publicOrigin: input.publicOrigin,
    });
  } catch (error) {
    stages.push({
      key: "plan-pages",
      status: "failed",
      detail: error instanceof Error ? error.message : "Pages planning failed",
      remediation: "inspect generated/site and deploy-manifest planning output",
    });

    const failedResult: ReleaseVerificationResult = {
      status: "failed",
      context,
      stages,
      siteDir,
      buildResult,
      summary: "",
    };
    failedResult.summary = buildVerificationSummary(failedResult);
    return failedResult;
  }
  stages.push({
    key: "plan-pages",
    status: "passed",
    detail: formatPagesPlanDetail(pagesPlan),
  });

  let smokeChecks: RunReleaseSmokeChecksResult;
  try {
    smokeChecks = await (dependencies.runReleaseSmokeChecks ?? runReleaseSmokeChecks)({
      rootDir: input.rootDir,
      siteDir,
    });
  } catch (error) {
    stages.push({
      key: "smoke-check",
      status: "failed",
      detail: error instanceof Error ? error.message : "smoke checks failed unexpectedly",
      remediation: "inspect generated/site output and smoke-check implementation",
    });

    const failedResult: ReleaseVerificationResult = {
      status: "failed",
      context,
      stages,
      siteDir,
      buildResult,
      pagesPlan,
      summary: "",
    };
    failedResult.summary = buildVerificationSummary(failedResult);
    return failedResult;
  }
  if (smokeChecks.status === "failed") {
    stages.push({
      key: "smoke-check",
      status: "failed",
      detail: formatSmokeCheckDetail(smokeChecks),
      remediation: smokeChecks.failedCheck?.remediation ?? "inspect generated/site output",
    });

    const failedResult: ReleaseVerificationResult = {
      status: "failed",
      context,
      stages,
      siteDir,
      buildResult,
      pagesPlan,
      smokeChecks,
      summary: "",
    };
    failedResult.summary = buildVerificationSummary(failedResult);
    return failedResult;
  }
  stages.push({
    key: "smoke-check",
    status: "passed",
    detail: formatSmokeCheckDetail(smokeChecks),
  });

  const passedResult: ReleaseVerificationResult = {
    status: "passed",
    context,
    stages,
    siteDir,
    buildResult,
    pagesPlan,
    smokeChecks,
    summary: "",
  };
  passedResult.summary = buildVerificationSummary(passedResult);
  return passedResult;
};
