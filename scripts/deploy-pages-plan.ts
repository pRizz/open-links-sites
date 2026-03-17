import { appendFileSync } from "node:fs";
import process from "node:process";

import { getGeneratedSiteLayout } from "./lib/build/site-layout";
import { planPagesDeployment } from "./lib/deploy/pages-plan";

type OutputFormat = "human" | "json";

interface ParsedArgs {
  siteDir: string;
  publicOrigin: string;
  format: OutputFormat;
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
      : [
          `Changed: ${result.changed}`,
          `Artifact: ${result.artifactDir}`,
          `Artifact hash: ${result.artifactHash}`,
          `Uploads: ${result.diff.uploads.length}`,
          `Deletes: ${result.diff.deletes.length}`,
        ].join("\n");

  process.stdout.write(`${output}\n`);
};

if (import.meta.main) {
  await main();
}
