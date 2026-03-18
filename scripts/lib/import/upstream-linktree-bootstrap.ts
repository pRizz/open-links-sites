import { spawnSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";

import type { UpstreamLinktreeBootstrapResult } from "./linktree-intake";
import { resolveOpenLinksRepoDir } from "./upstream-open-links-runner";

export const runUpstreamLinktreeBootstrap = async (
  sourceUrl: string,
): Promise<UpstreamLinktreeBootstrapResult> => {
  const repoDir = resolveOpenLinksRepoDir();
  const result = spawnSync(
    process.execPath,
    ["run", join(repoDir, "scripts", "bootstrap-linktree.ts"), "--url", sourceUrl],
    {
      cwd: repoDir,
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    const details = result.stderr?.trim() || result.stdout?.trim() || "Unknown failure.";
    throw new Error(`Upstream Linktree bootstrap extraction failed. ${details}`);
  }

  const stdout = result.stdout?.trim();
  if (!stdout) {
    throw new Error("Upstream Linktree bootstrap extraction returned no JSON output.");
  }

  try {
    return JSON.parse(stdout) as UpstreamLinktreeBootstrapResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Upstream Linktree bootstrap extraction returned invalid JSON. ${message}`);
  }
};
