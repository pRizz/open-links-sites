import path from "node:path";

import {
  type PagesDeployManifest,
  type PagesDeployManifestDiff,
  diffDeployManifests,
  ensureArtifactIntegrity,
  finalizePagesArtifact,
} from "./pages-artifact";

export interface PlanPagesDeploymentInput {
  siteDir: string;
  publicOrigin: string;
}

export interface PlanPagesDeploymentResult {
  artifactDir: string;
  artifactHash: string;
  changed: boolean;
  diff: PagesDeployManifestDiff;
  localManifest: PagesDeployManifest;
  maybeRemoteManifest: PagesDeployManifest | null;
}

export interface PlanPagesDeploymentDependencies {
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

const normalizeOrigin = (value: string): string => value.replace(/\/+$/u, "");

const loadRemoteManifest = async (
  publicOrigin: string,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<PagesDeployManifest | null> => {
  let response: Response;

  try {
    response = await fetchImpl(`${normalizeOrigin(publicOrigin)}/deploy-manifest.json`, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as PagesDeployManifest;
};

export const planPagesDeployment = async (
  input: PlanPagesDeploymentInput,
  dependencies: PlanPagesDeploymentDependencies = {},
): Promise<PlanPagesDeploymentResult> => {
  const fetchImpl = dependencies.fetch ?? ((input, init) => fetch(input, init));
  const artifactDir = path.resolve(input.siteDir);
  const localManifest = await finalizePagesArtifact(artifactDir, input.publicOrigin);
  await ensureArtifactIntegrity(artifactDir, localManifest);
  const maybeRemoteManifest = await loadRemoteManifest(input.publicOrigin, fetchImpl);
  const diff = diffDeployManifests(localManifest, maybeRemoteManifest);

  return {
    artifactDir,
    artifactHash: localManifest.artifactHash,
    changed: diff.changed,
    diff,
    localManifest,
    maybeRemoteManifest,
  };
};
