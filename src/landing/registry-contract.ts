export interface LandingRegistryEntry {
  id: string;
  displayName: string;
  path: string;
  avatarUrl?: string;
  headline?: string;
  summary?: string;
}

export interface LandingRegistryPayload {
  entries: LandingRegistryEntry[];
}
