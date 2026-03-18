import { appendFileSync } from "node:fs";
import process from "node:process";

import { getGeneratedSiteLayout } from "./lib/build/site-layout";
import { planPagesDeployment } from "./lib/deploy/pages-plan";
import { formatPagesPlanSummary } from "./lib/deploy/pages-summary";

type OutputFormat = "human" | "json";

interface ParsedArgs {
  siteDir: string;
  publicOrigin: string;
  format: OutputFormat;
  deployMode?: string;
  upstreamCommit?: string;
  upstreamRepository?: string;
}

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2);

  const readFlag = (name: string): string | undefined => {
    const index = args.indexOf(name);
    if (index < 0) {
      return undefined;
    }

    return args[index + 1];
  };

  const siteDir = readFlag("--site-dir") ?? getGeneratedSiteLayout(process.cwd()).siteDir;
  const publicOrigin =
    readFlag("--public-origin") ??
    process.env.OPEN_LINKS_SITES_PUBLIC_ORIGIN ??
    (() => {
      const [owner = "prizz", repository = "open-links-sites"] =
        process.env.GITHUB_REPOSITORY?.split("/") ?? [];
      return `https://${owner}.github.io/${repository}`;
    })();

  return {
    siteDir,
    publicOrigin,
    format: readFlag("--format") === "json" ? "json" : "human",
    deployMode: readFlag("--deploy-mode"),
    upstreamCommit: readFlag("--upstream-commit"),
    upstreamRepository: readFlag("--upstream-repository"),
  };
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const result = await planPagesDeployment({
    siteDir: args.siteDir,
    publicOrigin: args.publicOrigin,
  });

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `pages_changed=${result.changed}\npages_artifact_hash=${result.artifactHash}\npages_artifact_dir=${result.artifactDir}\n`,
      "utf8",
    );
  }

  const output =
    args.format === "json"
      ? JSON.stringify(result, null, 2)
      : formatPagesPlanSummary(result, {
          deployMode: args.deployMode,
          upstreamCommit: args.upstreamCommit,
          upstreamRepository: args.upstreamRepository,
        });

  process.stdout.write(`${output}\n`);
};

if (import.meta.main) {
  await main();
}
