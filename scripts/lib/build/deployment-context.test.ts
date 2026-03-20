import { describe, expect, test } from "bun:test";

import {
  resolveAbsoluteRouteUrl,
  resolveDeploymentContext,
  resolvePersonRoutePath,
} from "./deployment-context";

describe("deployment-context", () => {
  test("defaults root deployments to '/'", () => {
    const context = resolveDeploymentContext({
      publicOrigin: "https://links.example.com",
    });

    expect(context.publicOrigin).toBe("https://links.example.com");
    expect(context.canonicalOrigin).toBe("https://links.example.com");
    expect(context.publicBasePath).toBe("/");
    expect(context.canonicalBasePath).toBe("/");
  });

  test("normalizes project-path deployments", () => {
    const context = resolveDeploymentContext({
      publicOrigin: "https://example.com/open-links-sites",
    });

    expect(context.publicOrigin).toBe("https://example.com/open-links-sites");
    expect(context.publicBasePath).toBe("/open-links-sites/");
    expect(resolvePersonRoutePath(context.publicBasePath, "alice-example")).toBe(
      "/open-links-sites/alice-example/",
    );
  });

  test("normalizes nested subpath deployments", () => {
    const context = resolveDeploymentContext({
      publicOrigin: "https://example.com/apps/links/",
    });

    expect(context.publicOrigin).toBe("https://example.com/apps/links");
    expect(context.publicBasePath).toBe("/apps/links/");
    expect(resolveAbsoluteRouteUrl(context.publicOrigin, context.publicBasePath)).toBe(
      "https://example.com/apps/links/",
    );
  });

  test("supports canonical overrides independently from the public origin", () => {
    const context = resolveDeploymentContext({
      publicOrigin: "https://cdn.example.com/links",
      canonicalOrigin: "https://links.example.com",
    });

    expect(context.publicBasePath).toBe("/links/");
    expect(context.canonicalBasePath).toBe("/");
    expect(resolveAbsoluteRouteUrl(context.canonicalOrigin, "/alice-example/")).toBe(
      "https://links.example.com/alice-example/",
    );
  });
});
