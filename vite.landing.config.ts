import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

import { LANDING_ASSETS_DIRECTORY } from "./scripts/lib/build/site-layout";

const normalizeBasePath = (value?: string): string => {
  if (!value) {
    return "/";
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "/") {
    return "/";
  }

  return `/${trimmed.replace(/^\/+|\/+$/gu, "")}/`;
};

export default defineConfig({
  plugins: [solidPlugin()],
  base: normalizeBasePath(process.env.BASE_PATH),
  build: {
    assetsDir: LANDING_ASSETS_DIRECTORY,
    emptyOutDir: false,
    rollupOptions: {
      input: "./landing.html",
    },
    target: "esnext",
  },
});
