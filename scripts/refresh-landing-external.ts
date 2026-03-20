import process from "node:process";

import { refreshExternalOpenLinks } from "./lib/landing/refresh-external-openlinks";

const parseRootDir = (): string => {
  const args = process.argv.slice(2);
  const rootFlagIndex = args.indexOf("--root");
  if (rootFlagIndex < 0) {
    return process.cwd();
  }

  return args[rootFlagIndex + 1] ?? process.cwd();
};

const main = async (): Promise<void> => {
  const result = await refreshExternalOpenLinks({
    rootDir: parseRootDir(),
  });

  process.stdout.write(`${result.summary}\n`);
  if (result.status === "failed") {
    process.exitCode = 1;
  }
};

if (import.meta.main) {
  await main();
}
