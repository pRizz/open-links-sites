import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { UpstreamLinktreeBootstrapResult } from "../lib/import/linktree-intake";
import {
  type ImportPersonDependencies,
  runImportPersonAction,
} from "../lib/manage-person/import-person";
import { getTemplateAssetPath, loadHydratedDefaultTemplates } from "../lib/person-contract";

export const writeJson = (filePath: string, value: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const createManagePersonTestHarness = () => {
  const tempRoots: string[] = [];

  const createFixtureRoot = (): string => {
    const rootDir = mkdtempSync(join(tmpdir(), "open-links-sites-manage-person-"));
    tempRoots.push(rootDir);

    const fixtures = [
      { personId: "alice-example", personName: "Alice Example" },
      { personId: "bob-sample", personName: "Bob Sample" },
    ];

    for (const fixture of fixtures) {
      const templates = loadHydratedDefaultTemplates({
        personId: fixture.personId,
        personName: fixture.personName,
        primaryLinkUrl: `https://example.com/${fixture.personId}`,
        profileHeadline: "TODO: add a short headline",
        profileBio: "TODO: add a one or two sentence bio for this person.",
        profileLocation: "TODO: add location",
        siteTitle: `${fixture.personName} | OpenLinks`,
        siteDescription: "TODO: add a concise site description for this person.",
      });
      const personDir = join(rootDir, "people", fixture.personId);
      mkdirSync(join(personDir, "assets"), { recursive: true });
      writeJson(join(personDir, "person.json"), templates.person);
      writeJson(join(personDir, "profile.json"), templates.profile);
      writeJson(join(personDir, "links.json"), templates.links);
      writeJson(join(personDir, "site.json"), templates.site);
      cpSync(
        getTemplateAssetPath("avatar-placeholder.svg"),
        join(personDir, "assets", "avatar-placeholder.svg"),
      );
    }

    return rootDir;
  };

  const cleanup = (): void => {
    for (const rootDir of tempRoots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  };

  return {
    createFixtureRoot,
    cleanup,
  };
};

export const createCapturedWriters = (): {
  stdout: string[];
  stderr: string[];
  stdoutWriter: { write(text: string): void };
  stderrWriter: { write(text: string): void };
} => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout,
    stderr,
    stdoutWriter: { write: (text) => stdout.push(text) },
    stderrWriter: { write: (text) => stderr.push(text) },
  };
};

export const createImportActionHandler =
  (dependencies: ImportPersonDependencies) =>
  ({ args, rootDir }: { args: string[]; rootDir: string }) =>
    runImportPersonAction(args, rootDir, {
      nowIso: () => "2026-03-17T12:00:00.000Z",
      ...dependencies,
    });

export const createUpstreamLinktreeBootstrapResult = (input: {
  sourceUrl: string;
  fetchedUrl?: string;
  name?: string;
  bio?: string;
  avatar?: string;
  links: Array<{ label: string; url: string; sourceOrder: number }>;
  socialLinks?: Array<{ label: string; url: string; sourceOrder: number }>;
  warnings?: string[];
}): UpstreamLinktreeBootstrapResult => ({
  kind: "linktree",
  sourceUrl: input.sourceUrl,
  fetchedUrl: input.fetchedUrl ?? input.sourceUrl,
  profile: {
    name: input.name,
    bio: input.bio,
    avatar: input.avatar,
    socialLinks: input.socialLinks ?? [],
  },
  links: input.links,
  snapshot: {
    kind: "linktree",
    sourceUrl: input.sourceUrl,
    fetchedUrl: input.fetchedUrl ?? input.sourceUrl,
    title: input.name,
    description: input.bio,
    avatar: input.avatar,
    linkCount: input.links.length,
    socialLinkCount: (input.socialLinks ?? []).length,
    links: input.links.map((link) => ({
      label: link.label,
      url: link.url,
    })),
    socialLinks: (input.socialLinks ?? []).map((link) => ({
      label: link.label,
      url: link.url,
    })),
    warnings: input.warnings ?? [],
  },
  warnings: input.warnings ?? [],
});
