import { writeFileSync } from "node:fs";

interface SiteWebManifest {
  name: string;
  short_name: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
  }>;
  theme_color: string;
  background_color: string;
  display: string;
}

const DEPLOYMENT_SAFE_SITE_WEB_MANIFEST: SiteWebManifest = {
  name: "OpenLinks",
  short_name: "OpenLinks",
  icons: [
    {
      src: "./android-chrome-192x192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "./android-chrome-512x512.png",
      sizes: "512x512",
      type: "image/png",
    },
  ],
  theme_color: "#111111",
  background_color: "#111111",
  display: "standalone",
};

export const createDeploymentSafeSiteWebManifest = (): SiteWebManifest =>
  structuredClone(DEPLOYMENT_SAFE_SITE_WEB_MANIFEST);

export const writeDeploymentSafeSiteWebManifest = (filePath: string): void => {
  writeFileSync(
    filePath,
    `${JSON.stringify(createDeploymentSafeSiteWebManifest(), null, 2)}\n`,
    "utf8",
  );
};
