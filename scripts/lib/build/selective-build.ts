import { loadPersonRegistry } from "../manage-person/person-registry";
import { type BuildSiteResult, buildSite } from "./build-site";
import {
  type BuildSelection,
  type BuildSelectionMode,
  formatBuildSelectionHuman,
} from "./change-detection";
import { type DeploymentContextInput, resolveDeploymentContext } from "./deployment-context";
import { type RestoreLiveSiteResult, restoreLiveSite } from "./restore-live-site";

export interface ExecuteBuildSelectionInput extends DeploymentContextInput {
  rootDir: string;
  selection: BuildSelection;
  buildTimestamp?: string;
}

export interface ExecuteBuildSelectionResult extends Omit<BuildSiteResult, "mode"> {
  mode: BuildSelectionMode;
  fallbackReason?: string;
  restoredSite?: RestoreLiveSiteResult;
  selectionSummary: string;
}

export interface ExecuteBuildSelectionDependencies {
  loadPersonRegistry?: typeof loadPersonRegistry;
  buildSite?: typeof buildSite;
  restoreLiveSite?: typeof restoreLiveSite;
}

export const executeBuildSelection = async (
  input: ExecuteBuildSelectionInput,
  dependencies: ExecuteBuildSelectionDependencies = {},
): Promise<ExecuteBuildSelectionResult> => {
  const deployment = resolveDeploymentContext(input);
  const selectionSummary = formatBuildSelectionHuman(input.selection);
  const buildSiteImpl = dependencies.buildSite ?? buildSite;

  if (input.selection.mode === "none") {
    const result = await buildSiteImpl({
      rootDir: input.rootDir,
      personIds: [],
      preserveExisting: true,
      includeLandingPage: false,
      buildTimestamp: input.buildTimestamp,
      publicOrigin: deployment.publicOrigin,
      canonicalOrigin: deployment.canonicalOrigin,
    });

    return {
      ...result,
      mode: "none",
      selectionSummary,
    };
  }

  if (input.selection.mode === "full") {
    const result = await buildSiteImpl({
      rootDir: input.rootDir,
      buildTimestamp: input.buildTimestamp,
      publicOrigin: deployment.publicOrigin,
      canonicalOrigin: deployment.canonicalOrigin,
    });

    return {
      ...result,
      selectionSummary,
    };
  }

  if (!input.publicOrigin) {
    const result = await buildSiteImpl({
      rootDir: input.rootDir,
      buildTimestamp: input.buildTimestamp,
      publicOrigin: deployment.publicOrigin,
      canonicalOrigin: deployment.canonicalOrigin,
    });

    return {
      ...result,
      fallbackReason:
        "public origin was unavailable for a selective restore; widened to full build",
      selectionSummary,
    };
  }

  try {
    const restoredSite = await (dependencies.restoreLiveSite ?? restoreLiveSite)({
      rootDir: input.rootDir,
      publicOrigin: deployment.publicOrigin,
    });
    const registry = await (dependencies.loadPersonRegistry ?? loadPersonRegistry)(input.rootDir, {
      includeArchived: true,
    });
    const registryById = new Map(registry.map((person) => [person.id, person]));
    const buildablePersonIds = input.selection.personIds.filter((personId) => {
      const person = registryById.get(personId);
      return person?.lifecycleStatus === "active" && person.enabled !== false;
    });
    const removedPersonIds = input.selection.personIds.filter((personId) => {
      const person = registryById.get(personId);
      return !person || person.lifecycleStatus !== "active" || person.enabled === false;
    });
    const result = await buildSiteImpl({
      rootDir: input.rootDir,
      personIds: buildablePersonIds,
      preserveExisting: true,
      removePersonIds: removedPersonIds,
      includeLandingPage: true,
      buildTimestamp: input.buildTimestamp,
      publicOrigin: deployment.publicOrigin,
      canonicalOrigin: deployment.canonicalOrigin,
    });

    return {
      ...result,
      restoredSite,
      selectionSummary,
    };
  } catch (error) {
    const result = await buildSiteImpl({
      rootDir: input.rootDir,
      buildTimestamp: input.buildTimestamp,
      publicOrigin: deployment.publicOrigin,
      canonicalOrigin: deployment.canonicalOrigin,
    });

    return {
      ...result,
      fallbackReason:
        error instanceof Error
          ? `${error.message}\nWidened to a full rebuild.`
          : "Selective restore failed. Widened to a full rebuild.",
      selectionSummary,
    };
  }
};
