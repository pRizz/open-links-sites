import { mkdirSync, rmSync } from "node:fs";

import { loadPersonRegistry } from "../manage-person/person-registry";
import { materializePerson } from "../materialize-person";
import { resolveStableBuildTimestamp } from "./build-timestamp";
import { getGeneratedPersonSiteDir } from "./site-layout";
import {
  type UpstreamWorkspaceSiteBuildInput,
  runUpstreamWorkspaceSiteBuild,
} from "./upstream-site-builder";

export interface BuildPersonSiteInput {
  rootDir: string;
  personId: string;
  outputDir?: string;
  buildTimestamp?: string;
}

export interface BuildPersonSiteResult {
  personId: string;
  outputDir: string;
  sourceDir: string;
  workspaceDir: string;
  basePath: string;
}

export interface BuildPersonSiteDependencies {
  loadPersonRegistry?: typeof loadPersonRegistry;
  materializePerson?: typeof materializePerson;
  runUpstreamWorkspaceSiteBuild?: (
    input: UpstreamWorkspaceSiteBuildInput,
  ) => Promise<{ repoDir?: string }>;
}

export const buildPersonSite = async (
  input: BuildPersonSiteInput,
  dependencies: BuildPersonSiteDependencies = {},
): Promise<BuildPersonSiteResult> => {
  const registry = await (dependencies.loadPersonRegistry ?? loadPersonRegistry)(input.rootDir, {
    includeArchived: true,
  });
  const person = registry.find((entry) => entry.id === input.personId);

  if (!person) {
    throw new Error(`Could not find person '${input.personId}'.`);
  }

  if (person.lifecycleStatus !== "active" || person.enabled === false) {
    throw new Error(`Cannot build non-active person '${input.personId}'.`);
  }

  const workspace = await (dependencies.materializePerson ?? materializePerson)({
    personId: input.personId,
    rootDir: input.rootDir,
  });
  const outputDir = input.outputDir ?? getGeneratedPersonSiteDir(input.rootDir, input.personId);
  const buildTimestamp = resolveStableBuildTimestamp({
    explicitValue: input.buildTimestamp ?? process.env.OPENLINKS_BUILD_TIMESTAMP,
  });

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  await (dependencies.runUpstreamWorkspaceSiteBuild ?? runUpstreamWorkspaceSiteBuild)({
    workspaceDir: workspace.outputDir,
    outDir: outputDir,
    basePath: `/${input.personId}/`,
    buildTimestamp,
  });

  return {
    personId: input.personId,
    outputDir,
    sourceDir: workspace.sourceDir,
    workspaceDir: workspace.outputDir,
    basePath: `/${input.personId}/`,
  };
};
