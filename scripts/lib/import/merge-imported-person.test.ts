import { expect, test } from "bun:test";

import type { ImportIntakeResult } from "./contracts";
import { mergeImportedPerson } from "./merge-imported-person";

const createLinktreeIntake = (): ImportIntakeResult => ({
  kind: "linktree",
  sourceUrl: "https://linktr.ee/xstaci",
  profile: {
    name: "Staci Costopoulos",
    bio: "Host of Bitcoin Nova Podcast | X Community Leader",
    avatar:
      "https://ugc.production.linktr.ee/cb51ef8a-75f5-45d0-b5ee-84930a9a6116_IMG-0031.jpeg?io=true&size=avatar-v3_0",
    profileLinks: [
      {
        label: "Website",
        url: "https://bitcoinnova.store/",
        sourceOrder: 0,
      },
      {
        label: "YouTube",
        url: "https://youtube.com/@thebitcoinnovapodcast?si=bJDvNhG8zklJMv8Q",
        sourceOrder: 1,
      },
      {
        label: "X",
        url: "https://x.com/XSTAC1",
        sourceOrder: 2,
      },
    ],
  },
  links: [
    {
      label: "The Bitcoin Nova",
      url: "https://bitcoinnova.store/",
      sourceOrder: 0,
    },
  ],
  snapshot: {
    kind: "linktree",
    sourceUrl: "https://linktr.ee/xstaci",
    fetchedUrl: "https://linktr.ee/xstaci",
    title: "Staci",
    description: "Host of Bitcoin Nova Podcast | X Community Leader",
    avatar:
      "https://ugc.production.linktr.ee/cb51ef8a-75f5-45d0-b5ee-84930a9a6116_IMG-0031.jpeg?io=true&size=avatar-v3_0",
    linkCount: 1,
    socialLinkCount: 3,
    links: [
      {
        label: "The Bitcoin Nova",
        url: "https://bitcoinnova.store/",
      },
    ],
    socialLinks: [
      {
        label: "Website",
        url: "https://bitcoinnova.store/",
      },
      {
        label: "YouTube",
        url: "https://youtube.com/@thebitcoinnovapodcast?si=bJDvNhG8zklJMv8Q",
      },
      {
        label: "X",
        url: "https://x.com/XSTAC1",
      },
    ],
    warnings: [],
  },
  warnings: [],
});

test("refreshes placeholder Linktree avatar and profile links on re-import", () => {
  const documents = {
    person: {
      id: "staci-costopoulos",
      displayName: "Staci Costopoulos",
      source: {
        kind: "linktree",
        url: "https://linktr.ee/XSTACI",
        seedUrls: ["https://linktr.ee/XSTACI"],
      },
    },
    profile: {
      name: "Staci Costopoulos",
      headline: "TODO: add a short headline",
      avatar: "https://linktr.ee/og/image/XSTACI.jpg",
      bio: "Host of Bitcoin Nova Podcast | X Community Leader",
      location: "TODO: add location",
      profileLinks: [
        {
          label: "Primary Link",
          url: "https://bitcoinblacksheep.com/",
        },
        {
          label: "Live with the Hive Podcast",
          url: "https://youtube.com/@livewiththehive?si=tQizrqZ7AVqSBimH&sub_confirmation=1",
        },
      ],
      custom: {
        bootstrapStatus: "placeholder",
      },
    },
    links: {
      links: [],
      order: [],
    },
    site: {
      title: "Staci Costopoulos | OpenLinks",
      description: "Host of Bitcoin Nova Podcast | X Community Leader",
    },
  };

  const result = mergeImportedPerson({
    importedAt: "2026-03-18T09:34:55.759Z",
    intake: createLinktreeIntake(),
    documents,
  });

  expect(result.appliedProfileFields).toContain("avatar");
  expect(result.addedProfileLinks).toEqual([
    "https://bitcoinnova.store/",
    "https://youtube.com/@thebitcoinnovapodcast?si=bJDvNhG8zklJMv8Q",
    "https://x.com/XSTAC1",
  ]);
  expect(result.changed).toBe(true);
  expect(documents.profile.avatar).toBe(
    "https://ugc.production.linktr.ee/cb51ef8a-75f5-45d0-b5ee-84930a9a6116_IMG-0031.jpeg?io=true&size=avatar-v3_0",
  );
  expect(documents.profile.profileLinks).toEqual([
    {
      label: "Website",
      url: "https://bitcoinnova.store/",
    },
    {
      label: "YouTube",
      url: "https://youtube.com/@thebitcoinnovapodcast?si=bJDvNhG8zklJMv8Q",
    },
    {
      label: "X",
      url: "https://x.com/XSTAC1",
    },
  ]);
});

