import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { ImportSourceKind } from "./contracts";
import type { UpstreamRunnerStep } from "./upstream-open-links-runner";

export type ImportOutcome = "success" | "partial" | "failed";

export interface ImportStageRecord {
  stage: "source-intake" | "source-write" | "upstream" | "cache-sync";
  status: "applied" | "partial" | "failed" | "skipped";
  summary: string;
  blocking: boolean;
}

export interface ImportRunReport {
  generatedAt: string;
  personId: string;
  created: boolean;
  fullRefresh: boolean;
  source: {
    kind: ImportSourceKind;
    url?: string;
  };
  outcome: ImportOutcome;
  exitCode: number;
  usefulImportWritten: boolean;
  applied: {
    profileFields: string[];
    addedLinkIds: string[];
    addedProfileLinks: string[];
    skippedDuplicateUrls: string[];
    replacedBootstrapLinks: boolean;
  };
  stages: ImportStageRecord[];
  upstreamSteps: UpstreamRunnerStep[];
  remediation: string[];
}

export interface BuildImportRunReportInput {
  generatedAt: string;
  personId: string;
  created: boolean;
  fullRefresh: boolean;
  sourceKind: ImportSourceKind;
  sourceUrl?: string;
  usefulImportWritten: boolean;
  applied: ImportRunReport["applied"];
  upstreamSteps?: UpstreamRunnerStep[];
  stageFailure?: string;
  remediation: string[];
}

const summarizeUpstreamStep = (step: UpstreamRunnerStep): ImportStageRecord => {
  if (step.status === "skipped") {
    return {
      stage: "upstream",
      status: "skipped",
      summary: `${step.key} skipped${step.reason ? `: ${step.reason}` : ""}.`,
      blocking: false,
    };
  }

  if (step.status === "failed") {
    return {
      stage: "upstream",
      status: "failed",
      summary: `${step.key} failed${step.stderr ? `: ${step.stderr}` : ""}.`,
      blocking: true,
    };
  }

  return {
    stage: "upstream",
    status: "applied",
    summary: `${step.key} completed.`,
    blocking: false,
  };
};

export const buildImportRunReport = (input: BuildImportRunReportInput): ImportRunReport => {
  const upstreamSteps = input.upstreamSteps ?? [];
  const stages: ImportStageRecord[] = [
    {
      stage: "source-intake",
      status: input.stageFailure === "source-intake" ? "failed" : "applied",
      summary:
        input.stageFailure === "source-intake"
          ? "Source intake failed before useful data could be written."
          : "Source intake completed.",
      blocking: input.stageFailure === "source-intake",
    },
    {
      stage: "source-write",
      status:
        input.usefulImportWritten || input.applied.addedLinkIds.length > 0
          ? "applied"
          : input.stageFailure === "source-write"
            ? "failed"
            : "skipped",
      summary:
        input.usefulImportWritten || input.applied.addedLinkIds.length > 0
          ? "Imported source data was written to the repo."
          : input.stageFailure === "source-write"
            ? "Source write failed validation."
            : "No source changes were written.",
      blocking: input.stageFailure === "source-write",
    },
    ...upstreamSteps.map(summarizeUpstreamStep),
    {
      stage: "cache-sync",
      status:
        upstreamSteps.some((step) => step.status === "failed") ||
        input.stageFailure === "cache-sync"
          ? "failed"
          : upstreamSteps.length > 0
            ? "applied"
            : "skipped",
      summary:
        upstreamSteps.length === 0
          ? "Cache sync did not run."
          : upstreamSteps.some((step) => step.status === "failed") ||
              input.stageFailure === "cache-sync"
            ? "Cache sync did not complete."
            : "Per-person cache artifacts were synchronized back into the repo.",
      blocking:
        upstreamSteps.some((step) => step.status === "failed") ||
        input.stageFailure === "cache-sync",
    },
  ];

  const hasBlockingFailure = stages.some((stage) => stage.status === "failed" && stage.blocking);
  const hasPartialSignals =
    !hasBlockingFailure &&
    (input.applied.skippedDuplicateUrls.length > 0 ||
      upstreamSteps.some((step) => step.status === "skipped"));
  const outcome: ImportOutcome = hasBlockingFailure
    ? input.usefulImportWritten
      ? "partial"
      : "failed"
    : hasPartialSignals
      ? "partial"
      : "success";

  return {
    generatedAt: input.generatedAt,
    personId: input.personId,
    created: input.created,
    fullRefresh: input.fullRefresh,
    source: {
      kind: input.sourceKind,
      url: input.sourceUrl,
    },
    outcome,
    exitCode: hasBlockingFailure ? 1 : 0,
    usefulImportWritten: input.usefulImportWritten,
    applied: input.applied,
    stages,
    upstreamSteps,
    remediation: input.remediation,
  };
};

export const writeImportRunReport = (filePath: string, report: ImportRunReport): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
};
