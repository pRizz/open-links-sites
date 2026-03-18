export type DeployMode = "push" | "manual" | "nightly";

export const resolveDeployMode = (eventName?: string): DeployMode => {
  if (eventName === "schedule") {
    return "nightly";
  }

  if (eventName === "workflow_dispatch") {
    return "manual";
  }

  return "push";
};

export const shouldUseChangedPaths = (mode: DeployMode): boolean => mode === "push";

export const describeDeployMode = (mode: DeployMode): string => {
  if (mode === "nightly") {
    return "nightly backstop deploy run";
  }

  if (mode === "manual") {
    return "manual full deploy run";
  }

  return "push-triggered immediate deploy run";
};
