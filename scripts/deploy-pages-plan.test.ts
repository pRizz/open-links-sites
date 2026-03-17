import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { planPagesDeployment } from "./lib/deploy/pages-plan";

const tempDirs: string[] = [];

const createTempSiteDir = (): string => {
  const siteDir = mkdtempSync(join(tmpdir(), "open-links-sites-pages-"));
  tempDirs.push(siteDir);
  return siteDir;
};

afterEach(() => {
  for (const siteDir of tempDirs.splice(0)) {
    rmSync(siteDir, { recursive: true, force: true });
  }
});

describe("deploy-pages-plan", () => {
  test("writes deploy metadata and reports changed when no remote manifest exists", async () => {
    const siteDir = createTempSiteDir();
    writeFileSync(join(siteDir, "index.html"), "<html></html>\n", "utf8");
    mkdirSync(join(siteDir, "landing-assets"), { recursive: true });
    writeFileSync(join(siteDir, "landing-assets", "landing.js"), "console.log('landing');\n");

    const result = await planPagesDeployment(
      {
        siteDir,
        publicOrigin: "https://example.com/open-links-sites",
      },
      {
        fetch: async () => new Response(null, { status: 404 }),
      },
    );

    expect(result.changed).toBe(true);
    expect(readFileSync(join(siteDir, ".nojekyll"), "utf8")).toBe("");
    expect(readFileSync(join(siteDir, "deploy-manifest.json"), "utf8")).toContain('"version": 1');
  });

  test("reports a no-op when the remote manifest already matches", async () => {
    const siteDir = createTempSiteDir();
    writeFileSync(join(siteDir, "index.html"), "<html></html>\n", "utf8");

    const firstPlan = await planPagesDeployment(
      {
        siteDir,
        publicOrigin: "https://example.com/open-links-sites",
      },
      {
        fetch: async () => new Response(null, { status: 404 }),
      },
    );

    const secondPlan = await planPagesDeployment(
      {
        siteDir,
        publicOrigin: "https://example.com/open-links-sites",
      },
      {
        fetch: async () =>
          new Response(JSON.stringify(firstPlan.localManifest), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }),
      },
    );

    expect(secondPlan.changed).toBe(false);
    expect(secondPlan.diff.uploads).toHaveLength(0);
    expect(secondPlan.diff.deletes).toHaveLength(0);
  });
});
