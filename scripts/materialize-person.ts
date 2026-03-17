import process from "node:process";

import { materializePerson } from "./lib/materialize-person";

interface ParsedArgs {
  personId: string;
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

  const personId = getFlagValue("--id");
  if (!personId) {
    throw new Error("materialize-person requires --id.");
  }

  return {
    personId,
    rootDir: getFlagValue("--root") ?? process.cwd(),
  };
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const result = await materializePerson({
    personId: args.personId,
    rootDir: args.rootDir,
  });

  process.stdout.write(
    `Materialized ${result.personId} into ${result.outputDir} from ${result.sourceDir}.\n`,
  );
};

if (import.meta.main) {
  await main();
}
