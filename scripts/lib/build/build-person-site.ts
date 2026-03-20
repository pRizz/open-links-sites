import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadPersonRegistry } from "../manage-person/person-registry";
import { materializePerson } from "../materialize-person";
import { resolveStableBuildTimestamp } from "./build-timestamp";
import {
  type DeploymentContextInput,
  resolveAbsoluteRouteUrl,
  resolveDeploymentContext,
  resolvePersonRoutePath,
} from "./deployment-context";
import { getGeneratedPersonSiteDir } from "./site-layout";
import { writeDeploymentSafeSiteWebManifest } from "./site-web-manifest";
import {
  type UpstreamWorkspaceSiteBuildInput,
  runUpstreamWorkspaceSiteBuild,
} from "./upstream-site-builder";

interface SiteJsonPayload {
  baseUrl?: unknown;
  quality?: {
    seo?: {
      canonicalBaseUrl?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface BuildPersonSiteInput extends DeploymentContextInput {
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

const patchGeneratedWorkspaceSiteData = (
  workspaceDir: string,
  personRoutePath: string,
  canonicalPersonUrl: string,
): void => {
  const sitePath = join(workspaceDir, "data", "site.json");
  const siteData = JSON.parse(readFileSync(sitePath, "utf8")) as SiteJsonPayload;

  const updatedSiteData: SiteJsonPayload = {
    ...siteData,
    baseUrl: personRoutePath,
    quality: {
      ...siteData.quality,
      seo: {
        ...siteData.quality?.seo,
        canonicalBaseUrl: canonicalPersonUrl,
      },
    },
  };

  writeFileSync(sitePath, `${JSON.stringify(updatedSiteData, null, 2)}\n`, "utf8");
};

export const buildPersonSite = async (
  input: BuildPersonSiteInput,
  dependencies: BuildPersonSiteDependencies = {},
): Promise<BuildPersonSiteResult> => {
  const deployment = resolveDeploymentContext(input);
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
  const publicRoutePath = resolvePersonRoutePath(deployment.publicBasePath, input.personId);
  const canonicalRoutePath = resolvePersonRoutePath(deployment.canonicalBasePath, input.personId);
  const canonicalPersonUrl = resolveAbsoluteRouteUrl(
    deployment.canonicalOrigin,
    canonicalRoutePath,
  );

  patchGeneratedWorkspaceSiteData(workspace.outputDir, canonicalRoutePath, canonicalPersonUrl);
  writeDeploymentSafeSiteWebManifest(join(workspace.publicDir, "site.webmanifest"));

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  await (dependencies.runUpstreamWorkspaceSiteBuild ?? runUpstreamWorkspaceSiteBuild)({
    workspaceDir: workspace.outputDir,
    outDir: outputDir,
    basePath: publicRoutePath,
    buildTimestamp,
  });

  return {
    personId: input.personId,
    outputDir,
    sourceDir: workspace.sourceDir,
    workspaceDir: workspace.outputDir,
    basePath: publicRoutePath,
  };
};
