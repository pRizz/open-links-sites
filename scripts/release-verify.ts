import { appendFileSync } from "node:fs";
import process from "node:process";

import { runReleaseVerification } from "./lib/release-ops/release-verify";

type OutputFormat = "human" | "json";

interface ParsedArgs {
  rootDir: string;
  publicOrigin: string;
  canonicalOrigin?: string;
  eventName?: string;
  changedPaths: string[];
  changedPathsFile?: string;
  baseRef?: string;
  format: OutputFormat;
}

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2);

  const readSingleFlag = (name: string): string | undefined => {
    const index = args.indexOf(name);
    if (index < 0) {
      return undefined;
    }

    return args[index + 1];
  };

  const readMultiFlag = (name: string): string[] => {
    const values: string[] = [];

    for (let index = 0; index < args.length; index += 1) {
      if (args[index] === name) {
        const value = args[index + 1];
        if (value) {
          values.push(value);
        }
      }
    }

    return values;
  };

  return {
    rootDir: readSingleFlag("--root") ?? process.cwd(),
    publicOrigin:
      readSingleFlag("--public-origin") ??
      process.env.OPEN_LINKS_SITES_PUBLIC_ORIGIN ??
      (() => {
        const [owner = "prizz", repository = "open-links-sites"] =
          process.env.GITHUB_REPOSITORY?.split("/") ?? [];
        return `https://${owner}.github.io/${repository}`;
      })(),
    canonicalOrigin:
      readSingleFlag("--canonical-origin") ??
      process.env.OPEN_LINKS_SITES_CANONICAL_ORIGIN ??
      undefined,
    eventName: readSingleFlag("--event-name") ?? process.env.GITHUB_EVENT_NAME,
    changedPaths: readMultiFlag("--changed-path"),
    changedPathsFile: readSingleFlag("--changed-paths-file"),
    baseRef: readSingleFlag("--base-ref"),
    format: readSingleFlag("--format") === "json" ? "json" : "human",
  };
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const result = await runReleaseVerification({
    rootDir: args.rootDir,
    publicOrigin: args.publicOrigin,
    canonicalOrigin: args.canonicalOrigin,
    eventName: args.eventName,
    changedPaths: args.changedPaths,
    changedPathsFile: args.changedPathsFile,
    baseRef: args.baseRef,
  });

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `${[
        `release_verify_status=${result.status}`,
        `pages_changed=${result.pagesPlan?.changed ?? false}`,
        `pages_artifact_hash=${result.pagesPlan?.artifactHash ?? ""}`,
        `pages_artifact_dir=${result.pagesPlan?.artifactDir ?? ""}`,
        `build_mode=${result.buildResult?.mode ?? ""}`,
      ].join("\n")}\n`,
      "utf8",
    );
  }

  const output = args.format === "json" ? JSON.stringify(result, null, 2) : result.summary;
  process.stdout.write(`${output}\n`);

  if (result.status === "failed") {
    process.exitCode = 1;
  }
};

if (import.meta.main) {
  await main();
}
