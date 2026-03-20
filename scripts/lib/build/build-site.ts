import { mkdirSync, rmSync } from "node:fs";

import { loadPersonRegistry } from "../manage-person/person-registry";
import { buildLandingPage } from "./build-landing-page";
import { buildPersonSite } from "./build-person-site";
import { resolveStableBuildTimestamp } from "./build-timestamp";
import { type DeploymentContextInput, resolveDeploymentContext } from "./deployment-context";
import { getGeneratedPersonSiteDir, getGeneratedSiteLayout } from "./site-layout";

export interface BuildSiteInput extends DeploymentContextInput {
  rootDir: string;
  personIds?: string[];
  preserveExisting?: boolean;
  removePersonIds?: string[];
  includeLandingPage?: boolean;
  buildTimestamp?: string;
}

export interface BuildSiteResult {
  mode: "full" | "targeted";
  siteDir: string;
  builtPersonIds: string[];
  removedPersonIds: string[];
}

export interface BuildSiteDependencies {
  loadPersonRegistry?: typeof loadPersonRegistry;
  buildPersonSite?: typeof buildPersonSite;
  buildLandingPage?: typeof buildLandingPage;
}

const uniqueValues = (values: string[]): string[] => [...new Set(values)];

export const buildSite = async (
  input: BuildSiteInput,
  dependencies: BuildSiteDependencies = {},
): Promise<BuildSiteResult> => {
  const deployment = resolveDeploymentContext(input);
  const layout = getGeneratedSiteLayout(input.rootDir);
  const registry = await (dependencies.loadPersonRegistry ?? loadPersonRegistry)(input.rootDir, {
    includeArchived: true,
  });
  const registryById = new Map(registry.map((person) => [person.id, person]));
  const activePersonIds = registry
    .filter((person) => person.lifecycleStatus === "active" && person.enabled !== false)
    .map((person) => person.id);
  const targetPersonIds = uniqueValues(input.personIds ?? activePersonIds);
  const buildTimestamp = resolveStableBuildTimestamp({
    explicitValue: input.buildTimestamp ?? process.env.OPENLINKS_BUILD_TIMESTAMP,
  });

  if (!input.preserveExisting) {
    rmSync(layout.siteDir, { recursive: true, force: true });
  }
  mkdirSync(layout.siteDir, { recursive: true });

  for (const personId of targetPersonIds) {
    const person = registryById.get(personId);
    if (!person) {
      throw new Error(`Could not find person '${personId}'.`);
    }

    if (person.lifecycleStatus !== "active" || person.enabled === false) {
      throw new Error(`Cannot build non-active person '${personId}'.`);
    }
  }

  const builtPersonIds: string[] = [];
  for (const personId of targetPersonIds) {
    await (dependencies.buildPersonSite ?? buildPersonSite)({
      rootDir: input.rootDir,
      personId,
      buildTimestamp,
      publicOrigin: deployment.publicOrigin,
      canonicalOrigin: deployment.canonicalOrigin,
    });
    builtPersonIds.push(personId);
  }

  const removedPersonIds = uniqueValues(input.removePersonIds ?? []);
  for (const personId of removedPersonIds) {
    rmSync(getGeneratedPersonSiteDir(input.rootDir, personId), {
      recursive: true,
      force: true,
    });
  }

  if (input.includeLandingPage !== false) {
    await (dependencies.buildLandingPage ?? buildLandingPage)({
      rootDir: input.rootDir,
      publicOrigin: deployment.publicOrigin,
      canonicalOrigin: deployment.canonicalOrigin,
    });
  }

  return {
    mode: input.personIds ? "targeted" : "full",
    siteDir: layout.siteDir,
    builtPersonIds,
    removedPersonIds,
  };
};
