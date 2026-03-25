#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <summary-file> <command> [args...]" >&2
  exit 1
fi

summary_file="$1"
shift

mkdir -p "$(dirname "$summary_file")"
"$@" | tee "$summary_file"
