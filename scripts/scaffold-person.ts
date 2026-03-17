import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { renderDefaultTemplates, loadDefaultAssetPayloads } from "./lib/fill-templates";
import { getPersonDirectory, isPersonId, resolveRepoPath } from "./lib/person-contract";
import { validateRepository } from "./validate";

interface ParsedArgs {
  personId: string;
  personName: string;
  rootDir: string;
  primaryLinkUrl?: string;
  profileHeadline?: string;
  profileBio?: string;
  profileLocation?: string;
  siteTitle?: string;
  siteDescription?: string;
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
  const personName = getFlagValue("--name");
  if (!personId || !personName) {
    throw new Error("scaffold-person requires --id and --name.");
  }

  return {
    personId,
    personName,
    rootDir: getFlagValue("--root") ?? process.cwd(),
    primaryLinkUrl: getFlagValue("--link-url"),
    profileHeadline: getFlagValue("--headline"),
    profileBio: getFlagValue("--bio"),
    profileLocation: getFlagValue("--location"),
    siteTitle: getFlagValue("--site-title"),
    siteDescription: getFlagValue("--site-description"),
  };
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  if (!isPersonId(args.personId)) {
    throw new Error(`Invalid person id '${args.personId}'. Use lowercase kebab-case.`);
  }

  const personDirectory = join(args.rootDir, getPersonDirectory(args.personId));
  if (existsSync(personDirectory)) {
    throw new Error(`Person directory already exists: ${personDirectory}`);
  }

  const renderedTemplates = renderDefaultTemplates({
    personId: args.personId,
    personName: args.personName,
    primaryLinkUrl: args.primaryLinkUrl,
    profileHeadline: args.profileHeadline,
    profileBio: args.profileBio,
    profileLocation: args.profileLocation,
    siteTitle: args.siteTitle,
    siteDescription: args.siteDescription,
  });

  mkdirSync(join(personDirectory, "assets"), { recursive: true });

  try {
    for (const [fileName, fileContents] of Object.entries(renderedTemplates)) {
      writeFileSync(join(personDirectory, fileName), `${fileContents}\n`, "utf8");
    }

    for (const [assetName, assetPayload] of Object.entries(loadDefaultAssetPayloads())) {
      writeFileSync(join(personDirectory, "assets", assetName), assetPayload);
    }

    const validation = await validateRepository(args.rootDir);
    const scaffoldedPerson = validation.people.find((person) => person.personId === args.personId);
    const blockingIssues =
      scaffoldedPerson?.issues.filter((issue) => issue.severity === "problem") ?? [];

    if (blockingIssues.length > 0) {
      throw new Error(
        `Scaffolded person failed validation: ${blockingIssues.map((issue) => issue.code).join(", ")}`,
      );
    }

    process.stdout.write(
      `Scaffolded ${getPersonDirectory(args.personId)} with ${scaffoldedPerson?.issues.length ?? 0} non-blocking issue(s).\n`,
    );
  } catch (error) {
    rmSync(personDirectory, { recursive: true, force: true });
    throw error;
  }
};

if (import.meta.main) {
  await main();
}
