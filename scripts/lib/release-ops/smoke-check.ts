import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  type DeploymentContextInput,
  resolveAbsoluteRouteUrl,
  resolveDeploymentContext,
  resolvePersonRoutePath,
} from "../build/deployment-context";
import { PEOPLE_REGISTRY_FILE_NAME } from "../build/site-layout";
import { loadPersonRegistry } from "../manage-person/person-registry";

export type ReleaseSmokeCheckStatus = "passed" | "failed" | "skipped";

export interface ReleaseSmokeCheck {
  key: "root-index" | "deploy-manifest" | "landing-assets" | "representative-person";
  status: ReleaseSmokeCheckStatus;
  detail: string;
  remediation?: string;
}

export interface RunReleaseSmokeChecksInput extends DeploymentContextInput {
  rootDir: string;
  siteDir: string;
}

export interface RunReleaseSmokeChecksResult {
  status: "passed" | "failed";
  checks: ReleaseSmokeCheck[];
  failedCheck?: ReleaseSmokeCheck;
}

export interface RunReleaseSmokeChecksDependencies {
  loadPersonRegistry?: typeof loadPersonRegistry;
}

interface SiteWebManifest {
  icons?: Array<{
    src?: unknown;
  }>;
}

const createCheck = (
  key: ReleaseSmokeCheck["key"],
  status: ReleaseSmokeCheckStatus,
  detail: string,
  remediation?: string,
): ReleaseSmokeCheck => ({
  key,
  status,
  detail,
  remediation,
});

const readUtf8File = (filePath: string): string => readFileSync(filePath, "utf8");

const failCheck = (
  checks: ReleaseSmokeCheck[],
  key: ReleaseSmokeCheck["key"],
  detail: string,
  remediation: string,
): RunReleaseSmokeChecksResult => {
  const failedCheck = createCheck(key, "failed", detail, remediation);

  return {
    status: "failed",
    checks: [...checks, failedCheck],
    failedCheck,
  };
};

const extractMetaContent = (
  html: string,
  attributeName: "name" | "property",
  attributeValue: string,
): string | undefined => {
  const pattern = new RegExp(
    `<meta[^>]*${attributeName}="${attributeValue}"[^>]*content="([^"]+)"[^>]*>`,
    "iu",
  );
  const matched = pattern.exec(html);
  return matched?.[1];
};

const validateManifestIconPaths = (manifestPath: string): string | undefined => {
  const manifest = JSON.parse(readUtf8File(manifestPath)) as SiteWebManifest;

  for (const icon of manifest.icons ?? []) {
    if (typeof icon.src !== "string") {
      return "manifest icon source is missing";
    }

    const trimmed = icon.src.trim();
    if (trimmed.length === 0) {
      return "manifest icon source is empty";
    }

    if (trimmed.startsWith("/") || /^[a-z]+:/iu.test(trimmed)) {
      return `manifest icon source '${trimmed}' is not deployment-safe`;
    }
  }

  return undefined;
};

