import { expect, test } from "bun:test";
import { adaptLinktreeBootstrapResult } from "./linktree-intake";

test("adapts upstream Linktree bootstrap results into the local import contract", () => {
  const adapted = adaptLinktreeBootstrapResult({
    kind: "linktree",
    sourceUrl: "https://linktr.ee/example",
    fetchedUrl: "https://linktr.ee/example",
    profile: {
      name: "Example Person",
      bio: "Builder and operator.",
      avatar: "https://cdn.example.com/avatar.jpeg?size=avatar-v3_0",
      socialLinks: [
        {
          label: "Website",
          url: "https://example.com",
          sourceOrder: 0,
        },
        {
          label: "GitHub",
          url: "https://github.com/example",
          sourceOrder: 1,
        },
      ],
    },
    links: [
      {
        label: "Main Site",
        url: "https://example.com",
        sourceOrder: 0,
      },
      {
        label: "Newsletter",
        url: "https://example.substack.com",
        sourceOrder: 1,
      },
    ],
    warnings: ["used structured Linktree payload"],
  });

  expect(adapted.profile.avatar).toBe("https://cdn.example.com/avatar.jpeg?size=avatar-v3_0");
  expect(adapted.profile.profileLinks).toEqual([
    {
      label: "Website",
      url: "https://example.com",
      sourceOrder: 0,
    },
    {
      label: "GitHub",
      url: "https://github.com/example",
      sourceOrder: 1,
    },
  ]);
  expect(adapted.links).toEqual([
    {
      label: "Main Site",
      url: "https://example.com",
      sourceOrder: 0,
    },
    {
      label: "Newsletter",
      url: "https://example.substack.com",
      sourceOrder: 1,
    },
  ]);
  expect(adapted.snapshot.socialLinkCount).toBe(2);
  expect(adapted.snapshot.socialLinks).toEqual([
    {
      label: "Website",
      url: "https://example.com",
    },
    {
      label: "GitHub",
      url: "https://github.com/example",
    },
  ]);
});
