import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import addFormats from "ajv-formats";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";

import personSchema from "../../schemas/person.schema.json";
import linksSchema from "../../schemas/upstream/links.schema.json";
import profileSchema from "../../schemas/upstream/profile.schema.json";
import siteSchema from "../../schemas/upstream/site.schema.json";
import type { DiscoveredPerson } from "./person-discovery";
import {
  PERSON_REQUIRED_DIRECTORIES,
  PERSON_REQUIRED_FILES,
  folderMatchesPersonId,
  isLocalAssetReference,
  looksLikeLocalAssetPath,
  normalizeLocalAssetToUri,
} from "./person-contract";
import type { PersonValidationResult, ValidationIssue } from "./validation-output";

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});

addFormats(ajv);

const personValidator = ajv.compile(personSchema);
const profileValidator = ajv.compile(profileSchema);
const linksValidator = ajv.compile(linksSchema);
const siteValidator = ajv.compile(siteSchema);

type PersonManifest = {
  id?: unknown;
  enabled?: unknown;
};

type JsonReadResult = {
  value?: unknown;
  issue?: ValidationIssue;
};

const REQUIRED_SCHEMA_FILES = {
  "person.json": personValidator,
  "profile.json": profileValidator,
  "links.json": linksValidator,
  "site.json": siteValidator,
} satisfies Record<string, ValidateFunction>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const formatIssuePath = (fileName: string, instancePath: string, missingProperty?: string): string => {
  const normalizedSegments = instancePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .join(".");

  const base = normalizedSegments.length > 0 ? `${fileName}.${normalizedSegments}` : fileName;
  return missingProperty ? `${base}.${missingProperty}` : base;
};

const toValidationIssue = (
  personId: string,
  fileName: string,
  error: ErrorObject,
): ValidationIssue => {
  const missingProperty =
    error.keyword === "required" && typeof error.params.missingProperty === "string"
      ? error.params.missingProperty
      : undefined;

  return {
    severity: "problem",
    code: `schema_${error.keyword}`,
    message: error.message ?? "Schema validation failed.",
    personId,
    file: fileName,
    path: formatIssuePath(fileName, error.instancePath, missingProperty),
  };
};

const tryReadJson = (personId: string, filePath: string, fileName: string): JsonReadResult => {
  try {
    return {
      value: JSON.parse(readFileSync(filePath, "utf8")) as unknown,
    };
  } catch (error: unknown) {
    return {
      issue: {
        severity: "problem",
        code: "invalid_json",
        message: `Could not parse JSON: ${error instanceof Error ? error.message : String(error)}`,
        personId,
        file: fileName,
        path: fileName,
      },
    };
  }
};

const normalizeForSchemaValidation = (value: unknown): unknown => {
  if (typeof value === "string") {
    return isLocalAssetReference(value) ? normalizeLocalAssetToUri(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForSchemaValidation(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, normalizeForSchemaValidation(entryValue)]),
    );
  }

  return value;
};

const collectStringEntries = (
  value: unknown,
  fileName: string,
  path = fileName,
): Array<{ path: string; value: string }> => {
  if (typeof value === "string") {
    return [{ path, value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectStringEntries(entry, fileName, `${path}.${index}`));
  }

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, entryValue]) =>
      collectStringEntries(entryValue, fileName, `${path}.${key}`),
    );
  }

  return [];
};

const collectPlaceholderIssues = (
  personId: string,
  fileName: string,
  stringPath: string,
  value: string,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (value.includes("TODO:")) {
    issues.push({
      severity: "warning",
      code: "placeholder_todo",
      message: "Placeholder text is still present.",
      personId,
      file: fileName,
      path: stringPath,
    });
    issues.push({
      severity: "suggestion",
      code: "replace_placeholder_text",
      message: `Replace ${stringPath} with the person's real content before publish.`,
      personId,
      file: fileName,
      path: stringPath,
    });
  }

  if (value.includes("example.com")) {
    issues.push({
      severity: "warning",
      code: "placeholder_example_url",
      message: "Example URL is still present.",
      personId,
      file: fileName,
      path: stringPath,
    });
    issues.push({
      severity: "suggestion",
      code: "replace_example_url",
      message: `Replace ${stringPath} with a real public URL.`,
      personId,
      file: fileName,
      path: stringPath,
    });
  }

  if (value.includes("avatar-placeholder")) {
    issues.push({
      severity: "warning",
      code: "placeholder_avatar",
      message: "Default placeholder avatar is still in use.",
      personId,
      file: fileName,
      path: stringPath,
    });
    issues.push({
      severity: "suggestion",
      code: "replace_placeholder_avatar",
      message: "Add a real avatar asset under assets/ and update profile.avatar if needed.",
      personId,
      file: fileName,
      path: stringPath,
    });
  }

  if (value === "placeholder") {
    issues.push({
      severity: "warning",
      code: "placeholder_marker",
      message: "Placeholder marker is still present.",
      personId,
      file: fileName,
      path: stringPath,
    });
  }

  return issues;
};

