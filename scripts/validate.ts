import process from "node:process";

import { validateExternalOpenLinksRepository } from "./lib/landing/external-openlinks";
import { loadPersonRegistry } from "./lib/manage-person/person-registry";
import { resolveRepoPath } from "./lib/person-contract";
import { discoverPeople } from "./lib/person-discovery";
import { validateDiscoveredPerson } from "./lib/validate-person";
import {
  type ValidationRunResult,
  buildValidationTotals,
  formatValidationRunHuman,
  formatValidationRunJson,
} from "./lib/validation-output";

type OutputFormat = "human" | "json";

interface ParsedArgs {
  format: OutputFormat;
  rootDir: string;
}

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2);

  const getFlagValue = (name: string): string | undefined => {
    const index = args.indexOf(name);
    if (index < 0) {
      return undefined;
    }

    return args[index + 1];
  };

  const format = getFlagValue("--format") === "json" ? "json" : "human";
  const rootDir = getFlagValue("--root") ?? process.cwd();

  return {
    format,
    rootDir,
  };
};

export const validateRepository = async (
  rootDir = resolveRepoPath("."),
): Promise<ValidationRunResult> => {
  const people = await discoverPeople(rootDir);
  const results = await Promise.all(people.map((person) => validateDiscoveredPerson(person)));
  const localRegistry = await loadPersonRegistry(rootDir, {
    includeArchived: true,
  });
  const repositoryIssues = validateExternalOpenLinksRepository({
    rootDir,
    localIds: localRegistry.map((entry) => entry.id),
  });
  const totals = buildValidationTotals(results, repositoryIssues);

  return {
    valid: totals.problems === 0,
    people: results,
    repositoryIssues,
    totals,
  };
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const result = await validateRepository(args.rootDir);
  const output =
    args.format === "json" ? formatValidationRunJson(result) : formatValidationRunHuman(result);

  process.stdout.write(`${output}\n`);
  process.exitCode = result.valid ? 0 : 1;
};

if (import.meta.main) {
  await main();
}
