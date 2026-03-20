import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { loadExternalOpenLinksCache } from "./external-openlinks";
import { refreshExternalOpenLinks } from "./refresh-external-openlinks";

const tempRoots: string[] = [];

const createTempRoot = (): string => {
  const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-refresh-external-"));
  tempRoots.push(rootDir);
  return rootDir;
};

const writeJson = (filePath: string, value: unknown): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const createResponse = (input: {
  url: string;
  status?: number;
  body?: string | Uint8Array;
  headers?: Record<string, string>;
  json?: unknown;
}) =>
  ((binaryBody) =>
    ({
      ok: (input.status ?? 200) >= 200 && (input.status ?? 200) < 300,
      status: input.status ?? 200,
      url: input.url,
      headers: new Headers(input.headers),
      text: async () =>
        typeof input.body === "string"
          ? input.body
          : Buffer.from(input.body ?? []).toString("utf8"),
      json: async () => input.json,
      arrayBuffer: async () =>
        binaryBody.buffer.slice(
          binaryBody.byteOffset,
          binaryBody.byteOffset + binaryBody.byteLength,
        ),
    }) as unknown as Response)(Buffer.from(input.body ?? []));

const createFetchMock = (handlers: Record<string, Response | (() => Response)>): typeof fetch =>
  (async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    const handler = handlers[url];
    if (!handler) {
      throw new Error(`Unexpected fetch: ${url}`);
    }

    return typeof handler === "function" ? handler() : handler;
  }) as typeof fetch;

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("refreshExternalOpenLinks", () => {
  test("extracts metadata, mirrors preview images, and stays stable on unchanged reruns", async () => {
    const rootDir = createTempRoot();
    writeJson(join(rootDir, "config", "landing", "external-openlinks.json"), {
      entries: [
        {
          id: "openlinks-us",
          siteUrl: "https://openlinks.us/",
          enabled: true,
        },
      ],
    });
    writeJson(join(rootDir, "config", "landing", "external-openlinks-cache.json"), {
      version: 1,
      entries: {},
    });

    const fetchMock = createFetchMock({
      "https://openlinks.us/": () =>
        createResponse({
          url: "https://openlinks.us/",
          body: [
            "<html><head><title>Peter Ryszkiewicz | OpenLinks</title>",
            '<meta name="description" content="A personal OpenLinks page." />',
            '<meta property="og:image" content="/social-card.png" />',
            '<link rel="manifest" href="/site.webmanifest" />',
            '<link rel="apple-touch-icon" href="/icon.png" />',
            "</head><body></body></html>",
          ].join(""),
          headers: {
            "content-type": "text/html; charset=utf-8",
          },
        }),
      "https://openlinks.us/site.webmanifest": () =>
        createResponse({
          url: "https://openlinks.us/site.webmanifest",
          json: {
            name: "OpenLinks",
            short_name: "OpenLinks",
          },
          headers: {
            "content-type": "application/manifest+json",
          },
        }),
      "https://openlinks.us/social-card.png": () =>
        createResponse({
          url: "https://openlinks.us/social-card.png",
          body: new Uint8Array([1, 2, 3, 4]),
          headers: {
            "content-type": "image/png",
          },
        }),
    });

    const firstResult = await refreshExternalOpenLinks(
      {
        rootDir,
      },
      {
        fetch: fetchMock,
      },
    );

    expect(firstResult.status).toBe("passed");
    expect(firstResult.entries).toEqual([
      {
        id: "openlinks-us",
        status: "updated",
        detail: "cache refreshed",
      },
    ]);

    const firstCache = loadExternalOpenLinksCache(rootDir);
    expect(firstCache.entries["openlinks-us"]).toMatchObject({
      id: "openlinks-us",
      siteUrl: "https://openlinks.us/",
      finalUrl: "https://openlinks.us/",
      destinationUrl: "https://openlinks.us/",
      displayName: "Peter Ryszkiewicz",
      subtitle: "openlinks.us",
      summary: "A personal OpenLinks page.",
      avatarUrl: "https://openlinks.us/icon.png",
      previewImageSourceUrl: "https://openlinks.us/social-card.png",
      mirroredPreviewImagePath: "config/landing/external-openlinks-media/openlinks-us-preview.png",
      verification: {
        status: "confirmed",
        reasons: [
          "page title includes OpenLinks",
          "site.webmanifest name includes OpenLinks",
          "site.webmanifest short_name includes OpenLinks",
        ],
        manifestUrl: "https://openlinks.us/site.webmanifest",
      },
    });
    expect(
      existsSync(
        join(rootDir, "config", "landing", "external-openlinks-media", "openlinks-us-preview.png"),
      ),
    ).toBe(true);

    const firstCacheContents = readFileSync(
      join(rootDir, "config", "landing", "external-openlinks-cache.json"),
      "utf8",
    );

    const secondResult = await refreshExternalOpenLinks(
      {
        rootDir,
      },
      {
        fetch: fetchMock,
      },
    );

    expect(secondResult.status).toBe("passed");
    expect(secondResult.entries).toEqual([
      {
        id: "openlinks-us",
        status: "unchanged",
        detail: "no cache changes",
      },
    ]);
    expect(
      readFileSync(join(rootDir, "config", "landing", "external-openlinks-cache.json"), "utf8"),
    ).toBe(firstCacheContents);
  });

  test("manual preview overrides win over extracted preview metadata", async () => {
    const rootDir = createTempRoot();
    writeJson(join(rootDir, "config", "landing", "external-openlinks.json"), {
      entries: [
        {
          id: "openlinks-us",
          siteUrl: "https://openlinks.us/",
          enabled: true,
          previewImageUrl: "https://cdn.example.com/manual-preview.webp",
        },
      ],
    });
    writeJson(join(rootDir, "config", "landing", "external-openlinks-cache.json"), {
      version: 1,
      entries: {},
    });

    const result = await refreshExternalOpenLinks(
      {
        rootDir,
      },
      {
        fetch: createFetchMock({
          "https://openlinks.us/": () =>
            createResponse({
              url: "https://openlinks.us/",
              body: [
                "<html><head>",
                "<title>OpenLinks</title>",
                '<meta property="og:image" content="/ignored-preview.png" />',
                "</head><body></body></html>",
              ].join(""),
              headers: {
                "content-type": "text/html; charset=utf-8",
              },
            }),
          "https://cdn.example.com/manual-preview.webp": () =>
            createResponse({
              url: "https://cdn.example.com/manual-preview.webp",
              body: new Uint8Array([9, 8, 7]),
              headers: {
                "content-type": "image/webp",
              },
            }),
        }),
      },
    );

    expect(result.status).toBe("passed");

    const cache = loadExternalOpenLinksCache(rootDir);
    expect(cache.entries["openlinks-us"]?.previewImageSourceUrl).toBe(
      "https://cdn.example.com/manual-preview.webp",
    );
    expect(cache.entries["openlinks-us"]?.mirroredPreviewImagePath).toBe(
      "config/landing/external-openlinks-media/openlinks-us-preview.webp",
    );
  });
});
