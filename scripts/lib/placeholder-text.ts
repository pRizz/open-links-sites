import { DEFAULT_TEMPLATE_REPLACEMENTS } from "./person-contract";

const PLACEHOLDER_TEXT_VALUES = new Set([
  DEFAULT_TEMPLATE_REPLACEMENTS.profileHeadline,
  DEFAULT_TEMPLATE_REPLACEMENTS.profileBio,
  DEFAULT_TEMPLATE_REPLACEMENTS.profileLocation,
  DEFAULT_TEMPLATE_REPLACEMENTS.siteDescription,
]);

export const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const isPlaceholderText = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  return value.startsWith("TODO:") || PLACEHOLDER_TEXT_VALUES.has(value);
};

export const resolveNonPlaceholderText = (value: unknown): string | undefined => {
  const normalized = normalizeText(value);
  return normalized && !isPlaceholderText(normalized) ? normalized : undefined;
};
