import { formatStageSummary } from "./release-summary";
import {
  type OpenLinksUpstreamState,
  getOpenLinksUpstreamStatePath,
  readOpenLinksUpstreamState,
  resolveLatestOpenLinksUpstreamState,
  shortCommit,
  writeOpenLinksUpstreamState,
} from "./upstream-state";

export type UpstreamSyncResultType = "no-op" | "changed" | "blocked";

export interface SyncUpstreamInput {
  rootDir: string;
  upstreamRepoDir?: string;
  writeState?: boolean;
  syncedAt?: string;
}

export interface SyncUpstreamResult {
  stage: "upstream-sync";
  result: UpstreamSyncResultType;
  statePath: string;
  changed: boolean;
  wroteState: boolean;
  verificationRequired: boolean;
  summary: string;
  trackedState?: OpenLinksUpstreamState;
  latestState?: OpenLinksUpstreamState;
  reason?: string;
}

export interface SyncUpstreamDependencies {
  readTrackedState?: (rootDir: string) => OpenLinksUpstreamState | Promise<OpenLinksUpstreamState>;
  readLatestState?: (
    input: SyncUpstreamInput,
  ) => OpenLinksUpstreamState | Promise<OpenLinksUpstreamState>;
  writeTrackedState?: (
    rootDir: string,
    state: OpenLinksUpstreamState,
  ) => Promise<string | undefined> | string | undefined;
}

const buildSyncSummary = (result: SyncUpstreamResult): string => {
  const trackedCommit = result.trackedState ? shortCommit(result.trackedState.commit) : undefined;
  const latestCommit = result.latestState ? shortCommit(result.latestState.commit) : undefined;

  return formatStageSummary("## Upstream Sync", [
    `- Result: \`${result.result}\``,
    result.trackedState ? `- Repository: \`${result.trackedState.repository}\`` : undefined,
    result.trackedState ? `- Branch: \`${result.trackedState.branch}\`` : undefined,
    trackedCommit ? `- Tracked commit: \`${trackedCommit}\`` : undefined,
    latestCommit ? `- Latest commit: \`${latestCommit}\`` : undefined,
    `- State file: \`${result.statePath}\``,
    `- Verification required: \`${result.verificationRequired}\``,
    result.reason ? `- Reason: ${result.reason}` : undefined,
  ]);
};

export const syncUpstreamState = async (
  input: SyncUpstreamInput,
  dependencies: SyncUpstreamDependencies = {},
): Promise<SyncUpstreamResult> => {
  const statePath = getOpenLinksUpstreamStatePath(input.rootDir);

  try {
    const trackedState = await (dependencies.readTrackedState ?? readOpenLinksUpstreamState)(
      input.rootDir,
    );
    const latestState = await (dependencies.readLatestState ?? resolveLatestOpenLinksUpstreamState)(
      {
        ...input,
      },
    );

    if (trackedState.commit === latestState.commit) {
      const result: SyncUpstreamResult = {
        stage: "upstream-sync",
        result: "no-op",
        statePath,
        changed: false,
        wroteState: false,
        verificationRequired: false,
        trackedState,
        latestState,
        reason: "tracked upstream commit already matches the latest upstream commit",
        summary: "",
      };
      result.summary = buildSyncSummary(result);
      return result;
    }

    const writeState = input.writeState !== false;
    if (writeState) {
      await (dependencies.writeTrackedState ?? writeOpenLinksUpstreamState)(
        input.rootDir,
        latestState,
      );
    }

    const result: SyncUpstreamResult = {
      stage: "upstream-sync",
      result: "changed",
      statePath,
      changed: true,
      wroteState: writeState,
      verificationRequired: true,
      trackedState,
      latestState,
      reason: writeState
        ? "updated tracked upstream state; verification must pass before publish"
        : "upstream moved; verification would be required before publish",
      summary: "",
    };
    result.summary = buildSyncSummary(result);
    return result;
  } catch (error) {
    const result: SyncUpstreamResult = {
      stage: "upstream-sync",
      result: "blocked",
      statePath,
      changed: false,
      wroteState: false,
      verificationRequired: false,
      reason: error instanceof Error ? error.message : "unknown upstream sync failure",
      summary: "",
    };
    result.summary = buildSyncSummary(result);
    return result;
  }
};
