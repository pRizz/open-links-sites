import { join } from "node:path";

import { LANDING_REGISTRY_ASSETS_DIRECTORY } from "../landing/external-openlinks";
import { GENERATED_ROOT } from "../person-contract";

export const GENERATED_SITE_DIRECTORY = "site";
export const LANDING_ASSETS_DIRECTORY = "landing-assets";
export const LANDING_REGISTRY_FILE_NAME = "landing-registry.json";

export interface GeneratedSiteLayout {
  generatedDir: string;
  siteDir: string;
  landingAssetsDir: string;
  landingRegistryAssetsDir: string;
  landingRegistryPath: string;
}

export const getGeneratedSiteLayout = (rootDir: string): GeneratedSiteLayout => {
  const generatedDir = join(rootDir, GENERATED_ROOT);
  const siteDir = join(generatedDir, GENERATED_SITE_DIRECTORY);

  return {
    generatedDir,
    siteDir,
    landingAssetsDir: join(siteDir, LANDING_ASSETS_DIRECTORY),
    landingRegistryAssetsDir: join(
      siteDir,
      LANDING_ASSETS_DIRECTORY,
      LANDING_REGISTRY_ASSETS_DIRECTORY,
    ),
    landingRegistryPath: join(siteDir, LANDING_REGISTRY_FILE_NAME),
  };
};

export const getGeneratedPersonSiteDir = (rootDir: string, personId: string): string =>
  join(getGeneratedSiteLayout(rootDir).siteDir, personId);
