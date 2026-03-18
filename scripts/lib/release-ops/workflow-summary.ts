export type WorkflowSummaryStageStatus = "passed" | "failed" | "skipped" | "no-op" | "changed";

export interface WorkflowSummaryStage {
  key: string;
  status: WorkflowSummaryStageStatus;
  detail?: string;
  remediation?: string;
}

export const formatWorkflowSummary = (
  title: string,
  overallStatus: string,
  metadata: Array<string | undefined>,
  stages: WorkflowSummaryStage[],
): string =>
  [
    `## ${title}`,
    `- Status: \`${overallStatus}\``,
    ...metadata.filter((entry): entry is string => Boolean(entry)),
    "### Stages",
    ...stages.flatMap((stage) =>
      [
        `- ${stage.key}: \`${stage.status}\`${stage.detail ? ` — ${stage.detail}` : ""}`,
        stage.remediation ? `- Next: ${stage.remediation}` : undefined,
      ].filter((entry): entry is string => Boolean(entry)),
    ),
  ].join("\n");
