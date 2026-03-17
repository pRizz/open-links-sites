import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

import { validateRepository } from "../../validate";
import type { PersonValidationResult, ValidationIssue } from "../validation-output";

export class BlockingValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(personId: string, issues: ValidationIssue[]) {
    super(
      `Restored prior state because '${personId}' introduced blocking validation issues: ${issues
        .map((issue) => issue.code)
        .join(", ")}`,
    );
    this.name = "BlockingValidationError";
    this.issues = issues;
  }
}

interface MutationSnapshot {
  targetPath: string;
  existed: boolean;
  snapshotPath: string;
}

export interface MutationSessionInput<Result> {
  rootDir: string;
  personId: string;
  targetPaths: string[];
  mutate(): Promise<Result> | Result;
}

export interface MutationSessionResult<Result> {
  result: Result;
  person: PersonValidationResult;
}

const captureSnapshot = (
  targetPath: string,
  backupRoot: string,
  index: number,
): MutationSnapshot => {
  const snapshotPath = join(backupRoot, String(index));
  const existed = existsSync(targetPath);

  if (existed) {
    mkdirSync(dirname(snapshotPath), { recursive: true });
    cpSync(targetPath, snapshotPath, { recursive: true });
  }

  return {
    targetPath,
    existed,
    snapshotPath,
  };
};

const restoreSnapshot = (snapshot: MutationSnapshot): void => {
  rmSync(snapshot.targetPath, { recursive: true, force: true });
  if (snapshot.existed) {
    mkdirSync(dirname(snapshot.targetPath), { recursive: true });
    cpSync(snapshot.snapshotPath, snapshot.targetPath, { recursive: true });
  }
};

const buildMissingPersonIssue = (rootDir: string, personId: string): ValidationIssue => ({
  severity: "problem",
  code: "mutated_person_missing_after_validation",
  message: `Could not find ${personId} in validation output after mutation.`,
  personId,
  path: relative(rootDir, join(rootDir, "people", personId)),
});

export const runMutationSession = async <Result>(
  input: MutationSessionInput<Result>,
): Promise<MutationSessionResult<Result>> => {
  const backupRoot = mkdtempSync(join(tmpdir(), "open-links-sites-mutation-"));
  const snapshots = [...new Set(input.targetPaths)].map((targetPath, index) =>
    captureSnapshot(targetPath, backupRoot, index),
  );
  let shouldRestore = true;

  try {
    const result = await input.mutate();
    const validation = await validateRepository(input.rootDir);
    const person =
      validation.people.find(
        (entry) => entry.personId === input.personId || entry.directoryName === input.personId,
      ) ?? null;
    const blockingIssues = person?.issues.filter((issue) => issue.severity === "problem") ?? [
      buildMissingPersonIssue(input.rootDir, input.personId),
    ];

    if (blockingIssues.length > 0) {
      for (const snapshot of [...snapshots].reverse()) {
        restoreSnapshot(snapshot);
      }
      shouldRestore = false;
      throw new BlockingValidationError(input.personId, blockingIssues);
    }

    return {
      result,
      person: person ?? {
        personId: input.personId,
        directoryName: input.personId,
        directoryPath: join(input.rootDir, "people", input.personId),
        enabled: null,
        issues: [],
      },
    };
  } catch (error) {
    if (shouldRestore) {
      for (const snapshot of [...snapshots].reverse()) {
        restoreSnapshot(snapshot);
      }
    }

    throw error;
  } finally {
    rmSync(backupRoot, { recursive: true, force: true });
  }
};
