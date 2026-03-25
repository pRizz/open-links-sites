#!/usr/bin/env bash
set -euo pipefail

message=""
push_ref="main"
output_key=""
user_name="github-actions[bot]"
user_email="41898282+github-actions[bot]@users.noreply.github.com"
add_args=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --message)
      message="${2:-}"
      shift 2
      ;;
    --push-ref)
      push_ref="${2:-}"
      shift 2
      ;;
    --output-key)
      output_key="${2:-}"
      shift 2
      ;;
    --user-name)
      user_name="${2:-}"
      shift 2
      ;;
    --user-email)
      user_email="${2:-}"
      shift 2
      ;;
    --)
      shift
      add_args=("$@")
      break
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$message" || ${#add_args[@]} -eq 0 ]]; then
  echo "Usage: $0 --message <message> [--push-ref <ref>] [--output-key <key>] -- <git add args...>" >&2
  exit 1
fi

git config user.name "$user_name"
git config user.email "$user_email"
git add "${add_args[@]}"

if git diff --cached --quiet; then
  if [[ -n "$output_key" && -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "${output_key}=false" >> "$GITHUB_OUTPUT"
  fi
  exit 0
fi

git commit -m "$message"
git push origin "HEAD:${push_ref}"

if [[ -n "$output_key" && -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "${output_key}=true" >> "$GITHUB_OUTPUT"
fi