test("preserves curated remote avatars while refreshing Linktree profile links", () => {
  const documents = {
    person: {
      id: "staci-costopoulos",
      displayName: "Staci Costopoulos",
      source: {
        kind: "linktree",
        url: "https://linktr.ee/XSTACI",
        seedUrls: ["https://linktr.ee/XSTACI"],
      },
    },
    profile: {
      name: "Staci Costopoulos",
      headline: "Host",
      avatar: "https://cdn.example.com/custom-avatar.jpeg",
      bio: "Curated bio",
      location: "Chicago",
      profileLinks: [
        {
          label: "Website",
          url: "https://staci.example.com/",
        },
      ],
      custom: {
        bootstrapStatus: "placeholder",
      },
    },
    links: {
      links: [],
      order: [],
    },
    site: {
      title: "Staci Costopoulos | OpenLinks",
      description: "Curated bio",
    },
  };

  mergeImportedPerson({
    importedAt: "2026-03-18T09:34:55.759Z",
    intake: createLinktreeIntake(),
    documents,
  });

  expect(documents.profile.avatar).toBe("https://cdn.example.com/custom-avatar.jpeg");
  expect(documents.profile.profileLinks).toEqual([
    {
      label: "Website",
      url: "https://bitcoinnova.store/",
    },
    {
      label: "YouTube",
      url: "https://youtube.com/@thebitcoinnovapodcast?si=bJDvNhG8zklJMv8Q",
    },
    {
      label: "X",
      url: "https://x.com/XSTAC1",
    },
  ]);
});

test("upgrades existing imported X community links from simple to rich on re-import", () => {
  const documents = {
    person: {
      id: "staci-costopoulos",
      displayName: "Staci Costopoulos",
      source: {
        kind: "linktree",
        url: "https://linktr.ee/XSTACI",
        seedUrls: ["https://linktr.ee/XSTACI", "https://x.com/i/communities/1871996451812769951"],
      },
    },
    profile: {
      name: "Staci Costopoulos",
      headline: "Host",
      avatar: "https://cdn.example.com/custom-avatar.jpeg",
      bio: "Curated bio",
      location: "Chicago",
      profileLinks: [],
      custom: {},
    },
    links: {
      links: [
        {
          id: "paranoid-bitcoin-anarchists",
          label: "Paranoid Bitcoin Anarchists",
          url: "https://x.com/i/communities/1871996451812769951",
          type: "simple",
          enabled: true,
          custom: {
            import: {
              kind: "linktree",
              importedAt: "2026-03-18T11:24:40.180Z",
              sourceUrl: "https://linktr.ee/XSTACI",
            },
          },
        },
      ],
      order: ["paranoid-bitcoin-anarchists"],
    },
    site: {
      title: "Staci Costopoulos | OpenLinks",
      description: "Curated bio",
    },
  };

  const result = mergeImportedPerson({
    importedAt: "2026-03-25T18:00:00.000Z",
    intake: {
      ...createLinktreeIntake(),
      links: [
        {
          label: "Paranoid Bitcoin Anarchists",
          url: "https://x.com/i/communities/1871996451812769951",
          sourceOrder: 0,
        },
      ],
    },
    documents,
  });

  expect(result.changed).toBe(true);
  expect(result.addedLinkIds).toEqual([]);
  expect(result.skippedDuplicateUrls).toEqual([]);
  expect(documents.links.links).toEqual([
    {
      id: "paranoid-bitcoin-anarchists",
      label: "Paranoid Bitcoin Anarchists",
      url: "https://x.com/i/communities/1871996451812769951",
      type: "rich",
      enabled: true,
      custom: {
        import: {
          kind: "linktree",
          importedAt: "2026-03-25T18:00:00.000Z",
          sourceUrl: "https://linktr.ee/xstaci",
        },
      },
    },
  ]);
});
