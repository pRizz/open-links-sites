import { access, readdir } from "node:fs/promises";
import { join } from "node:path";

import { PEOPLE_ROOT, PERSON_METADATA_FILE } from "./person-contract";

export interface DiscoveredPerson {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
}

type Utf8Dirent = {
  name: string;
  isDirectory(): boolean;
};

export const discoverPeople = async (rootDir: string): Promise<DiscoveredPerson[]> => {
  const peopleRoot = join(rootDir, PEOPLE_ROOT);

  let entries: Utf8Dirent[];
  try {
    entries = (await readdir(peopleRoot, {
      encoding: "utf8",
      withFileTypes: true,
    })) as unknown as Utf8Dirent[];
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const discovered: DiscoveredPerson[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directoryPath = join(peopleRoot, entry.name);
    const manifestPath = join(directoryPath, PERSON_METADATA_FILE);

    try {
      await access(manifestPath);
    } catch {
      continue;
    }

    discovered.push({
      directoryName: entry.name,
      directoryPath,
      manifestPath,
    });
  }

  return discovered;
};
