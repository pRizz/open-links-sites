import { describe, expect, test } from "bun:test";

import {
  buildRefreshPeopleCachesHelpText,
  parseRefreshPeopleCachesInvocation,
} from "./refresh-people-caches";

describe("refresh-people-caches CLI", () => {
  test("parses one selector and rejects missing or conflicting selectors", () => {
    expect(parseRefreshPeopleCachesInvocation(["--all"], "/repo")).toEqual({
      rootDir: "/repo",
      personQuery: undefined,
      refreshAll: true,
      showHelp: false,
      usageError: undefined,
    });

    expect(parseRefreshPeopleCachesInvocation(["--person", "alice-example"], "/repo")).toEqual({
      rootDir: "/repo",
      personQuery: "alice-example",
      refreshAll: false,
      showHelp: false,
      usageError: undefined,
    });

    expect(
      parseRefreshPeopleCachesInvocation(["--person", "alice-example", "--all"], "/repo")
        .usageError,
    ).toBe("Choose exactly one selector: --person or --all.");
    expect(parseRefreshPeopleCachesInvocation([], "/repo").usageError).toBe(
      "Choose exactly one selector: --person or --all.",
    );
  });

  test("prints a concise operator help surface", () => {
    const helpText = buildRefreshPeopleCachesHelpText();

    expect(helpText).toContain("bun run refresh:people:caches");
    expect(helpText).toContain("--person <query>");
    expect(helpText).toContain("--all");
  });
});
