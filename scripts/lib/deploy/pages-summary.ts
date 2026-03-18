import type { BuildSiteResult } from "../build/build-site";
import type { ExecuteBuildSelectionResult } from "../build/selective-build";
import { shortCommit } from "../release-ops/upstream-state";
import type { PlanPagesDeploymentResult } from "./pages-plan";

type BuildSummaryInput = BuildSiteResult | ExecuteBuildSelectionResult;

export interface PagesPlanSummaryContext {
  deployMode?: string;
  upstreamCommit?: string;
  upstreamRepository?: string;
}

export const formatBuildSummary = (result: BuildSummaryInput): string =>
  [
    "## Site Build",
    `- Mode: \`${result.mode}\``,
    `- Built people: \`${result.builtPersonIds.join(", ") || "none"}\``,
    `- Removed people: \`${result.removedPersonIds.join(", ") || "none"}\``,
    "selectionSummary" in result ? `- Selection: \`${result.selectionSummary}\`` : undefined,
    "fallbackReason" in result && result.fallbackReason
      ? `- Fallback: \`${result.fallbackReason}\``
      : undefined,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join("\n");

export const formatPagesPlanSummary = (
  result: PlanPagesDeploymentResult,
  context: PagesPlanSummaryContext = {},
): string =>
  [
    "## GitHub Pages",
    context.deployMode ? `- Trigger mode: \`${context.deployMode}\`` : undefined,
    context.upstreamCommit
      ? `- Pinned upstream: \`${context.upstreamRepository ?? "pRizz/open-links"}@${shortCommit(
          context.upstreamCommit,
        )}\``
      : undefined,
    `- Changed: \`${result.changed}\``,
    `- Artifact hash: \`${result.artifactHash}\``,
    `- Uploads: \`${result.diff.uploads.length}\``,
    `- Deletes: \`${result.diff.deletes.length}\``,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join("\n");
