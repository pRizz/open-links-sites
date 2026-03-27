import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { scaffoldPerson } from "../../scaffold-person";
import { getPersonHelperLayout } from "../import/cache-layout";
import { syncWorkspaceCacheToPerson } from "../import/cache-sync";
import { type ImportIntakeDependencies, runImportIntake } from "../import/import-intake";
import { buildImportRunReport, writeImportRunReport } from "../import/import-run-report";
import { buildImportSummary } from "../import/import-summary";
import {
  type MergeImportedPersonResult,
  mergeImportedPerson,
} from "../import/merge-imported-person";
import {
  type UpstreamRunnerResult,
  runUpstreamOpenLinks,
} from "../import/upstream-open-links-runner";
import { materializePerson } from "../materialize-person";
import { getPersonDirectory } from "../person-contract";
import type { PersonValidationResult, ValidationIssue } from "../validation-output";
import {
  type ManagePersonActionResult,
  hasActionFlag,
  parseActionArgs,
  readSingleActionOption,
} from "./action-contract";
import { BlockingValidationError, runMutationSession } from "./mutation-session";
import { findPersonMatches, loadPersonRegistry } from "./person-registry";

interface ImportPersonOptions {
  rootDir: string;
  personQuery?: string;
  includeArchived: boolean;
  sourceUrl?: string;
  manualLinksText?: string;
  requestedName?: string;
  requestedId?: string;
  fullRefresh: boolean;
}

export interface ImportPersonDependencies {
  importIntake?: ImportIntakeDependencies;
  materializePerson?: typeof materializePerson;
  runUpstreamOpenLinks?: (input: {
    workspace: Awaited<ReturnType<typeof materializePerson>>["layout"];
    fullRefresh: boolean;
    syncFollowerHistory?: boolean;
  }) => Promise<UpstreamRunnerResult>;
  syncWorkspaceCacheToPerson?: typeof syncWorkspaceCacheToPerson;
  nowIso?: () => string;
}

type TargetPerson = {
  id: string;
  displayName: string;
  directoryPath: string;
};

const readJsonRecord = (filePath: string): Record<string, unknown> =>
  JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;

const writeJsonRecord = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const slugifyPersonId = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-");

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

const hasMeaningfulImportSeed = (input: {
  linksCount: number;
  profile: {
    headline?: string;
    bio?: string;
    avatar?: string;
    location?: string;
    profileLinks: Array<unknown>;
  };
}): boolean =>
  input.linksCount > 0 ||
  typeof input.profile.headline === "string" ||
  typeof input.profile.bio === "string" ||
  typeof input.profile.avatar === "string" ||
  typeof input.profile.location === "string" ||
  input.profile.profileLinks.length > 0;

const parseImportPersonOptions = (args: string[], rootDir: string): ImportPersonOptions => {
  const parsedArgs = parseActionArgs(args);
  if (hasActionFlag(parsedArgs, "--help")) {
    throw new Error(
      [
        "Import or bootstrap a person from a Linktree URL or pasted manual links.",
        "",
        "Input:",
        "  --source-url <url>        Bootstrap from a Linktree URL via the upstream extractor.",
        "  --manual-links <text>     Paste a freeform list of URLs or labeled lines.",
        "",
        "Targeting:",
        "  --person <id-or-name>     Import into an existing person.",
        "  --name <display-name>     Required when creating from manual links.",
        "  --id <person-id>          Override the derived id when creating a new person.",
        "",
        "Optional:",
        "  --include-archived        Search archived people explicitly.",
        "  --full-refresh            Force upstream cache refresh after import.",
      ].join("\n"),
    );
  }

  return {
    rootDir,
    personQuery: readSingleActionOption(parsedArgs, "--person"),
    includeArchived: hasActionFlag(parsedArgs, "--include-archived"),
    sourceUrl: readSingleActionOption(parsedArgs, "--source-url"),
    manualLinksText: readSingleActionOption(parsedArgs, "--manual-links"),
    requestedName: readSingleActionOption(parsedArgs, "--name"),
    requestedId: readSingleActionOption(parsedArgs, "--id"),
    fullRefresh: hasActionFlag(parsedArgs, "--full-refresh"),
  };
};

