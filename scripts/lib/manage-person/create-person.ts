import { join } from "node:path";

import { scaffoldPerson } from "../../scaffold-person";
import { getPersonDirectory } from "../person-contract";
import type { PersonValidationResult } from "../validation-output";
import {
  type ManagePersonActionResult,
  hasActionFlag,
  parseActionArgs,
  readSingleActionOption,
} from "./action-contract";

interface CreatePersonOptions {
  personId: string;
  personName: string;
  rootDir: string;
  seedUrl?: string;
}

const slugifyPersonId = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const formatValidationSummary = (person: PersonValidationResult): string => {
  const warnings = person.issues.filter((issue) => issue.severity === "warning");
  const suggestions = person.issues.filter((issue) => issue.severity === "suggestion");
  const lines = [
    `Validation: 0 problems, ${warnings.length} warning(s), ${suggestions.length} suggestion(s).`,
  ];

  if (warnings.length > 0) {
    lines.push("Warnings:");
    for (const issue of warnings) {
      lines.push(
        `- (${issue.code}) ${issue.path ?? issue.file ?? person.personId}: ${issue.message}`,
      );
    }
  }

  if (suggestions.length > 0) {
    lines.push("Suggestions:");
    for (const issue of suggestions) {
      lines.push(
        `- (${issue.code}) ${issue.path ?? issue.file ?? person.personId}: ${issue.message}`,
      );
    }
  }

  return lines.join("\n");
};

const parseCreatePersonOptions = (args: string[], rootDir: string): CreatePersonOptions => {
  const parsedArgs = parseActionArgs(args);

  if (hasActionFlag(parsedArgs, "--help")) {
    throw new Error(
      [
        "Create a new person with the managed CRUD surface.",
        "",
        'Required: --name "Alice Example"',
        "",
        "Optional:",
        "  --id <person-id>      Override the auto-generated slug.",
        "  --seed-url <url>      Save the initial source URL and placeholder link seed.",
      ].join("\n"),
    );
  }

  const personName = readSingleActionOption(parsedArgs, "--name");
  if (!personName) {
    throw new Error("create requires --name.");
  }

  const requestedId = readSingleActionOption(parsedArgs, "--id");
  const personId = requestedId ?? slugifyPersonId(personName);
  if (!personId) {
    throw new Error("Could not derive a stable person id from --name. Pass --id explicitly.");
  }

  return {
    personId,
    personName,
    rootDir,
    seedUrl: readSingleActionOption(parsedArgs, "--seed-url"),
  };
};

export const runCreatePersonAction = async (
  args: string[],
  rootDir: string,
): Promise<ManagePersonActionResult> => {
  try {
    const options = parseCreatePersonOptions(args, rootDir);
    const result = await scaffoldPerson({
      personId: options.personId,
      personName: options.personName,
      rootDir: options.rootDir,
      primaryLinkUrl: options.seedUrl,
    });

    return {
      exitCode: 0,
      stdout: [
        `Created ${options.personId} (${options.personName}).`,
        `Folder: ${getPersonDirectory(options.personId)}`,
        options.seedUrl ? `Seed URL: ${options.seedUrl}` : "Seed URL: none provided",
        formatValidationSummary(result.validation),
        "",
      ].join("\n"),
    };
  } catch (error) {
    return {
      exitCode: 1,
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
};
