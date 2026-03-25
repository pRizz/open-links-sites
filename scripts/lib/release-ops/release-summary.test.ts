import { describe, expect, test } from "bun:test";

import { formatStageSummary } from "./release-summary";

describe("release-summary", () => {
  test("keeps the title before all defined entries", () => {
    // Arrange
    const title = "## Deploy Context";
    const entries = ["- Mode: `nightly`", "- Use changed paths: `false`"];

    // Act
    const summary = formatStageSummary(title, entries);

    // Assert
    expect(summary).toBe(
      ["## Deploy Context", "- Mode: `nightly`", "- Use changed paths: `false`"].join("\n"),
    );
  });

  test("filters undefined entries from the final summary", () => {
    // Arrange
    const title = "## Deploy Context";
    const entries = [undefined, "- Pinned upstream: `pRizz/open-links@1234567`", undefined];

    // Act
    const summary = formatStageSummary(title, entries);

    // Assert
    expect(summary).toBe(
      ["## Deploy Context", "- Pinned upstream: `pRizz/open-links@1234567`"].join("\n"),
    );
  });
});
