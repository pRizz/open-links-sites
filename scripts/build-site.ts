import process from "node:process";

import { buildSite } from "./lib/build/build-site";
import { detectBuildSelection, loadChangedPaths } from "./lib/build/change-detection";
import { executeBuildSelection } from "./lib/build/selective-build";

interface ParsedArgs {
  rootDir: string;
  personIds?: string[];
  preserveExisting: boolean;
  removePersonIds: string[];
  includeLandingPage: boolean;
  changedPaths: string[];
  changedPathsFile?: string;
  baseRef?: string;
  publicOrigin?: string;
}

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2);

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

  const readSingleFlag = (name: string): string | undefined => {
    const values = readMultiFlag(name);
    return values.at(-1);
  };

  const personIds = readMultiFlag("--person");

  return {
    rootDir: readSingleFlag("--root") ?? process.cwd(),
    personIds: personIds.length > 0 ? personIds : undefined,
    preserveExisting: args.includes("--preserve-existing"),
    removePersonIds: readMultiFlag("--remove-person"),
    includeLandingPage: !args.includes("--skip-landing"),
    changedPaths: readMultiFlag("--changed-path"),
    changedPathsFile: readSingleFlag("--changed-paths-file"),
    baseRef: readSingleFlag("--base-ref"),
    publicOrigin: readSingleFlag("--public-origin"),
  };
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const hasSelectionInput =
    args.changedPaths.length > 0 ||
    args.changedPathsFile !== undefined ||
    args.baseRef !== undefined;
  const result = hasSelectionInput
    ? await executeBuildSelection({
        rootDir: args.rootDir,
        publicOrigin: args.publicOrigin,
        selection: detectBuildSelection(
          loadChangedPaths({
            baseRef: args.baseRef,
            changedPaths: args.changedPaths,
            changedPathsFile: args.changedPathsFile,
          }),
        ),
      })
    : await buildSite({
        rootDir: args.rootDir,
        personIds: args.personIds,
        preserveExisting: args.preserveExisting,
        removePersonIds: args.removePersonIds,
        includeLandingPage: args.includeLandingPage,
      });

  process.stdout.write(
    [
      `Build mode: ${result.mode}`,
      `Built people: ${result.builtPersonIds.join(", ") || "none"}`,
      `Removed people: ${result.removedPersonIds.join(", ") || "none"}`,
      "selectionSummary" in result ? `Selection: ${result.selectionSummary}` : undefined,
      "fallbackReason" in result && result.fallbackReason
        ? `Fallback: ${result.fallbackReason}`
        : undefined,
      `Output: ${result.siteDir}`,
      "",
    ]
      .filter((entry): entry is string => Boolean(entry))
      .join("\n"),
  );
};

if (import.meta.main) {
  await main();
}
