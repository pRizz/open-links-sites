import { readFileSync } from "node:fs";

import { discoverPeople } from "../person-discovery";

export type PersonLifecycleStatus = "active" | "disabled" | "archived";

export interface RegisteredPerson {
  id: string;
  displayName: string;
  enabled: boolean;
  lifecycleStatus: PersonLifecycleStatus;
  hiddenByDefault: boolean;
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
}

export interface LoadPersonRegistryOptions {
  includeArchived?: boolean;
}

type PersonManifest = {
  id?: unknown;
  displayName?: unknown;
  enabled?: unknown;
  lifecycle?: {
    status?: unknown;
  };
};

const normalizeSearchText = (value: string): string =>
  value.trim().toLowerCase().replaceAll(/\s+/gu, " ");

const inferLifecycleStatus = (manifest: PersonManifest): PersonLifecycleStatus => {
  const lifecycleStatus = manifest.lifecycle?.status;
  if (lifecycleStatus === "archived") {
    return "archived";
  }

  if (lifecycleStatus === "disabled") {
    return "disabled";
  }

  return manifest.enabled === false ? "disabled" : "active";
};

export const loadPersonRegistry = async (
  rootDir: string,
  options: LoadPersonRegistryOptions = {},
): Promise<RegisteredPerson[]> => {
  const discoveredPeople = await discoverPeople(rootDir);
  const registry: RegisteredPerson[] = [];

  for (const person of discoveredPeople) {
    const manifest = JSON.parse(readFileSync(person.manifestPath, "utf8")) as PersonManifest;
    if (typeof manifest.id !== "string" || typeof manifest.displayName !== "string") {
      continue;
    }

    const lifecycleStatus = inferLifecycleStatus(manifest);
    if (lifecycleStatus === "archived" && options.includeArchived !== true) {
      continue;
    }

    registry.push({
      id: manifest.id,
      displayName: manifest.displayName,
      enabled: manifest.enabled !== false,
      lifecycleStatus,
      hiddenByDefault: lifecycleStatus === "archived",
      directoryName: person.directoryName,
      directoryPath: person.directoryPath,
      manifestPath: person.manifestPath,
    });
  }

  return registry.sort((left, right) => left.displayName.localeCompare(right.displayName));
};

export const findPersonMatches = (
  registry: RegisteredPerson[],
  query: string,
): RegisteredPerson[] => {
  const normalizedQuery = normalizeSearchText(query);
  const exactIdMatches = registry.filter(
    (person) => normalizeSearchText(person.id) === normalizedQuery,
  );
  if (exactIdMatches.length > 0) {
    return exactIdMatches;
  }

  const exactNameMatches = registry.filter(
    (person) => normalizeSearchText(person.displayName) === normalizedQuery,
  );
  if (exactNameMatches.length > 0) {
    return exactNameMatches;
  }

  return registry.filter((person) => {
    const id = normalizeSearchText(person.id);
    const displayName = normalizeSearchText(person.displayName);

    return id.includes(normalizedQuery) || displayName.includes(normalizedQuery);
  });
};
