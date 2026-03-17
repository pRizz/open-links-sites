import process from "node:process";

import { buildPersonSite } from "./lib/build/build-person-site";

interface ParsedArgs {
  personId: string;
  rootDir: string;
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

  const personId = readFlag("--id");
  if (!personId) {
    throw new Error("build-person-site requires --id.");
  }

  return {
    personId,
    rootDir: readFlag("--root") ?? process.cwd(),
  };
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const result = await buildPersonSite({
    rootDir: args.rootDir,
    personId: args.personId,
  });

  process.stdout.write(
    `Built ${result.personId} into ${result.outputDir} from ${result.workspaceDir}.\n`,
  );
};

if (import.meta.main) {
  await main();
}
