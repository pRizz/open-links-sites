#!/usr/bin/env bash
set -euo pipefail

changed_paths_file="${CHANGED_PATHS_FILE:-.cache/changed-paths.txt}"
base_sha="${BASE_SHA:-${GITHUB_EVENT_BEFORE:-}}"
head_sha="${HEAD_SHA:-${GITHUB_SHA:-}}"
null_sha="0000000000000000000000000000000000000000"

mkdir -p "$(dirname "$changed_paths_file")"

if [[ -z "$head_sha" ]]; then
  head_sha="$(git rev-parse HEAD)"
fi

if [[ -z "$base_sha" || "$base_sha" == "$null_sha" ]]; then
  git ls-files > "$changed_paths_file"
else
  git diff --name-only "$base_sha" "$head_sha" > "$changed_paths_file"
fi
