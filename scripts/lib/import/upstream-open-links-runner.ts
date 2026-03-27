import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import type { GeneratedWorkspaceLayout } from "./cache-layout";

const getDefaultOpenLinksCandidates = (): string[] => [
  process.env.OPEN_LINKS_REPO_DIR ?? "",
  join(homedir(), "Repos", "open-links"),
  join(homedir(), "open-links"),
];

const PUBLIC_RICH_HOSTS = new Set(["medium.com", "primal.net", "twitter.com", "x.com"]);

type RunnerStatus = "ran" | "skipped" | "failed";

export interface UpstreamRunnerStep {
  key:
    | "enrich-rich-links"
    | "sync-profile-avatar"
    | "sync-content-images"
    | "public-rich-sync"
    | "refresh-generated-rich-metadata"
    | "sync-follower-history"
    | "validate-data";
  status: RunnerStatus;
  blocking: boolean;
  reason?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

export interface UpstreamRunnerResult {
  steps: UpstreamRunnerStep[];
  blockingFailure?: UpstreamRunnerStep;
  validationOutput?: Record<string, unknown>;
}

export interface RunUpstreamOpenLinksInput {
  workspace: GeneratedWorkspaceLayout;
  fullRefresh: boolean;
  syncFollowerHistory?: boolean;
}

export interface RunUpstreamScriptInput {
  repoDir: string;
  workspaceDir: string;
  stepKey: UpstreamRunnerStep["key"];
  scriptName: string;
  args: string[];
}

export interface RunUpstreamOpenLinksDependencies {
  resolveOpenLinksRepoDir?: () => string;
  runUpstreamScript?: (input: RunUpstreamScriptInput) => UpstreamRunnerStep;
}

export const resolveOpenLinksRepoDir = (): string => {
  for (const candidate of getDefaultOpenLinksCandidates()) {
    if (!candidate) {
      continue;
    }

    if (existsSync(join(candidate, "package.json")) && existsSync(join(candidate, "scripts"))) {
      return candidate;
    }
  }

  throw new Error(
    "Could not locate the upstream open-links repo. Set OPEN_LINKS_REPO_DIR or place it under ~/Repos/open-links.",
  );
};

const runUpstreamScript = (input: RunUpstreamScriptInput): UpstreamRunnerStep => {
  const result = spawnSync(
    process.execPath,
    ["run", join(input.repoDir, "scripts", input.scriptName), ...input.args],
    {
      cwd: input.workspaceDir,
      encoding: "utf8",
    },
  );

  return {
    key: input.stepKey,
    status: result.status === 0 ? "ran" : "failed",
    blocking: result.status !== 0,
    exitCode: result.status ?? 1,
    stdout: result.stdout?.trim() || undefined,
    stderr: result.stderr?.trim() || undefined,
  };
};

const hasRemoteAvatar = (layout: GeneratedWorkspaceLayout): boolean => {
  try {
    const profile = JSON.parse(readFileSync(`${layout.dataDir}/profile.json`, "utf8")) as {
      avatar?: unknown;
    };
    return typeof profile.avatar === "string" && /^https?:\/\//u.test(profile.avatar);
  } catch {
    return false;
  }
};

const hasPublicRichTargets = (layout: GeneratedWorkspaceLayout): boolean => {
  try {
    const links = JSON.parse(readFileSync(`${layout.dataDir}/links.json`, "utf8")) as {
      links?: Array<{ type?: unknown; url?: unknown; enrichment?: unknown }>;
    };

    return (links.links ?? []).some((entry) => {
      if (entry.type !== "rich" || typeof entry.url !== "string") {
        return false;
      }

      const enrichment =
        typeof entry.enrichment === "object" &&
        entry.enrichment !== null &&
        !Array.isArray(entry.enrichment)
          ? (entry.enrichment as Record<string, unknown>)
          : undefined;
      if (enrichment?.enabled === false) {
        return false;
      }

      try {
        const url = new URL(entry.url);
        return PUBLIC_RICH_HOSTS.has(url.hostname.replace(/^www\./u, "").toLowerCase());
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
};

const prepareFullRefreshWorkspace = (layout: GeneratedWorkspaceLayout): void => {
  const refreshPaths = [
    layout.files.profileAvatarManifest,
    layout.files.profileAvatarRuntimeManifest,
    layout.files.contentImagesManifest,
    layout.files.contentImagesRuntimeManifest,
    layout.files.richPublicCache,
    layout.files.generatedRichMetadata,
    layout.files.richEnrichmentReport,
    layout.dirs.profileAvatar,
    layout.dirs.contentImages,
  ];

  for (const targetPath of refreshPaths) {
    rmSync(targetPath, { recursive: true, force: true });
  }
};

export const runUpstreamOpenLinks = async (
  input: RunUpstreamOpenLinksInput,
  dependencies: RunUpstreamOpenLinksDependencies = {},
): Promise<UpstreamRunnerResult> => {
  const repoDir = (dependencies.resolveOpenLinksRepoDir ?? resolveOpenLinksRepoDir)();
  const runScript = (
    stepKey: UpstreamRunnerStep["key"],
    scriptName: string,
    args: string[],
  ): UpstreamRunnerStep =>
    (dependencies.runUpstreamScript ?? runUpstreamScript)({
      repoDir,
      workspaceDir: input.workspace.outputDir,
      stepKey,
      scriptName,
      args,
    });

  if (input.fullRefresh) {
    prepareFullRefreshWorkspace(input.workspace);
  }

  const steps: UpstreamRunnerStep[] = [];
  const enrichStep = runScript("enrich-rich-links", "enrich-rich-links.ts", [
    "--write-public-cache",
  ]);
  steps.push(enrichStep);
  if (enrichStep.status === "failed") {
    return {
      steps,
      blockingFailure: enrichStep,
    };
  }

  if (hasRemoteAvatar(input.workspace)) {
    const avatarStep = runScript(
      "sync-profile-avatar",
      "sync-profile-avatar.ts",
      input.fullRefresh ? ["--force"] : [],
    );
    steps.push(avatarStep);
    if (avatarStep.status === "failed") {
      return {
        steps,
        blockingFailure: avatarStep,
      };
    }
  } else {
    steps.push({
      key: "sync-profile-avatar",
      status: "skipped",
      blocking: false,
      reason: "profile.avatar is not a remote http/https URL",
    });
  }

  const contentImageArgs = input.fullRefresh ? ["--force"] : [];
  const contentImageStep = runScript(
    "sync-content-images",
    "sync-content-images.ts",
    contentImageArgs,
  );
  steps.push(contentImageStep);
  if (contentImageStep.status === "failed") {
    return {
      steps,
      blockingFailure: contentImageStep,
    };
  }

  if (hasPublicRichTargets(input.workspace)) {
    const publicRichArgs = input.fullRefresh ? ["--force"] : ["--only-missing"];
    const publicRichStep = runScript("public-rich-sync", "public-rich-sync.ts", publicRichArgs);
    steps.push(publicRichStep);
    if (publicRichStep.status === "failed") {
      return {
        steps,
        blockingFailure: publicRichStep,
      };
    }

    const refreshGeneratedRichMetadataStep = runScript(
      "refresh-generated-rich-metadata",
      "enrich-rich-links.ts",
      ["--write-public-cache"],
    );
    steps.push(refreshGeneratedRichMetadataStep);
    if (refreshGeneratedRichMetadataStep.status === "failed") {
      return {
        steps,
        blockingFailure: refreshGeneratedRichMetadataStep,
      };
    }
  } else {
    steps.push({
      key: "public-rich-sync",
      status: "skipped",
      blocking: false,
      reason: "no eligible x, medium, or primal rich links were present",
    });
  }

  if (input.syncFollowerHistory) {
    const followerHistoryStep = runScript("sync-follower-history", "sync-follower-history.ts", []);
    steps.push(followerHistoryStep);
    if (followerHistoryStep.status === "failed") {
      return {
        steps,
        blockingFailure: followerHistoryStep,
      };
    }
  }

  const validateStep = runScript("validate-data", "validate-data.ts", ["--format", "json"]);
  steps.push(validateStep);

  let validationOutput: Record<string, unknown> | undefined;
  if (validateStep.stdout) {
    try {
      validationOutput = JSON.parse(validateStep.stdout) as Record<string, unknown>;
    } catch {
      validationOutput = undefined;
    }
  }

  if (validateStep.status === "failed") {
    return {
      steps,
      blockingFailure: validateStep,
      validationOutput,
    };
  }

  return {
    steps,
    validationOutput,
  };
};
