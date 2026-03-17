import { describe, expect, test } from "bun:test";

import { detectBuildSelection } from "./lib/build/change-detection";

describe("changed-people", () => {
  test("person-only changes stay targeted and include helper artifacts", () => {
    const selection = detectBuildSelection([
      "people/alice-example/profile.json",
      "people/alice-example/cache/rich-public-cache.json",
    ]);

    expect(selection.mode).toBe("targeted");
    expect(selection.personIds).toEqual(["alice-example"]);
  });

  test("shared scripts widen to a full rebuild", () => {
    const selection = detectBuildSelection(["scripts/build-site.ts"]);

    expect(selection.mode).toBe("full");
    expect(selection.reasons).toContain("scripts/build-site.ts");
  });

  test("docs-only changes do not trigger a site rebuild", () => {
    const selection = detectBuildSelection(["README.md", ".planning/STATE.md"]);

    expect(selection.mode).toBe("none");
    expect(selection.ignoredPaths).toEqual(["README.md", ".planning/STATE.md"]);
  });

  test("uncertain paths fail open to a full rebuild", () => {
    const selection = detectBuildSelection(["mystery.txt"]);

    expect(selection.mode).toBe("full");
    expect(selection.reasons).toContain("uncertain:mystery.txt");
  });
});
