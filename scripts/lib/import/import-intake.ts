import type { ImportIntakeResult } from "./contracts";
import {
  type UpstreamLinktreeBootstrapResult,
  adaptLinktreeBootstrapResult,
} from "./linktree-intake";
import { parseManualLinkList } from "./manual-link-list";
import { runUpstreamLinktreeBootstrap } from "./upstream-linktree-bootstrap";

export interface RunImportIntakeInput {
  sourceUrl?: string;
  manualLinksText?: string;
}

export interface ImportIntakeDependencies {
  extractLinktreeBootstrap?(sourceUrl: string): Promise<UpstreamLinktreeBootstrapResult>;
}

export const runImportIntake = async (
  input: RunImportIntakeInput,
  dependencies: ImportIntakeDependencies = {},
): Promise<ImportIntakeResult> => {
  if (input.sourceUrl && input.manualLinksText) {
    throw new Error("Choose one import mode: --source-url or --manual-links.");
  }

  if (!input.sourceUrl && !input.manualLinksText) {
    throw new Error("import requires either --source-url or --manual-links.");
  }

  if (input.sourceUrl) {
    const extracted = await (dependencies.extractLinktreeBootstrap ?? runUpstreamLinktreeBootstrap)(
      input.sourceUrl,
    );
    return adaptLinktreeBootstrapResult(extracted);
  }

  return parseManualLinkList({
    text: input.manualLinksText ?? "",
  });
};