export const runReleaseSmokeChecks = async (
  input: RunReleaseSmokeChecksInput,
  dependencies: RunReleaseSmokeChecksDependencies = {},
): Promise<RunReleaseSmokeChecksResult> => {
  const deployment = resolveDeploymentContext(input);
  const checks: ReleaseSmokeCheck[] = [];
  const rootIndexPath = path.join(input.siteDir, "index.html");
  if (!existsSync(rootIndexPath)) {
    return failCheck(
      checks,
      "root-index",
      "root landing page is missing",
      "inspect generated/site/index.html output",
    );
  }

  const rootHtml = readUtf8File(rootIndexPath);
  const expectedRootAssetsPrefix = `${deployment.publicBasePath}landing-assets/`;
  if (!rootHtml.includes(expectedRootAssetsPrefix)) {
    return failCheck(
      checks,
      "root-index",
      `root landing page does not reference landing assets under '${expectedRootAssetsPrefix}'`,
      "inspect generated/site/index.html asset URLs and landing Vite base handling",
    );
  }

  if (!rootHtml.includes(`${deployment.publicBasePath}favicon.ico`)) {
    return failCheck(
      checks,
      "root-index",
      "root landing page is missing a base-aware favicon reference",
      "inspect landing.html favicon links and generated/site/index.html output",
    );
  }

  if (!rootHtml.includes(`${deployment.publicBasePath}site.webmanifest`)) {
    return failCheck(
      checks,
      "root-index",
      "root landing page is missing a base-aware manifest reference",
      "inspect landing.html manifest link and generated/site/index.html output",
    );
  }

  checks.push(
    createCheck("root-index", "passed", "root landing page uses deployment-aware asset paths"),
  );

  const deployManifestPath = path.join(input.siteDir, "deploy-manifest.json");
  if (existsSync(deployManifestPath)) {
    checks.push(createCheck("deploy-manifest", "passed", "deploy-manifest.json exists"));
  } else {
    return failCheck(
      checks,
      "deploy-manifest",
      "deploy-manifest.json is missing",
      "inspect Pages artifact finalization output",
    );
  }

  const landingAssetsPath = path.join(input.siteDir, "landing-assets");
  if (!existsSync(landingAssetsPath)) {
    return failCheck(
      checks,
      "landing-assets",
      "landing-assets output is missing",
      "inspect root landing page build output",
    );
  }

  const rootManifestPath = path.join(input.siteDir, "site.webmanifest");
  if (!existsSync(rootManifestPath)) {
    return failCheck(
      checks,
      "landing-assets",
      "root site.webmanifest is missing",
      "inspect landing build output and manifest generation",
    );
  }

  const rootManifestIssue = validateManifestIconPaths(rootManifestPath);
  if (rootManifestIssue) {
    return failCheck(
      checks,
      "landing-assets",
      rootManifestIssue,
      "rewrite generated/site/site.webmanifest with relative icon sources",
    );
  }

  const peopleRegistryPath = path.join(input.siteDir, PEOPLE_REGISTRY_FILE_NAME);
  if (!existsSync(peopleRegistryPath)) {
    return failCheck(
      checks,
      "landing-assets",
      `${PEOPLE_REGISTRY_FILE_NAME} is missing`,
      `inspect generated/site/${PEOPLE_REGISTRY_FILE_NAME} output`,
    );
  }

  const landingScriptName = readdirSync(landingAssetsPath).find((fileName) =>
    fileName.endsWith(".js"),
  );
  if (!landingScriptName) {
    return failCheck(
      checks,
      "landing-assets",
      "landing bundle is missing a JavaScript entrypoint",
      "inspect generated/site/landing-assets output",
    );
  }

  const landingScript = readUtf8File(path.join(landingAssetsPath, landingScriptName));
  if (!landingScript.includes(PEOPLE_REGISTRY_FILE_NAME)) {
    return failCheck(
      checks,
      "landing-assets",
      "landing bundle does not reference the people registry artifact",
      "inspect landing app build output and registry fetch path",
    );
  }

  checks.push(
    createCheck(
      "landing-assets",
      "passed",
      "landing assets, registry artifact, and root manifest are deployment-safe",
    ),
  );

  const registry = await (dependencies.loadPersonRegistry ?? loadPersonRegistry)(input.rootDir, {
    includeArchived: true,
  });
  const activePerson = registry.find(
    (person) => person.lifecycleStatus === "active" && person.enabled !== false,
  );

  if (!activePerson) {
    checks.push(
      createCheck(
        "representative-person",
        "skipped",
        "no active people are present, so route smoke verification was skipped",
      ),
    );

    return {
      status: "passed",
      checks,
    };
  }

  const representativeRoutePath = path.join(input.siteDir, activePerson.id, "index.html");
  if (!existsSync(representativeRoutePath)) {
    return failCheck(
      checks,
      "representative-person",
      `representative route is missing for ${activePerson.id}`,
      `inspect generated/site/${activePerson.id}/index.html output`,
    );
  }

  const personHtml = readUtf8File(representativeRoutePath);
  const publicPersonRoutePath = resolvePersonRoutePath(deployment.publicBasePath, activePerson.id);
  const canonicalPersonRoutePath = resolvePersonRoutePath(
    deployment.canonicalBasePath,
    activePerson.id,
  );
  const canonicalPersonUrl = resolveAbsoluteRouteUrl(
    deployment.canonicalOrigin,
    canonicalPersonRoutePath,
  );

  if (!personHtml.includes(`${publicPersonRoutePath}assets/`)) {
    return failCheck(
      checks,
      "representative-person",
      `representative route for ${activePerson.id} does not reference assets under '${publicPersonRoutePath}'`,
      `inspect generated/site/${activePerson.id}/index.html asset URLs`,
    );
  }

  if (!personHtml.includes(`${publicPersonRoutePath}favicon.svg`)) {
    return failCheck(
      checks,
      "representative-person",
      `representative route for ${activePerson.id} does not reference a base-aware favicon`,
      `inspect generated/site/${activePerson.id}/index.html icon URLs`,
    );
  }

  if (!personHtml.includes(`${publicPersonRoutePath}site.webmanifest`)) {
    return failCheck(
      checks,
      "representative-person",
      `representative route for ${activePerson.id} does not reference a base-aware manifest`,
      `inspect generated/site/${activePerson.id}/index.html manifest URL`,
    );
  }

  if (personHtml.includes("placeholder.example")) {
    return failCheck(
      checks,
      "representative-person",
      `representative route for ${activePerson.id} still contains placeholder.example`,
      `inspect generated/site/${activePerson.id}/index.html SEO output`,
    );
  }

  const canonicalHref = /<link[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/iu.exec(
    personHtml,
  )?.[1];
  if (canonicalHref !== canonicalPersonUrl) {
    return failCheck(
      checks,
      "representative-person",
      `representative route for ${activePerson.id} canonical URL '${canonicalHref ?? "missing"}' does not match '${canonicalPersonUrl}'`,
      `inspect generated/site/${activePerson.id}/index.html canonical metadata`,
    );
  }

  const ogUrl = extractMetaContent(personHtml, "property", "og:url");
  if (ogUrl !== canonicalPersonUrl) {
    return failCheck(
      checks,
      "representative-person",
      `representative route for ${activePerson.id} og:url '${ogUrl ?? "missing"}' does not match '${canonicalPersonUrl}'`,
      `inspect generated/site/${activePerson.id}/index.html Open Graph metadata`,
    );
  }

  const ogImage = extractMetaContent(personHtml, "property", "og:image");
  if (!ogImage?.startsWith(canonicalPersonUrl)) {
    return failCheck(
      checks,
      "representative-person",
      `representative route for ${activePerson.id} og:image '${ogImage ?? "missing"}' is not rooted at '${canonicalPersonUrl}'`,
      `inspect generated/site/${activePerson.id}/index.html Open Graph image metadata`,
    );
  }

  const twitterImage = extractMetaContent(personHtml, "name", "twitter:image");
  if (!twitterImage?.startsWith(canonicalPersonUrl)) {
    return failCheck(
      checks,
      "representative-person",
      `representative route for ${activePerson.id} twitter:image '${twitterImage ?? "missing"}' is not rooted at '${canonicalPersonUrl}'`,
      `inspect generated/site/${activePerson.id}/index.html Twitter image metadata`,
    );
  }

  const representativeManifestPath = path.join(input.siteDir, activePerson.id, "site.webmanifest");
  if (!existsSync(representativeManifestPath)) {
    return failCheck(
      checks,
      "representative-person",
      `representative route manifest is missing for ${activePerson.id}`,
      `inspect generated/site/${activePerson.id}/site.webmanifest output`,
    );
  }

  const representativeManifestIssue = validateManifestIconPaths(representativeManifestPath);
  if (representativeManifestIssue) {
    return failCheck(
      checks,
      "representative-person",
      representativeManifestIssue,
      `rewrite generated/site/${activePerson.id}/site.webmanifest with relative icon sources`,
    );
  }

  checks.push(
    createCheck(
      "representative-person",
      "passed",
      `representative route exists for ${activePerson.id} and uses deployment-aware metadata`,
    ),
  );

  return {
    status: "passed",
    checks,
  };
};
