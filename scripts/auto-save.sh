#!/usr/bin/env bash
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[auto-save] This folder is not a git repository."
  exit 1
fi

if ! STATUS_OUTPUT="$(git status --porcelain)"; then
  echo "[auto-save] Unable to read the repository status."
  exit 1
fi
if [ -z "$STATUS_OUTPUT" ]; then
  echo "[auto-save] No changes to commit."
  exit 0
fi

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
COMMIT_MESSAGE="Auto-save: $TIMESTAMP"

echo "[auto-save] Staging changes..."
if ! git add .; then
  echo "[auto-save] Staging changes failed."
  exit 1
fi

if ! git diff --cached --quiet; then
  echo "[auto-save] Creating commit: $COMMIT_MESSAGE"
  if ! git commit -m "$COMMIT_MESSAGE"; then
    echo "[auto-save] Commit failed. Resolve Git errors and retry."
    exit 1
  fi
else
  echo "[auto-save] No staged changes detected after add."
  exit 0
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [ -z "$CURRENT_BRANCH" ]; then
  echo "[auto-save] Unable to determine current branch."
  exit 0
fi

REMOTE_NAME="$(git config --get "branch.$CURRENT_BRANCH.remote" || true)"
REMOTE_NAME="${REMOTE_NAME:-origin}"

if ! git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  echo "[auto-save] Remote '$REMOTE_NAME' is not configured."
  exit 1
fi

echo "[auto-save] Pushing to $REMOTE_NAME/$CURRENT_BRANCH..."
if ! git push "$REMOTE_NAME" "$CURRENT_BRANCH"; then
  echo "[auto-save] Push failed. Check your network connection, remote access, and branch protection, then retry."
  exit 1
fi

echo "[auto-save] Auto-save complete."
