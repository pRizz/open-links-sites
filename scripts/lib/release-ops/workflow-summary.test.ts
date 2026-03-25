import { describe, expect, test } from "bun:test";

import { formatWorkflowSummary } from "./workflow-summary";

describe("workflow-summary", () => {
  test("renders title, status, and only defined metadata entries in order", () => {
    // Arrange
    const title = "Release Verify";
    const overallStatus = "passed";
    const metadata = [undefined, "- Pages changed: `true`", "- Mode: `nightly`"];

    // Act
    const summary = formatWorkflowSummary(title, overallStatus, metadata, []);

    // Assert
    expect(summary).toBe(
      [
        "## Release Verify",
        "- Status: `passed`",
        "- Pages changed: `true`",
        "- Mode: `nightly`",
        "### Stages",
      ].join("\n"),
    );
  });

  test("renders stage details inline and remediation on a follow-up line", () => {
    // Arrange
    const stages = [
      {
        key: "smoke-check",
        status: "failed" as const,
        detail: "representative route is missing for alice-example",
        remediation: "inspect generated/site/alice-example/index.html output",
      },
    ];

    // Act
    const summary = formatWorkflowSummary("Release Verify", "failed", [], stages);

    // Assert
    expect(summary).toContain(
      "- smoke-check: `failed` — representative route is missing for alice-example",
    );
    expect(summary).toContain("- Next: inspect generated/site/alice-example/index.html output");
  });
});
