import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { PersonValidationResult, ValidationIssue } from "../validation-output";
import {
  type ManagePersonActionResult,
  hasActionFlag,
  parseActionArgs,
  readSingleActionOption,
} from "./action-contract";
import { BlockingValidationError, runMutationSession } from "./mutation-session";
import { findPersonMatches, loadPersonRegistry } from "./person-registry";
import {
  type LoadedPersonDocuments,
  buildRequestedUpdateTasks,
  listSupportedUpdateTasks,
} from "./update-tasks";

interface UpdatePersonOptions {
  rootDir: string;
  personQuery: string;
  includeArchived: boolean;
  tasks: ReturnType<typeof buildRequestedUpdateTasks>;
}

const readJsonRecord = (filePath: string): Record<string, unknown> =>
  JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;

const writeJsonRecord = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const formatIssues = (issues: ValidationIssue[]): string[] =>
  issues.map(
    (issue) => `- (${issue.code}) ${issue.path ?? issue.file ?? issue.personId}: ${issue.message}`,
  );

const formatValidationSummary = (person: PersonValidationResult): string => {
  const warnings = person.issues.filter((issue) => issue.severity === "warning");
  const suggestions = person.issues.filter((issue) => issue.severity === "suggestion");
  const lines = [
    `Validation: 0 problems, ${warnings.length} warning(s), ${suggestions.length} suggestion(s).`,
  ];

  if (warnings.length > 0) {
    lines.push("Warnings:");
    lines.push(...formatIssues(warnings));
  }

  if (suggestions.length > 0) {
    lines.push("Suggestions:");
    lines.push(...formatIssues(suggestions));
  }

  return lines.join("\n");
};

const parseUpdatePersonOptions = (args: string[], rootDir: string): UpdatePersonOptions => {
  const parsedArgs = parseActionArgs(args);
  if (hasActionFlag(parsedArgs, "--help")) {
    throw new Error(
      [
        "Update one existing person through the managed CRUD surface.",
        "",
        "Required:",
        "  --person <id-or-name>      Select the target person.",
        "",
        "Task flags:",
        ...listSupportedUpdateTasks().map((task) => `  ${task}`),
      ].join("\n"),
    );
  }

  const personQuery = readSingleActionOption(parsedArgs, "--person");
  if (!personQuery) {
    throw new Error("update requires --person.");
  }

  const tasks = buildRequestedUpdateTasks(parsedArgs.options);
  if (tasks.length === 0) {
    throw new Error(
      "update requires at least one task flag. Try --headline, --bio, or --site-title.",
    );
  }

  return {
    rootDir,
    personQuery,
    includeArchived: hasActionFlag(parsedArgs, "--include-archived"),
    tasks,
  };
};

export const runUpdatePersonAction = async (
  args: string[],
  rootDir: string,
): Promise<ManagePersonActionResult> => {
  try {
    const options = parseUpdatePersonOptions(args, rootDir);
    const registry = await loadPersonRegistry(rootDir, {
      includeArchived: options.includeArchived,
    });
    const matches = findPersonMatches(registry, options.personQuery);

    if (matches.length === 0) {
      return {
        exitCode: 1,
        stderr: `No person matched '${options.personQuery}'.\n`,
      };
    }

    if (matches.length > 1) {
      return {
        exitCode: 1,
        stderr: [
          `Multiple people matched '${options.personQuery}'.`,
          ...matches.map((match) => `- ${match.id} (${match.displayName})`),
          "",
        ].join("\n"),
      };
    }

    const [match] = matches;
    const personPath = join(match.directoryPath, "person.json");
    const profilePath = join(match.directoryPath, "profile.json");
    const linksPath = join(match.directoryPath, "links.json");
    const sitePath = join(match.directoryPath, "site.json");
    const taskLabels = options.tasks.map((task) => task.label);

    const result = await runMutationSession({
      rootDir,
      personId: match.id,
      targetPaths: [personPath, profilePath, linksPath, sitePath],
      mutate() {
        const documents: LoadedPersonDocuments = {
          person: readJsonRecord(personPath),
          profile: readJsonRecord(profilePath),
          links: readJsonRecord(linksPath),
          site: readJsonRecord(sitePath),
        };

        for (const task of options.tasks) {
          task.apply(documents);
        }

        writeJsonRecord(personPath, documents.person);
        writeJsonRecord(profilePath, documents.profile);
        writeJsonRecord(linksPath, documents.links);
        writeJsonRecord(sitePath, documents.site);
      },
    });

    return {
      exitCode: 0,
      stdout: [
        `Updated ${match.id} (${match.displayName}).`,
        `Matched query: ${options.personQuery}`,
        `Applied tasks: ${taskLabels.join(", ")}`,
        formatValidationSummary(result.person),
        "",
      ].join("\n"),
    };
  } catch (error) {
    if (error instanceof BlockingValidationError) {
      return {
        exitCode: 1,
        stderr: [`${error.message}`, ...formatIssues(error.issues), ""].join("\n"),
      };
    }

    return {
      exitCode: 1,
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
};
