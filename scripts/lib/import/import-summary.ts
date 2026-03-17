import type { ImportRunReport } from "./import-run-report";

export const buildImportSummary = (report: ImportRunReport): string => {
  const lines: string[] = [];
  const outcomeLabel =
    report.outcome === "success"
      ? "Import complete"
      : report.outcome === "partial"
        ? "Import partial"
        : "Import failed";

  lines.push(`${outcomeLabel}: ${report.personId}.`);
  lines.push(`Created: ${report.created ? "yes" : "no"}`);
  lines.push(`Source: ${report.source.kind}${report.source.url ? ` (${report.source.url})` : ""}`);
  lines.push(
    `Applied imports: ${report.applied.profileFields.length} profile field(s), ${report.applied.addedLinkIds.length} new link(s), ${report.applied.addedProfileLinks.length} profile link(s).`,
  );

  if (report.applied.replacedBootstrapLinks) {
    lines.push("Applied imports replaced the placeholder scaffold links.");
  }

  if (report.applied.skippedDuplicateUrls.length > 0) {
    lines.push("Skipped duplicates:");
    for (const duplicateUrl of report.applied.skippedDuplicateUrls) {
      lines.push(`- ${duplicateUrl}`);
    }
  }

  const skippedSteps = report.upstreamSteps.filter((step) => step.status === "skipped");
  if (skippedSteps.length > 0) {
    lines.push("Skipped upstream steps:");
    for (const step of skippedSteps) {
      lines.push(`- ${step.key}: ${step.reason ?? "no reason provided"}`);
    }
  }

  const failedSteps = report.upstreamSteps.filter((step) => step.status === "failed");
  if (failedSteps.length > 0) {
    lines.push("Blocking upstream failures:");
    for (const step of failedSteps) {
      lines.push(`- ${step.key}: ${step.stderr ?? step.stdout ?? "command failed"}`);
    }
  }

  if (report.remediation.length > 0) {
    lines.push("Remediation:");
    for (const remediation of report.remediation) {
      lines.push(`- ${remediation}`);
    }
  }

  return `${lines.join("\n")}\n`;
};
