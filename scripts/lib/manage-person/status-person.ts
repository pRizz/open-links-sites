import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { PersonValidationResult, ValidationIssue } from "../validation-output";
import {
  type ManagePersonAction,
  type ManagePersonActionResult,
  hasActionFlag,
  parseActionArgs,
  readSingleActionOption,
} from "./action-contract";
import { BlockingValidationError, runMutationSession } from "./mutation-session";
import type { PersonLifecycleStatus } from "./person-registry";
import { findPersonMatches, loadPersonRegistry } from "./person-registry";

type SupportedStatusAction = Extract<ManagePersonAction, "disable" | "archive">;

interface StatusActionDefinition {
  action: SupportedStatusAction;
  lifecycleStatus: PersonLifecycleStatus;
  summaryVerb: string;
}

interface StatusPersonOptions {
  personQuery: string;
  includeArchived: boolean;
  reason?: string;
}

type PersonManifest = {
  enabled?: unknown;
  lifecycle?: unknown;
};

const STATUS_ACTION_DEFINITIONS: Record<SupportedStatusAction, StatusActionDefinition> = {
  disable: {
    action: "disable",
    lifecycleStatus: "disabled",
    summaryVerb: "Disabled",
  },
  archive: {
    action: "archive",
    lifecycleStatus: "archived",
    summaryVerb: "Archived",
  },
};

const readJsonRecord = (filePath: string): Record<string, unknown> =>
  JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;

const writeJsonRecord = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const ensureRecord = (value: unknown, context: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${context} to be an object.`);
  }

  return value as Record<string, unknown>;
};

const resolveLifecycleRecord = (manifest: Record<string, unknown>): Record<string, unknown> => {
  const lifecycle = manifest.lifecycle;
  if (lifecycle === undefined) {
    const created: Record<string, unknown> = {};
    manifest.lifecycle = created;
    return created;
  }

  return ensureRecord(lifecycle, "person.lifecycle");
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

const parseStatusPersonOptions = (
  action: SupportedStatusAction,
  args: string[],
): StatusPersonOptions => {
  const parsedArgs = parseActionArgs(args);
  if (hasActionFlag(parsedArgs, "--help")) {
    throw new Error(
      [
        `${STATUS_ACTION_DEFINITIONS[action].summaryVerb} a person without deleting source data.`,
        "",
        "Required:",
        "  --person <id-or-name>      Select the target person.",
        "  --confirm                  Explicitly confirm the status change.",
        "",
        "Optional:",
        "  --reason <text>           Record the operator reason in person.lifecycle.reason.",
        "  --include-archived        Search archived people explicitly.",
      ].join("\n"),
    );
  }

  const personQuery = readSingleActionOption(parsedArgs, "--person");
  if (!personQuery) {
    throw new Error(`${action} requires --person.`);
  }

  if (!hasActionFlag(parsedArgs, "--confirm")) {
    throw new Error(`${action} requires --confirm before writing metadata.`);
  }

  return {
    personQuery,
    includeArchived: hasActionFlag(parsedArgs, "--include-archived"),
    reason: readSingleActionOption(parsedArgs, "--reason"),
  };
};

const inferLifecycleStatus = (manifest: PersonManifest): PersonLifecycleStatus => {
  const lifecycleRecord =
    typeof manifest.lifecycle === "object" &&
    manifest.lifecycle !== null &&
    !Array.isArray(manifest.lifecycle)
      ? (manifest.lifecycle as { status?: unknown })
      : undefined;

  if (lifecycleRecord?.status === "archived") {
    return "archived";
  }

  if (lifecycleRecord?.status === "disabled") {
    return "disabled";
  }

  return manifest.enabled === false ? "disabled" : "active";
};

export const runStatusPersonAction = async (
  action: SupportedStatusAction,
  args: string[],
  rootDir: string,
): Promise<ManagePersonActionResult> => {
  try {
    const options = parseStatusPersonOptions(action, args);
    const definition = STATUS_ACTION_DEFINITIONS[action];
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
    const currentManifest = readJsonRecord(personPath) as PersonManifest;
    const currentStatus = inferLifecycleStatus(currentManifest);

    if (currentStatus === definition.lifecycleStatus) {
      return {
        exitCode: 1,
        stderr: `${match.id} is already ${definition.lifecycleStatus}.\n`,
      };
    }

    if (currentStatus === "archived" && action === "disable") {
      return {
        exitCode: 1,
        stderr: `Cannot disable archived person '${match.id}'. Archived entries stay hidden until explicitly reactivated in a later phase.\n`,
      };
    }

    const changedAt = new Date().toISOString();
    const result = await runMutationSession({
      rootDir,
      personId: match.id,
      targetPaths: [personPath],
      mutate() {
        const manifest = readJsonRecord(personPath);
        manifest.enabled = false;

        const lifecycle = resolveLifecycleRecord(manifest);
        lifecycle.status = definition.lifecycleStatus;
        lifecycle.changedAt = changedAt;

        if (definition.lifecycleStatus === "disabled") {
          lifecycle.disabledAt = changedAt;
          lifecycle.archivedAt = undefined;
        } else {
          lifecycle.archivedAt = changedAt;
        }

        if (options.reason) {
          lifecycle.reason = options.reason;
        }

        writeJsonRecord(personPath, manifest);
      },
    });

    return {
      exitCode: 0,
      stdout: [
        `${definition.summaryVerb} ${match.id} (${match.displayName}).`,
        `Matched query: ${options.personQuery}`,
        `Lifecycle status: ${definition.lifecycleStatus}`,
        options.reason ? `Reason: ${options.reason}` : "Reason: none recorded",
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
