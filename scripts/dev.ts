import { existsSync, statSync } from "node:fs";
import { extname, join, posix, resolve, sep } from "node:path";
import process from "node:process";

import { buildSite } from "./lib/build/build-site";
import { getGeneratedSiteLayout } from "./lib/build/site-layout";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4173;

export interface ParsedDevArgs {
  rootDir: string;
  host: string;
  port: number;
  publicOrigin: string;
  canonicalOrigin: string;
  showHelp: boolean;
}

const formatOriginHost = (host: string): string => (host.includes(":") ? `[${host}]` : host);

const buildDefaultOrigin = (host: string, port: number): string =>
  `http://${formatOriginHost(host)}:${String(port)}`;

const parsePort = (value: string): number => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid --port '${value}'. Use an integer between 1 and 65535.`);
  }

  return parsed;
};

export const parseDevArgs = (argv: string[], defaultRootDir = process.cwd()): ParsedDevArgs => {
  const readSingleFlag = (name: string): string | undefined => {
    const index = argv.lastIndexOf(name);
    if (index < 0) {
      return undefined;
    }

    return argv[index + 1];
  };

  const showHelp = argv.includes("--help") || argv.includes("-h");
  const rootDir = readSingleFlag("--root") ?? defaultRootDir;
  const host = readSingleFlag("--host") ?? DEFAULT_HOST;
  const portValue = readSingleFlag("--port");
  const port = portValue ? parsePort(portValue) : DEFAULT_PORT;
  const publicOrigin = readSingleFlag("--public-origin") ?? buildDefaultOrigin(host, port);
  const canonicalOrigin = readSingleFlag("--canonical-origin") ?? publicOrigin;

  return {
    rootDir,
    host,
    port,
    publicOrigin,
    canonicalOrigin,
    showHelp,
  };
};

export const buildDevHelpText = (): string =>
  [
    "Build the local Pages artifact once and serve generated/site with Bun.",
    "",
    "Usage:",
    "  bun run preview [options]",
    "  bun run dev [options]",
    "",
    "Options:",
    `  --host <hostname>            Bind host (default: ${DEFAULT_HOST})`,
    `  --port <port>                Bind port (default: ${DEFAULT_PORT})`,
    "  --root <path>                Repo root to build from (default: cwd)",
    "  --public-origin <origin>     Override generated public origin",
    "  --canonical-origin <origin>  Override generated canonical origin",
    "  --help, -h                   Show this help text",
    "",
  ].join("\n");

const normalizeRequestPath = (pathname: string): string | null => {
  let decoded: string;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded.includes("\0")) {
    return null;
  }

  const normalized = posix.normalize(decoded.startsWith("/") ? decoded : `/${decoded}`);
  const relativePath = normalized.replace(/^\/+/u, "");

  if (relativePath === ".." || relativePath.startsWith("../")) {
    return null;
  }

  return relativePath;
};

export const resolveServedFilePath = (siteDir: string, pathname: string): string | null => {
  const rootDir = resolve(siteDir);
  const relativePath = normalizeRequestPath(pathname);

  if (relativePath === null) {
    return null;
  }

  const candidateRelativePaths =
    relativePath.length === 0
      ? ["index.html"]
      : extname(relativePath).length > 0
        ? [relativePath]
        : [relativePath, posix.join(relativePath, "index.html")];

  for (const candidate of candidateRelativePaths) {
    const absolutePath = resolve(siteDir, join(...candidate.split("/")));
    if (absolutePath !== rootDir && !absolutePath.startsWith(`${rootDir}${sep}`)) {
      continue;
    }

    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      continue;
    }

    return absolutePath;
  }

  return null;
};

const main = async (): Promise<void> => {
  const args = parseDevArgs(process.argv.slice(2));

  if (args.showHelp) {
    process.stdout.write(buildDevHelpText());
    return;
  }

  const layout = getGeneratedSiteLayout(args.rootDir);
  const buildResult = await buildSite({
    rootDir: args.rootDir,
    publicOrigin: args.publicOrigin,
    canonicalOrigin: args.canonicalOrigin,
  });

  const server = Bun.serve({
    hostname: args.host,
    port: args.port,
    async fetch(request: Request): Promise<Response> {
      const requestUrl = new URL(request.url);
      const maybeFilePath = resolveServedFilePath(layout.siteDir, requestUrl.pathname);

      if (!maybeFilePath) {
        return new Response("Not found\n", {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      }

      const file = Bun.file(maybeFilePath);
      const headers = new Headers({
        "Cache-Control": "no-store",
      });
      if (file.type) {
        headers.set("Content-Type", file.type);
      }

      return new Response(file, {
        headers,
      });
    },
  });

  const shutdown = (): void => {
    server.stop(true);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  process.stdout.write(
    [
      `Initial build mode: ${buildResult.mode}`,
      `Built people: ${buildResult.builtPersonIds.join(", ") || "none"}`,
      `Serving: ${layout.siteDir}`,
      `Local URL: ${buildDefaultOrigin(args.host, args.port)}/`,
      "",
    ].join("\n"),
  );
};

if (import.meta.main) {
  await main();
}
