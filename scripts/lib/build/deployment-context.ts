const DEFAULT_LOCAL_ORIGIN = "http://localhost";
const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

export interface DeploymentContextInput {
  publicOrigin?: string;
  canonicalOrigin?: string;
}

export interface DeploymentContext {
  publicOrigin: string;
  canonicalOrigin: string;
  publicBasePath: string;
  canonicalBasePath: string;
}

export const normalizeBasePath = (value?: string): string => {
  if (typeof value !== "string") {
    return "/";
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "/") {
    return "/";
  }

  return `/${trimmed.replace(/^\/+|\/+$/gu, "")}/`;
};

const normalizeOrigin = (value: string, label: string): string => {
  let parsed: URL;

  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error(`${label} must be an absolute http(s) URL.`);
  }

  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`${label} must use http or https.`);
  }

  parsed.search = "";
  parsed.hash = "";

  const basePath = normalizeBasePath(parsed.pathname);
  return `${parsed.origin}${basePath === "/" ? "" : basePath.slice(0, -1)}`;
};

const resolveBasePathFromOrigin = (value: string): string =>
  normalizeBasePath(new URL(value).pathname);

const normalizePathSegment = (value: string): string => value.replace(/^\/+|\/+$/gu, "");

export const resolveRoutePath = (basePath: string, ...segments: string[]): string => {
  const normalizedBasePath = normalizeBasePath(basePath);
  const normalizedSegments = segments
    .map(normalizePathSegment)
    .filter((segment) => segment.length > 0);

  if (normalizedSegments.length === 0) {
    return normalizedBasePath;
  }

  return `${normalizedBasePath === "/" ? "/" : normalizedBasePath}${normalizedSegments.join("/")}/`;
};

export const resolvePersonRoutePath = (basePath: string, personId: string): string =>
  resolveRoutePath(basePath, personId);

export const resolveAbsoluteRouteUrl = (origin: string, routePath: string): string => {
  const normalizedOrigin = normalizeOrigin(origin, "origin");
  return new URL(normalizeBasePath(routePath), new URL(normalizedOrigin).origin).toString();
};

export const resolveDeploymentContext = (input: DeploymentContextInput = {}): DeploymentContext => {
  const publicOrigin = normalizeOrigin(input.publicOrigin ?? DEFAULT_LOCAL_ORIGIN, "publicOrigin");
  const canonicalOrigin = normalizeOrigin(input.canonicalOrigin ?? publicOrigin, "canonicalOrigin");

  return {
    publicOrigin,
    canonicalOrigin,
    publicBasePath: resolveBasePathFromOrigin(publicOrigin),
    canonicalBasePath: resolveBasePathFromOrigin(canonicalOrigin),
  };
};
