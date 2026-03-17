import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

import { LANDING_ASSETS_DIRECTORY } from "./scripts/lib/build/site-layout";

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    assetsDir: LANDING_ASSETS_DIRECTORY,
    emptyOutDir: false,
    rollupOptions: {
      input: "./landing.html",
    },
    target: "esnext",
  },
});
