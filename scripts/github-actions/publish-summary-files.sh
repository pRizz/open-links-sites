#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo "GITHUB_STEP_SUMMARY must be set." >&2
  exit 1
fi

for file_path in "$@"; do
  if [[ -f "$file_path" ]]; then
    cat "$file_path" >> "$GITHUB_STEP_SUMMARY"
    printf '\n' >> "$GITHUB_STEP_SUMMARY"
  fi
done