const validateSchema = (
  personId: string,
  fileName: keyof typeof REQUIRED_SCHEMA_FILES,
  value: unknown,
): ValidationIssue[] => {
  const validator = REQUIRED_SCHEMA_FILES[fileName];
  const normalizedValue = fileName === "person.json" ? value : normalizeForSchemaValidation(value);
  const valid = validator(normalizedValue);

  if (valid) {
    return [];
  }

  return (validator.errors ?? []).map((error) => toValidationIssue(personId, fileName, error));
};

const validateStringPaths = (
  personId: string,
  personDirectoryPath: string,
  fileName: string,
  value: unknown,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  for (const stringEntry of collectStringEntries(value, fileName)) {
    if (looksLikeLocalAssetPath(stringEntry.value) && !isLocalAssetReference(stringEntry.value)) {
      issues.push({
        severity: "problem",
        code: "asset_reference_outside_person_assets",
        message: "Local asset references must stay inside assets/ using a relative path.",
        personId,
        file: fileName,
        path: stringEntry.path,
      });
      continue;
    }

    if (isLocalAssetReference(stringEntry.value)) {
      const absoluteAssetPath = join(personDirectoryPath, stringEntry.value);
      if (!existsSync(absoluteAssetPath)) {
        issues.push({
          severity: "problem",
          code: "missing_asset_file",
          message: `Referenced asset does not exist: ${stringEntry.value}`,
          personId,
          file: fileName,
          path: stringEntry.path,
        });
      }
    }

    issues.push(...collectPlaceholderIssues(personId, fileName, stringEntry.path, stringEntry.value));
  }

  return issues;
};

export const validateDiscoveredPerson = async (
  person: DiscoveredPerson,
): Promise<PersonValidationResult> => {
  const issues: ValidationIssue[] = [];
  const knownValues = new Map<string, unknown>();

  for (const requiredDirectory of PERSON_REQUIRED_DIRECTORIES) {
    if (!existsSync(join(person.directoryPath, requiredDirectory))) {
      issues.push({
        severity: "problem",
        code: "missing_required_directory",
        message: `Missing required directory: ${requiredDirectory}`,
        personId: person.directoryName,
        path: requiredDirectory,
      });
    }
  }

  for (const requiredFile of PERSON_REQUIRED_FILES) {
    const filePath = join(person.directoryPath, requiredFile);
    if (!existsSync(filePath)) {
      issues.push({
        severity: "problem",
        code: "missing_required_file",
        message: `Missing required file: ${requiredFile}`,
        personId: person.directoryName,
        file: requiredFile,
        path: requiredFile,
      });
      continue;
    }

    const jsonResult = tryReadJson(person.directoryName, filePath, requiredFile);
    if (jsonResult.issue) {
      issues.push(jsonResult.issue);
      continue;
    }

    knownValues.set(requiredFile, jsonResult.value);
  }

  const personManifest = (knownValues.get("person.json") ?? {}) as PersonManifest;
  const personId =
    typeof personManifest.id === "string" && personManifest.id.length > 0
      ? personManifest.id
      : person.directoryName;
  const enabled = typeof personManifest.enabled === "boolean" ? personManifest.enabled : null;

  if (typeof personManifest.id === "string" && !folderMatchesPersonId(person.directoryName, personManifest.id)) {
    issues.push({
      severity: "problem",
      code: "person_id_folder_mismatch",
      message: `Folder name '${person.directoryName}' must match person.id '${personManifest.id}'.`,
      personId,
      file: "person.json",
      path: "person.json.id",
    });
  }

  for (const [fileName, value] of knownValues.entries()) {
    if (!Object.hasOwn(REQUIRED_SCHEMA_FILES, fileName)) {
      continue;
    }

    issues.push(
      ...validateSchema(personId, fileName as keyof typeof REQUIRED_SCHEMA_FILES, value),
      ...validateStringPaths(personId, person.directoryPath, fileName, value),
    );
  }

  return {
    personId,
    directoryName: person.directoryName,
    directoryPath: person.directoryPath,
    enabled,
    issues,
  };
};
