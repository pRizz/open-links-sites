import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { loadDefaultAssetPayloads, renderDefaultTemplates } from "./lib/fill-templates";
import { getPersonDirectory, isPersonId } from "./lib/person-contract";
import type { PersonValidationResult, ValidationRunResult } from "./lib/validation-output";
import { validateRepository } from "./validate";

export interface ScaffoldPersonInput {
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

export interface ScaffoldPersonResult {
  personId: string;
  personDirectory: string;
  validation: PersonValidationResult;
  validationRun: ValidationRunResult;
}

const parseArgs = (): ScaffoldPersonInput => {
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

export const scaffoldPerson = async (input: ScaffoldPersonInput): Promise<ScaffoldPersonResult> => {
  if (!isPersonId(input.personId)) {
    throw new Error(`Invalid person id '${input.personId}'. Use lowercase kebab-case.`);
  }

  const personDirectory = join(input.rootDir, getPersonDirectory(input.personId));
  if (existsSync(personDirectory)) {
    throw new Error(`Person directory already exists: ${personDirectory}`);
  }

  const renderedTemplates = renderDefaultTemplates({
    personId: input.personId,
    personName: input.personName,
    primaryLinkUrl: input.primaryLinkUrl,
    profileHeadline: input.profileHeadline,
    profileBio: input.profileBio,
    profileLocation: input.profileLocation,
    siteTitle: input.siteTitle,
    siteDescription: input.siteDescription,
  });

  mkdirSync(join(personDirectory, "assets"), { recursive: true });

  try {
    for (const [fileName, fileContents] of Object.entries(renderedTemplates)) {
      writeFileSync(join(personDirectory, fileName), `${fileContents}\n`, "utf8");
    }

    for (const [assetName, assetPayload] of Object.entries(loadDefaultAssetPayloads())) {
      writeFileSync(join(personDirectory, "assets", assetName), assetPayload);
    }

    const validation = await validateRepository(input.rootDir);
    const scaffoldedPerson = validation.people.find((person) => person.personId === input.personId);
    const blockingIssues =
      scaffoldedPerson?.issues.filter((issue) => issue.severity === "problem") ?? [];

    if (blockingIssues.length > 0) {
      throw new Error(
        `Scaffolded person failed validation: ${blockingIssues.map((issue) => issue.code).join(", ")}`,
      );
    }

    if (!scaffoldedPerson) {
      throw new Error(`Scaffolded person '${input.personId}' was not found during validation.`);
    }

    return {
      personId: input.personId,
      personDirectory,
      validation: scaffoldedPerson,
      validationRun: validation,
    };
  } catch (error) {
    rmSync(personDirectory, { recursive: true, force: true });
    throw error;
  }
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const result = await scaffoldPerson(args);

  process.stdout.write(
    `Scaffolded ${getPersonDirectory(result.personId)} with ${result.validation.issues.length} non-blocking issue(s).\n`,
  );
};

if (import.meta.main) {
  await main();
}
