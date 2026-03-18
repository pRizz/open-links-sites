import { appendFileSync } from "node:fs";
import process from "node:process";

import { resolveDeployWorkflowContext } from "./lib/release-ops/deploy-context";

type OutputFormat = "human" | "json";

interface ParsedArgs {
  rootDir: string;
  eventName?: string;
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

  return {
    rootDir: readSingleFlag("--root") ?? process.cwd(),
    eventName: readSingleFlag("--event-name") ?? process.env.GITHUB_EVENT_NAME,
    format: readSingleFlag("--format") === "json" ? "json" : "human",
  };
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const context = resolveDeployWorkflowContext({
    rootDir: args.rootDir,
    eventName: args.eventName,
  });

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `${[
        `deploy_mode=${context.mode}`,
        `use_changed_paths=${context.useChangedPaths}`,
        `upstream_repository=${context.upstreamState.repository}`,
        `upstream_branch=${context.upstreamState.branch}`,
        `upstream_commit=${context.upstreamState.commit}`,
      ].join("\n")}\n`,
      "utf8",
    );
  }

  const output = args.format === "json" ? JSON.stringify(context, null, 2) : context.summary;
  process.stdout.write(`${output}\n`);
};

if (import.meta.main) {
  await main();
}
