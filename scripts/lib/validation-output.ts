export type ValidationSeverity = "problem" | "warning" | "suggestion";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  personId: string;
  file?: string;
  path?: string;
}

export interface PersonValidationResult {
  personId: string;
  directoryName: string;
  directoryPath: string;
  enabled: boolean | null;
  issues: ValidationIssue[];
}

export interface ValidationTotals {
  people: number;
  validPeople: number;
  invalidPeople: number;
  problems: number;
  warnings: number;
  suggestions: number;
}

export interface ValidationRunResult {
  valid: boolean;
  people: PersonValidationResult[];
  totals: ValidationTotals;
}

const groupIssues = (issues: ValidationIssue[]): Record<ValidationSeverity, ValidationIssue[]> => ({
  problem: issues.filter((issue) => issue.severity === "problem"),
  warning: issues.filter((issue) => issue.severity === "warning"),
  suggestion: issues.filter((issue) => issue.severity === "suggestion"),
});

export const buildValidationTotals = (results: PersonValidationResult[]): ValidationTotals => {
  const allIssues = results.flatMap((result) => result.issues);
  const problems = allIssues.filter((issue) => issue.severity === "problem").length;
  const warnings = allIssues.filter((issue) => issue.severity === "warning").length;
  const suggestions = allIssues.filter((issue) => issue.severity === "suggestion").length;
  const invalidPeople = results.filter((result) =>
    result.issues.some((issue) => issue.severity === "problem"),
  ).length;

  return {
    people: results.length,
    validPeople: results.length - invalidPeople,
    invalidPeople,
    problems,
    warnings,
    suggestions,
  };
};

export const formatValidationRunHuman = (result: ValidationRunResult): string => {
  const lines: string[] = [];

  lines.push("Open Links Sites Validation");
  lines.push("");
  lines.push(
    `People: ${result.totals.people} | valid: ${result.totals.validPeople} | invalid: ${result.totals.invalidPeople}`,
  );
  lines.push(
    `Problems: ${result.totals.problems} | warnings: ${result.totals.warnings} | suggestions: ${result.totals.suggestions}`,
  );

  if (result.people.length === 0) {
    lines.push("");
    lines.push("No people discovered under people/*/person.json.");
    return lines.join("\n");
  }

  for (const person of result.people) {
    const groups = groupIssues(person.issues);
    const hasProblems = groups.problem.length > 0;

    lines.push("");
    lines.push(`${hasProblems ? "FAIL" : "OK"} ${person.personId} (${person.directoryName})`);

    if (person.issues.length === 0) {
      lines.push("  No issues.");
      continue;
    }

    for (const severity of ["problem", "warning", "suggestion"] as const) {
      const issues = groups[severity];
      if (issues.length === 0) {
        continue;
      }

      lines.push(`  ${severity[0].toUpperCase()}${severity.slice(1)}s:`);
      for (const issue of issues) {
        const path = issue.path ? ` [${issue.path}]` : "";
        lines.push(`    - (${issue.code})${path} ${issue.message}`);
      }
    }
  }

  return lines.join("\n");
};

export const formatValidationRunJson = (result: ValidationRunResult): string =>
  JSON.stringify(result, null, 2);
