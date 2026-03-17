import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import process from "node:process";

import { resolveRepoPath } from "../person-contract";
import { getGeneratedSiteLayout } from "./site-layout";

export interface BuildLandingPageInput {
  rootDir: string;
}

export interface BuildLandingPageResult {
  siteDir: string;
}

export const buildLandingPage = async (
  input: BuildLandingPageInput,
): Promise<BuildLandingPageResult> => {
  const layout = getGeneratedSiteLayout(input.rootDir);
  rmSync(layout.landingAssetsDir, { recursive: true, force: true });
  rmSync(`${layout.siteDir}/index.html`, { force: true });
  mkdirSync(layout.siteDir, { recursive: true });

  const result = spawnSync(
    "bunx",
    [
      "vite",
      "build",
      "--config",
      resolveRepoPath("vite.landing.config.ts"),
      "--outDir",
      layout.siteDir,
    ],
    {
      cwd: resolveRepoPath("."),
      encoding: "utf8",
      env: process.env,
    },
  );

  const stdout = result.stdout?.trim();
  const stderr = result.stderr?.trim();

  if (result.status !== 0) {
    const details = [stderr, stdout].filter(Boolean).join("\n");
    throw new Error(
      details
        ? `Landing page build failed (${result.status}).\n${details}`
        : `Landing page build failed (${result.status}).`,
    );
  }

  const renderedLandingPath = `${layout.siteDir}/landing.html`;
  if (existsSync(renderedLandingPath)) {
    renameSync(renderedLandingPath, `${layout.siteDir}/index.html`);
  }

  return {
    siteDir: layout.siteDir,
  };
};
