import { describe, expect, test } from "bun:test";

import { type DeployWorkflowContext, formatDeployWorkflowContextSummary } from "./deploy-context";
import { createOpenLinksUpstreamState } from "./upstream-state";

describe("release-ops deploy-context summary", () => {
  test("includes the pinned upstream summary text for the current context", () => {
    // Arrange
    const context: DeployWorkflowContext = {
      mode: "nightly",
      useChangedPaths: false,
      upstreamState: createOpenLinksUpstreamState({
        repository: "pRizz/open-links",
        branch: "main",
        commit: "1234567890abcdef",
      }),
      summary: "",
    };

    // Act
    const summary = formatDeployWorkflowContextSummary(context);

    // Assert
    expect(summary).toContain("## Deploy Context");
    expect(summary).toContain("- Mode: `nightly`");
    expect(summary).toContain("- Strategy: nightly backstop deploy run");
    expect(summary).toContain("- Use changed paths: `false`");
    expect(summary).toContain("- Pinned upstream: `pRizz/open-links@1234567890ab`");
  });
});
