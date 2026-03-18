export const formatStageSummary = (title: string, entries: Array<string | undefined>): string =>
  [title, ...entries.filter((entry): entry is string => Boolean(entry))].join("\n");
