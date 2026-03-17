import process from "node:process";

import {
  type BuildSelection,
  detectBuildSelection,
  formatBuildSelectionHuman,
  loadChangedPaths,
} from "./lib/build/change-detection";

type OutputFormat = "human" | "json";

interface ParsedArgs {
  baseRef?: string;
  changedPaths: string[];
  changedPathsFile?: string;
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
    baseRef: readSingleFlag("--base-ref"),
    changedPaths: readMultiFlag("--changed-path"),
    changedPathsFile: readSingleFlag("--changed-paths-file"),
    format: readSingleFlag("--format") === "json" ? "json" : "human",
  };
};

export const resolveBuildSelection = (args: ParsedArgs): BuildSelection =>
  detectBuildSelection(
    loadChangedPaths({
      baseRef: args.baseRef,
      changedPaths: args.changedPaths,
      changedPathsFile: args.changedPathsFile,
    }),
  );

const main = async (): Promise<void> => {
  const args = parseArgs();
  const selection = resolveBuildSelection(args);
  const output =
    args.format === "json"
      ? JSON.stringify(selection, null, 2)
      : formatBuildSelectionHuman(selection);

  process.stdout.write(`${output}\n`);
};

if (import.meta.main) {
  await main();
}
