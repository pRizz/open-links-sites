export type LandingRegistryEntryKind = "local" | "external";

export interface LandingRegistryEntry {
  id: string;
  kind: LandingRegistryEntryKind;
  displayName: string;
  href: string;
  subtitle: string;
  badgeLabel?: string;
  openInNewTab?: boolean;
  avatarUrl?: string;
  previewImageUrl?: string;
  headline?: string;
  summary?: string;
}

export interface LandingRegistryPayload {
  entries: LandingRegistryEntry[];
}
