#!/usr/bin/env bash
# Security checks: audit, TypeScript, ESLint
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "▶ npm audit (high+critical)"
npm audit --audit-level=high --omit=dev
echo "✔ npm audit passed"

echo "▶ TypeScript compile check"
npx tsc --noEmit
echo "✔ TypeScript passed"

echo "▶ ESLint"
npx eslint . --max-warnings=5
echo "✔ ESLint passed"
