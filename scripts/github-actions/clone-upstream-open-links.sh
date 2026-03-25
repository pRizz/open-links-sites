#!/usr/bin/env bash
set -euo pipefail

upstream_repo_dir="${UPSTREAM_REPO_DIR:-${RUNNER_TEMP:-/tmp}/open-links}"
upstream_remote_url="${UPSTREAM_REMOTE_URL:-https://github.com/pRizz/open-links.git}"
upstream_branch="${UPSTREAM_BRANCH:-}"
upstream_commit="${UPSTREAM_COMMIT:-}"

rm -rf "$upstream_repo_dir"

clone_args=(clone --filter=blob:none --no-tags)
if [[ -n "$upstream_branch" ]]; then
  clone_args+=(--branch "$upstream_branch")
fi
clone_args+=("$upstream_remote_url" "$upstream_repo_dir")

git "${clone_args[@]}"

if [[ -n "$upstream_commit" ]]; then
  git -C "$upstream_repo_dir" checkout --detach "$upstream_commit"
fi

if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "OPEN_LINKS_REPO_DIR=$upstream_repo_dir" >> "$GITHUB_ENV"
fi
