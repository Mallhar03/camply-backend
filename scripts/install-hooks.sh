#!/usr/bin/env bash
# =============================================================================
# install-hooks.sh
# One-time setup: installs git hooks for the backend.
# Run this after cloning the repo: bash scripts/install-hooks.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR="$SCRIPT_DIR/../.git/hooks"

echo "🔗 Installing git hooks from scripts/ → .git/hooks/"

# Make all scripts executable
chmod +x "$SCRIPT_DIR/pre-push.sh"
chmod +x "$SCRIPT_DIR/security-check.sh"
chmod +x "$SCRIPT_DIR/first-principles-check.sh"

# Install pre-push hook
cp "$SCRIPT_DIR/pre-push.sh" "$GIT_HOOKS_DIR/pre-push"
chmod +x "$GIT_HOOKS_DIR/pre-push"

echo "✅ pre-push hook installed at .git/hooks/pre-push"
echo ""
echo "Hooks will run automatically on 'git push'."
echo "To bypass (emergency only): git push --no-verify"
