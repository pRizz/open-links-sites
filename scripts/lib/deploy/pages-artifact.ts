import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type DeployCacheClass = "html" | "metadata" | "immutable" | "asset";

export interface PagesDeployManifestFile {
  cacheClass: DeployCacheClass;
  path: string;
  sha256: string;
  size: number;
}

export interface PagesDeployManifest {
  artifactHash: string;
  files: PagesDeployManifestFile[];
  publicOrigin: string;
  version: 1;
}

export interface PagesDeployManifestDiff {
  changed: boolean;
  deletes: string[];
  unchanged: string[];
  uploads: PagesDeployManifestFile[];
}

const normalizeOrigin = (value: string): string => value.replace(/\/+$/u, "");

export const classifyArtifactPath = (relativePath: string): DeployCacheClass => {
  if (relativePath.endsWith(".html")) {
    return "html";
  }

  if (relativePath === ".nojekyll" || relativePath === "deploy-manifest.json") {
    return "metadata";
  }

  const basename = path.basename(relativePath);
  if (/-[A-Za-z0-9_-]{8,}\./u.test(basename)) {
    return "immutable";
  }

  return "asset";
};

const listRelativeFiles = async (rootDir: string, prefix = ""): Promise<string[]> => {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(absolutePath, relativePath)));
      continue;
    }

    files.push(relativePath);
  }

  return files.sort((left, right) => left.localeCompare(right));
};

export const collectArtifactFiles = async (
  outputDir: string,
): Promise<PagesDeployManifestFile[]> => {
  const relativePaths = await listRelativeFiles(outputDir);
  const deployablePaths = relativePaths.filter(
    (relativePath) => relativePath !== "deploy-manifest.json",
  );

  const files = await Promise.all(
    deployablePaths.map(async (relativePath) => {
      const content = await readFile(path.join(outputDir, relativePath));

      return {
        cacheClass: classifyArtifactPath(relativePath),
        path: relativePath,
        sha256: createHash("sha256").update(content).digest("hex"),
        size: content.byteLength,
      } satisfies PagesDeployManifestFile;
    }),
  );

  return files.sort((left, right) => left.path.localeCompare(right.path));
};

export const createPagesDeployManifest = async (
  outputDir: string,
  publicOrigin: string,
): Promise<PagesDeployManifest> => {
  const files = await collectArtifactFiles(outputDir);
  const artifactHash = createHash("sha256")
    .update(
      files.map((file) => `${file.path}:${file.sha256}:${file.size}:${file.cacheClass}`).join("\n"),
    )
    .digest("hex");

  return {
    artifactHash,
    files,
    publicOrigin: normalizeOrigin(publicOrigin),
    version: 1,
  };
};

export const writeDeployManifest = async (
  outputDir: string,
  publicOrigin: string,
): Promise<PagesDeployManifest> => {
  const manifest = await createPagesDeployManifest(outputDir, publicOrigin);
  await writeFile(
    path.join(outputDir, "deploy-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return manifest;
};

export const readDeployManifest = async (manifestPath: string): Promise<PagesDeployManifest> =>
  JSON.parse(await readFile(manifestPath, "utf8")) as PagesDeployManifest;

export const ensureArtifactIntegrity = async (
  outputDir: string,
  manifest: PagesDeployManifest,
): Promise<void> => {
  const missingPaths: string[] = [];

  for (const file of manifest.files) {
    try {
      await access(path.join(outputDir, file.path));
    } catch {
      missingPaths.push(file.path);
    }
  }

  if (missingPaths.length > 0) {
    throw new Error(
      `Artifact directory ${outputDir} is missing ${missingPaths.length} file(s) listed in deploy-manifest.json.`,
    );
  }
};

export const diffDeployManifests = (
  localManifest: PagesDeployManifest,
  maybeRemoteManifest: PagesDeployManifest | null,
): PagesDeployManifestDiff => {
  if (!maybeRemoteManifest) {
    return {
      changed: true,
      deletes: [],
      unchanged: [],
      uploads: localManifest.files,
    };
  }

  const remoteFiles = new Map(maybeRemoteManifest.files.map((file) => [file.path, file]));
  const localFiles = new Map(localManifest.files.map((file) => [file.path, file]));
  const uploads: PagesDeployManifestFile[] = [];
  const unchanged: string[] = [];

  for (const localFile of localManifest.files) {
    const maybeRemoteFile = remoteFiles.get(localFile.path);
    if (
      !maybeRemoteFile ||
      maybeRemoteFile.sha256 !== localFile.sha256 ||
      maybeRemoteFile.cacheClass !== localFile.cacheClass
    ) {
      uploads.push(localFile);
      continue;
    }

    unchanged.push(localFile.path);
  }

  const deletes = maybeRemoteManifest.files
    .filter((remoteFile) => !localFiles.has(remoteFile.path))
    .map((remoteFile) => remoteFile.path)
    .sort((left, right) => left.localeCompare(right));

  return {
    changed:
      normalizeOrigin(localManifest.publicOrigin) !==
        normalizeOrigin(maybeRemoteManifest.publicOrigin) ||
      uploads.length > 0 ||
      deletes.length > 0,
    deletes,
    unchanged: unchanged.sort((left, right) => left.localeCompare(right)),
    uploads: uploads.sort((left, right) => left.path.localeCompare(right.path)),
  };
};

export const finalizePagesArtifact = async (
  outputDir: string,
  publicOrigin: string,
): Promise<PagesDeployManifest> => {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, ".nojekyll"), "", "utf8");
  return writeDeployManifest(outputDir, publicOrigin);
};
