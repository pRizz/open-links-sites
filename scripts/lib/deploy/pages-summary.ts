import type { BuildSiteResult } from "../build/build-site";
import type { ExecuteBuildSelectionResult } from "../build/selective-build";
import type { PlanPagesDeploymentResult } from "./pages-plan";

type BuildSummaryInput = BuildSiteResult | ExecuteBuildSelectionResult;

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

export const formatPagesPlanSummary = (result: PlanPagesDeploymentResult): string =>
  [
    "## GitHub Pages",
    `- Changed: \`${result.changed}\``,
    `- Artifact hash: \`${result.artifactHash}\``,
    `- Uploads: \`${result.diff.uploads.length}\``,
    `- Deletes: \`${result.diff.deletes.length}\``,
  ].join("\n");
