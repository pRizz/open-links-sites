import type { LandingRegistryEntry, LandingRegistryPayload } from "./registry-contract";

const REGISTRY_FILE_NAME = "landing-registry.json";

const normalizeSearchText = (value: string): string =>
  value.trim().toLowerCase().replaceAll(/\s+/gu, " ");

const isLandingRegistryPayload = (value: unknown): value is LandingRegistryPayload => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entries = (value as LandingRegistryPayload).entries;
  return Array.isArray(entries);
};

const isLandingRegistryEntry = (value: unknown): value is LandingRegistryEntry => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as LandingRegistryEntry;
  return (
    typeof entry.id === "string" &&
    (entry.kind === "local" || entry.kind === "external") &&
    typeof entry.displayName === "string" &&
    typeof entry.href === "string" &&
    typeof entry.subtitle === "string"
  );
};

export const fetchLandingRegistry = async (): Promise<LandingRegistryEntry[]> => {
  const response = await fetch(`${import.meta.env.BASE_URL}${REGISTRY_FILE_NAME}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not load ${REGISTRY_FILE_NAME} (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;
  if (!isLandingRegistryPayload(payload)) {
    throw new Error(`The landing registry payload in ${REGISTRY_FILE_NAME} is invalid.`);
  }

  return payload.entries.filter(isLandingRegistryEntry);
};

export const filterLandingRegistry = (
  entries: LandingRegistryEntry[],
  query: string,
): LandingRegistryEntry[] => {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length === 0) {
    return entries;
  }

  return entries.filter((entry) => {
    const searchableText = normalizeSearchText(
      [
        entry.displayName,
        entry.id,
        entry.subtitle,
        entry.href,
        entry.badgeLabel,
        entry.headline,
        entry.summary,
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(" "),
    );

    return searchableText.includes(normalizedQuery);
  });
};

export const formatRegistryCount = (count: number): string =>
  count === 1 ? "1 directory entry" : `${count} directory entries`;

export const initialsForRegistryEntry = (entry: LandingRegistryEntry): string => {
  const parts = entry.displayName
    .split(/\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return entry.id.slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

export const landingRegistryLinkLabel = (entry: LandingRegistryEntry): string =>
  entry.kind === "external" ? "Visit site" : "Open page";

export const landingRegistryLinkRel = (entry: LandingRegistryEntry): string | undefined =>
  entry.openInNewTab ? "noopener noreferrer" : undefined;

export const landingRegistryLinkTarget = (entry: LandingRegistryEntry): string | undefined =>
  entry.openInNewTab ? "_blank" : undefined;
