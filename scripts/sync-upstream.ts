import { appendFileSync } from "node:fs";
import process from "node:process";

import { syncUpstreamState } from "./lib/release-ops/upstream-sync";

type OutputFormat = "human" | "json";

interface ParsedArgs {
  rootDir: string;
  upstreamRepoDir?: string;
  format: OutputFormat;
  writeState: boolean;
  syncedAt?: string;
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
    upstreamRepoDir: readSingleFlag("--upstream-repo-dir"),
    format: readSingleFlag("--format") === "json" ? "json" : "human",
    writeState: !args.includes("--dry-run"),
    syncedAt: readSingleFlag("--synced-at"),
  };
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const result = await syncUpstreamState({
    rootDir: args.rootDir,
    upstreamRepoDir: args.upstreamRepoDir,
    writeState: args.writeState,
    syncedAt: args.syncedAt,
  });

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `${[
        `sync_result=${result.result}`,
        `sync_changed=${result.changed}`,
        `sync_state_written=${result.wroteState}`,
        `sync_verification_required=${result.verificationRequired}`,
        `sync_state_path=${result.statePath}`,
        `sync_tracked_commit=${result.trackedState?.commit ?? ""}`,
        `sync_latest_commit=${result.latestState?.commit ?? ""}`,
      ].join("\n")}\n`,
      "utf8",
    );
  }

  const output = args.format === "json" ? JSON.stringify(result, null, 2) : result.summary;
  process.stdout.write(`${output}\n`);

  if (result.result === "blocked") {
    process.exitCode = 1;
  }
};

if (import.meta.main) {
  await main();
}
