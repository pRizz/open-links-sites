import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";

import { getGeneratedSiteLayout } from "./site-layout";

interface RemoteDeployManifestFile {
  path: string;
}

interface RemoteDeployManifest {
  files: RemoteDeployManifestFile[];
}

export interface RestoreLiveSiteInput {
  rootDir: string;
  publicOrigin: string;
}

export interface RestoreLiveSiteResult {
  fileCount: number;
  publicOrigin: string;
  siteDir: string;
}

export interface RestoreLiveSiteDependencies {
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

const normalizeOrigin = (value: string): string => value.replace(/\/+$/u, "");

const validateRelativePath = (value: string): string => {
  const normalized = posix.normalize(value).replace(/^\/+/u, "");
  if (normalized.length === 0 || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Invalid deploy-manifest path '${value}'.`);
  }

  return normalized;
};

export const restoreLiveSite = async (
  input: RestoreLiveSiteInput,
  dependencies: RestoreLiveSiteDependencies = {},
): Promise<RestoreLiveSiteResult> => {
  const fetchImpl = dependencies.fetch ?? ((input, init) => fetch(input, init));
  const publicOrigin = normalizeOrigin(input.publicOrigin);
  const layout = getGeneratedSiteLayout(input.rootDir);
  const manifestResponse = await fetchImpl(`${publicOrigin}/deploy-manifest.json`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!manifestResponse.ok) {
    throw new Error(
      `Could not load remote deploy-manifest.json from ${publicOrigin} (${manifestResponse.status}).`,
    );
  }

  const manifest = (await manifestResponse.json()) as RemoteDeployManifest;
  rmSync(layout.siteDir, { recursive: true, force: true });
  mkdirSync(layout.siteDir, { recursive: true });

  await Promise.all(
    manifest.files.map(async (file) => {
      const relativePath = validateRelativePath(file.path);
      const response = await fetchImpl(`${publicOrigin}/${relativePath}`);
      if (!response.ok) {
        throw new Error(
          `Could not restore ${relativePath} from ${publicOrigin} (${response.status}).`,
        );
      }

      const targetPath = join(layout.siteDir, relativePath);
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, Buffer.from(await response.arrayBuffer()));
    }),
  );

  return {
    fileCount: manifest.files.length,
    publicOrigin,
    siteDir: layout.siteDir,
  };
};
