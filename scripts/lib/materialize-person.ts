import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { discoverPeople } from "./person-discovery";
import { GENERATED_ROOT, PERSON_REQUIRED_FILES, isLocalAssetReference } from "./person-contract";
import { validateDiscoveredPerson } from "./validate-person";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const translateLocalAssetReferences = (value: unknown, publicRoot: string): unknown => {
  if (typeof value === "string") {
    return isLocalAssetReference(value) ? pathToFileURL(join(publicRoot, value)).toString() : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => translateLocalAssetReferences(entry, publicRoot));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        translateLocalAssetReferences(entryValue, publicRoot),
      ]),
    );
  }

  return value;
};

export interface MaterializePersonInput {
  personId: string;
  rootDir: string;
}

export interface MaterializedWorkspace {
  personId: string;
  sourceDir: string;
  outputDir: string;
  dataDir: string;
  publicDir: string;
}

export const materializePerson = async (
  input: MaterializePersonInput,
): Promise<MaterializedWorkspace> => {
  const discoveredPeople = await discoverPeople(input.rootDir);
  const person = discoveredPeople.find((entry) => entry.directoryName === input.personId);

  if (!person) {
    throw new Error(`Could not find people/${input.personId}/person.json`);
  }

  const validation = await validateDiscoveredPerson(person);
  const blockingIssues = validation.issues.filter((issue) => issue.severity === "problem");
  if (blockingIssues.length > 0) {
    throw new Error(
      `Cannot materialize ${input.personId} because validation still has problems: ${blockingIssues
        .map((issue) => issue.code)
        .join(", ")}`,
    );
  }

  const outputDir = join(input.rootDir, GENERATED_ROOT, input.personId);
  const dataDir = join(outputDir, "data");
  const publicDir = join(outputDir, "public");

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });

  for (const fileName of PERSON_REQUIRED_FILES) {
    if (fileName === "person.json") {
      continue;
    }

    const sourcePath = join(person.directoryPath, fileName);
    const sourceValue = JSON.parse(readFileSync(sourcePath, "utf8")) as unknown;
    const materializedValue = translateLocalAssetReferences(sourceValue, publicDir);
    writeFileSync(join(dataDir, fileName), `${JSON.stringify(materializedValue, null, 2)}\n`, "utf8");
  }

  cpSync(join(person.directoryPath, "assets"), join(publicDir, "assets"), {
    recursive: true,
  });

  return {
    personId: input.personId,
    sourceDir: person.directoryPath,
    outputDir,
    dataDir,
    publicDir,
  };
};
