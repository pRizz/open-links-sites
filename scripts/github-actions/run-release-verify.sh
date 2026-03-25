#!/usr/bin/env bash
set -euo pipefail

root_dir="${ROOT_DIR:-${GITHUB_WORKSPACE:-$PWD}}"
public_origin="${PUBLIC_ORIGIN:-}"
summary_file="${SUMMARY_FILE:-.cache/release-verify-summary.txt}"
event_name="${EVENT_NAME:-${GITHUB_EVENT_NAME:-}}"
changed_paths_file="${CHANGED_PATHS_FILE:-}"
canonical_origin="${CANONICAL_ORIGIN:-}"

if [[ -z "$public_origin" ]]; then
  echo "PUBLIC_ORIGIN must be set." >&2
  exit 1
fi

command=(
  bun
  run
  release:verify
  --
  --root
  "$root_dir"
  --public-origin
  "$public_origin"
)

if [[ -n "$event_name" ]]; then
  command+=(--event-name "$event_name")
fi

if [[ -n "$canonical_origin" ]]; then
  command+=(--canonical-origin "$canonical_origin")
fi

if [[ -n "$changed_paths_file" ]]; then
  command+=(--changed-paths-file "$changed_paths_file")
fi

"$(dirname "$0")/run-and-capture.sh" "$summary_file" "${command[@]}"
