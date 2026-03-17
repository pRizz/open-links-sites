import type { ImportIntakeResult } from "./contracts";
import { parseLinktreeLikeHtml } from "./linktree-intake";
import { parseManualLinkList } from "./manual-link-list";

export interface FetchImportSourceResult {
  finalUrl: string;
  html: string;
}

export interface RunImportIntakeInput {
  sourceUrl?: string;
  manualLinksText?: string;
}

export interface ImportIntakeDependencies {
  fetchSourceHtml?(sourceUrl: string): Promise<FetchImportSourceResult>;
}

const fetchSourceHtml = async (sourceUrl: string): Promise<FetchImportSourceResult> => {
  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "open-links-sites-import/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch '${sourceUrl}' for import: ${response.status} ${response.statusText}`,
    );
  }

  return {
    finalUrl: response.url || sourceUrl,
    html: await response.text(),
  };
};

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
    const fetched = await (dependencies.fetchSourceHtml ?? fetchSourceHtml)(input.sourceUrl);
    return parseLinktreeLikeHtml({
      sourceUrl: input.sourceUrl,
      fetchedUrl: fetched.finalUrl,
      html: fetched.html,
    });
  }

  return parseManualLinkList({
    text: input.manualLinksText ?? "",
  });
};
