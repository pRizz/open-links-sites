#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${OPEN_LINKS_REPO_DIR:-}" ]]; then
  echo "OPEN_LINKS_REPO_DIR must be set." >&2
  exit 1
fi

cd "$OPEN_LINKS_REPO_DIR"
bun install --frozen-lockfile
