#!/usr/bin/env bash
set -euo pipefail

state_path="${UPSTREAM_STATE_PATH:-config/upstream-open-links.json}"
upstream_remote_url="${UPSTREAM_REMOTE_URL:-https://github.com/pRizz/open-links.git}"
upstream_ref="${UPSTREAM_REF:-refs/heads/main}"
summary_file="${SUMMARY_FILE:-.cache/upstream-preflight-summary.txt}"

mkdir -p "$(dirname "$summary_file")"

tracked_commit="$(python3 -c 'import json, pathlib, sys; print(json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf8"))["commit"])' "$state_path")"
latest_commit="$(git ls-remote "$upstream_remote_url" "$upstream_ref" | awk '{print $1}')"

if [[ -z "$latest_commit" ]]; then
  echo "Unable to resolve upstream open-links main HEAD." >&2
  exit 1
fi

changed=true
action="continue with full upstream sync"
if [[ "$tracked_commit" == "$latest_commit" ]]; then
  changed=false
  action="skip clone/install/verify because the pinned upstream commit is already current"
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "changed=$changed"
    echo "tracked_commit=$tracked_commit"
    echo "latest_commit=$latest_commit"
  } >> "$GITHUB_OUTPUT"
fi

printf '%s\n' \
  '## Upstream Preflight' \
  "- Tracked commit: \`${tracked_commit:0:12}\`" \
  "- Latest commit: \`${latest_commit:0:12}\`" \
  "- Upstream changed: \`${changed}\`" \
  "- Action: ${action}" \
  > "$summary_file"
