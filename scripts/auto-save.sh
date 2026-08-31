#!/usr/bin/env bash
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[auto-save] This folder is not a git repository."
  exit 1
fi

STATUS_OUTPUT="$(git status --porcelain)"
if [ -z "$STATUS_OUTPUT" ]; then
  echo "[auto-save] No changes to commit."
  exit 0
fi

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
COMMIT_MESSAGE="Auto-save: $TIMESTAMP"

echo "[auto-save] Staging changes..."
git add .

if ! git diff --cached --quiet; then
  echo "[auto-save] Creating commit: $COMMIT_MESSAGE"
  if ! git commit -m "$COMMIT_MESSAGE"; then
    echo "[auto-save] Commit failed. There may be nothing new to commit after staging."
    exit 0
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

echo "[auto-save] Pushing to origin/$CURRENT_BRANCH..."
if ! git push origin "$CURRENT_BRANCH"; then
  echo "[auto-save] Push failed. This is usually due to no remote, auth issues, or offline mode."
  exit 0
fi

echo "[auto-save] Auto-save complete."
