import {
  type DeployMode,
  describeDeployMode,
  resolveDeployMode,
  shouldUseChangedPaths,
} from "./nightly-deploy";
import { formatStageSummary } from "./release-summary";
import {
  type OpenLinksUpstreamState,
  readOpenLinksUpstreamState,
  shortCommit,
} from "./upstream-state";

export interface ResolveDeployWorkflowContextInput {
  rootDir: string;
  eventName?: string;
}

export interface DeployWorkflowContext {
  mode: DeployMode;
  useChangedPaths: boolean;
  upstreamState: OpenLinksUpstreamState;
  summary: string;
}

export const formatDeployWorkflowContextSummary = (context: DeployWorkflowContext): string =>
  formatStageSummary("## Deploy Context", [
    `- Mode: \`${context.mode}\``,
    `- Strategy: ${describeDeployMode(context.mode)}`,
    `- Use changed paths: \`${context.useChangedPaths}\``,
    `- Pinned upstream: \`${context.upstreamState.repository}@${shortCommit(context.upstreamState.commit)}\``,
  ]);

export const resolveDeployWorkflowContext = ({
  rootDir,
  eventName,
}: ResolveDeployWorkflowContextInput): DeployWorkflowContext => {
  const upstreamState = readOpenLinksUpstreamState(rootDir);
  const mode = resolveDeployMode(eventName);
  const context: DeployWorkflowContext = {
    mode,
    useChangedPaths: shouldUseChangedPaths(mode),
    upstreamState,
    summary: "",
  };

  context.summary = formatDeployWorkflowContextSummary(context);
  return context;
};
