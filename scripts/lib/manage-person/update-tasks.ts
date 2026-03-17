export interface LoadedPersonDocuments {
  person: Record<string, unknown>;
  profile: Record<string, unknown>;
  links: Record<string, unknown>;
  site: Record<string, unknown>;
}

export interface RequestedUpdateTask {
  key: string;
  label: string;
  value: string;
  apply(documents: LoadedPersonDocuments): void;
}

const ensureRecord = (value: unknown, context: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${context} to be an object.`);
  }

  return value as Record<string, unknown>;
};

const ensureStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const resolveSourceRecord = (person: Record<string, unknown>): Record<string, unknown> => {
  const source = person.source;
  if (source === undefined) {
    const created: Record<string, unknown> = {};
    person.source = created;
    return created;
  }

  return ensureRecord(source, "person.source");
};

const resolveThemeRecord = (site: Record<string, unknown>): Record<string, unknown> => {
  const theme = site.theme;
  if (theme === undefined) {
    const created: Record<string, unknown> = {};
    site.theme = created;
    return created;
  }

  return ensureRecord(theme, "site.theme");
};

const UPDATE_TASK_DEFINITIONS = {
  "--name": {
    key: "name",
    label: "display name",
    apply(documents, value) {
      documents.person.displayName = value;
      documents.profile.name = value;
    },
  },
  "--headline": {
    key: "headline",
    label: "headline",
    apply(documents, value) {
      documents.profile.headline = value;
    },
  },
  "--bio": {
    key: "bio",
    label: "bio",
    apply(documents, value) {
      documents.profile.bio = value;
    },
  },
  "--location": {
    key: "location",
    label: "location",
    apply(documents, value) {
      documents.profile.location = value;
    },
  },
  "--site-title": {
    key: "site-title",
    label: "site title",
    apply(documents, value) {
      documents.site.title = value;
    },
  },
  "--site-description": {
    key: "site-description",
    label: "site description",
    apply(documents, value) {
      documents.site.description = value;
    },
  },
  "--notes": {
    key: "notes",
    label: "operator notes",
    apply(documents, value) {
      documents.person.notes = value;
    },
  },
  "--seed-url": {
    key: "seed-url",
    label: "seed url",
    apply(documents, value) {
      const source = resolveSourceRecord(documents.person);
      source.url = value;
      source.seedUrls = [value];
    },
  },
  "--theme": {
    key: "theme",
    label: "theme",
    apply(documents, value) {
      const theme = resolveThemeRecord(documents.site);
      const available = ensureStringArray(theme.available);
      if (!available.includes(value)) {
        available.push(value);
      }
      theme.active = value;
      theme.available = available;
    },
  },
} satisfies Record<
  string,
  {
    key: string;
    label: string;
    apply(documents: LoadedPersonDocuments, value: string): void;
  }
>;

type UpdateTaskFlag = keyof typeof UPDATE_TASK_DEFINITIONS;

export const UPDATE_TASK_FLAGS = Object.keys(UPDATE_TASK_DEFINITIONS) as UpdateTaskFlag[];

export const buildRequestedUpdateTasks = (
  options: Map<string, string[]>,
): RequestedUpdateTask[] => {
  const tasks: RequestedUpdateTask[] = [];

  for (const flag of UPDATE_TASK_FLAGS) {
    const definition = UPDATE_TASK_DEFINITIONS[flag];
    const values = options.get(flag) ?? [];

    for (const value of values) {
      tasks.push({
        key: definition.key,
        label: definition.label,
        value,
        apply(documents) {
          definition.apply(documents, value);
        },
      });
    }
  }

  return tasks;
};

export const listSupportedUpdateTasks = (): string[] =>
  UPDATE_TASK_FLAGS.map((flag) => `${flag} (${UPDATE_TASK_DEFINITIONS[flag].label})`);