const ensureTargetPerson = async (
  options: ImportPersonOptions,
): Promise<{ target: TargetPerson | null; registryIds: Set<string> }> => {
  const registry = await loadPersonRegistry(options.rootDir, {
    includeArchived: options.includeArchived,
  });
  const registryIds = new Set(registry.map((person) => person.id));

  if (!options.personQuery) {
    return {
      target: null,
      registryIds,
    };
  }

  const matches = findPersonMatches(registry, options.personQuery);
  if (matches.length === 0) {
    throw new Error(`No person matched '${options.personQuery}'.`);
  }

  if (matches.length > 1) {
    throw new Error(
      [
        `Multiple people matched '${options.personQuery}'.`,
        ...matches.map((match) => `- ${match.id} (${match.displayName})`),
      ].join("\n"),
    );
  }

  const [match] = matches;
  return {
    target: {
      id: match.id,
      displayName: match.displayName,
      directoryPath: match.directoryPath,
    },
    registryIds,
  };
};

export const runImportPersonAction = async (
  args: string[],
  rootDir: string,
  dependencies: ImportPersonDependencies = {},
): Promise<ManagePersonActionResult> => {
  let createdTarget: TargetPerson | null = null;
  let target: TargetPerson | null = null;
  let sourceWriteSucceeded = false;

  try {
    const options = parseImportPersonOptions(args, rootDir);
    const targetResolution = await ensureTargetPerson(options);
    target = targetResolution.target;
    const importIntake = await runImportIntake(
      {
        sourceUrl: options.sourceUrl,
        manualLinksText: options.manualLinksText,
      },
      dependencies.importIntake,
    );

    if (
      !target &&
      !hasMeaningfulImportSeed({
        linksCount: importIntake.links.length,
        profile: importIntake.profile,
      })
    ) {
      return {
        exitCode: 1,
        stderr:
          "Import did not extract enough non-placeholder data to bootstrap a new person. Provide --name with --manual-links, or improve the source extractor and rerun.\n",
      };
    }

    if (!target) {
      const displayName = options.requestedName ?? importIntake.profile.name;
      if (!displayName) {
        return {
          exitCode: 1,
          stderr: "Could not infer a person name from the import source. Pass --name explicitly.\n",
        };
      }

      const personId = options.requestedId ?? slugifyPersonId(displayName);
      if (!personId) {
        return {
          exitCode: 1,
          stderr: "Could not derive a stable person id. Pass --id explicitly.\n",
        };
      }

      if (targetResolution.registryIds.has(personId)) {
        return {
          exitCode: 1,
          stderr: `Person '${personId}' already exists. Use --person to import into the existing record.\n`,
        };
      }

      const primaryLinkUrl = importIntake.links[0]?.url ?? importIntake.sourceUrl;
      await scaffoldPerson({
        personId,
        personName: displayName,
        rootDir,
        primaryLinkUrl,
      });

      createdTarget = {
        id: personId,
        displayName,
        directoryPath: join(rootDir, getPersonDirectory(personId)),
      };
      target = createdTarget;
    }

    const importedAt = (dependencies.nowIso ?? (() => new Date().toISOString()))();
    const personPath = join(target.directoryPath, "person.json");
    const profilePath = join(target.directoryPath, "profile.json");
    const linksPath = join(target.directoryPath, "links.json");
    const sitePath = join(target.directoryPath, "site.json");
    let mergeResult: MergeImportedPersonResult | null = null;

    const mutationResult = await runMutationSession({
      rootDir,
      personId: target.id,
      targetPaths: [personPath, profilePath, linksPath, sitePath],
      mutate() {
        const documents = {
          person: readJsonRecord(personPath),
          profile: readJsonRecord(profilePath),
          links: readJsonRecord(linksPath),
          site: readJsonRecord(sitePath),
        };

        mergeResult = mergeImportedPerson({
          documents,
          intake: importIntake,
          importedAt,
        });

        writeJsonRecord(personPath, documents.person);
        writeJsonRecord(profilePath, documents.profile);
        writeJsonRecord(linksPath, documents.links);
        writeJsonRecord(sitePath, documents.site);
      },
    });
    sourceWriteSucceeded = true;

    const helperLayout = getPersonHelperLayout(rootDir, target.id);
    mkdirSync(helperLayout.importsDir, { recursive: true });
    writeJsonRecord(helperLayout.files.sourceSnapshot, {
      generatedAt: importedAt,
      ...importIntake.snapshot,
    });

    const workspace = await (dependencies.materializePerson ?? materializePerson)({
      personId: target.id,
      rootDir,
    });
    const upstreamResult = await (dependencies.runUpstreamOpenLinks ?? runUpstreamOpenLinks)({
      workspace: workspace.layout,
      fullRefresh: options.fullRefresh,
      syncFollowerHistory: false,
    });
    const cacheSyncResult = (dependencies.syncWorkspaceCacheToPerson ?? syncWorkspaceCacheToPerson)(
      {
        rootDir,
        personId: target.id,
      },
    );
    const resolvedMergeResult: MergeImportedPersonResult = mergeResult ?? {
      appliedProfileFields: [],
      addedLinkIds: [],
      addedProfileLinks: [],
      skippedDuplicateUrls: [],
      replacedBootstrapLinks: false,
      changed: false,
    };

    const report = buildImportRunReport({
      generatedAt: importedAt,
      personId: target.id,
      created: createdTarget !== null,
      fullRefresh: options.fullRefresh,
      sourceKind: importIntake.kind,
      sourceUrl: importIntake.sourceUrl,
      usefulImportWritten:
        resolvedMergeResult.appliedProfileFields.length > 0 ||
        resolvedMergeResult.addedLinkIds.length > 0 ||
        resolvedMergeResult.addedProfileLinks.length > 0,
      applied: {
        profileFields: resolvedMergeResult.appliedProfileFields,
        addedLinkIds: resolvedMergeResult.addedLinkIds,
        addedProfileLinks: resolvedMergeResult.addedProfileLinks,
        skippedDuplicateUrls: resolvedMergeResult.skippedDuplicateUrls,
        replacedBootstrapLinks: resolvedMergeResult.replacedBootstrapLinks,
      },
      upstreamSteps: upstreamResult.steps,
      remediation: [
        ...importIntake.warnings,
        ...(upstreamResult.blockingFailure
          ? [`Fix upstream step '${upstreamResult.blockingFailure.key}' and rerun the import.`]
          : []),
        ...(options.fullRefresh
          ? []
          : ["Use --full-refresh to force a fresh upstream cache rebuild on the next rerun."]),
        ...(cacheSyncResult.copiedPaths.length === 0
          ? ["No stable cache artifacts changed during this run."]
          : []),
      ],
    });
    writeImportRunReport(helperLayout.files.lastImportReport, report);
    const summary = buildImportSummary(report);

    if (report.exitCode === 0) {
      return {
        exitCode: 0,
        stdout: [
          summary.trimEnd(),
          formatValidationSummary(mutationResult.person),
          `Report: ${helperLayout.files.lastImportReport}`,
          "",
        ].join("\n"),
      };
    }

    return {
      exitCode: report.exitCode,
      stdout: [
        summary.trimEnd(),
        formatValidationSummary(mutationResult.person),
        `Report: ${helperLayout.files.lastImportReport}`,
        "",
      ].join("\n"),
      stderr: `Import retained useful source data for '${target.id}', but a blocking upstream step failed.\n`,
    };
  } catch (error) {
    if (!sourceWriteSucceeded && createdTarget) {
      rmSync(createdTarget.directoryPath, { recursive: true, force: true });
      rmSync(join(rootDir, "generated", createdTarget.id), { recursive: true, force: true });
    }

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
