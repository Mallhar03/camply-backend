#!/usr/bin/env bash
# =============================================================================
# pre-push.sh
# Git pre-push hook: runs the full check suite before allowing a push.
# Gives developers a chance to catch issues before they hit CI.
# =============================================================================
set -euo pipefail

BOLD="\033[1m"
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   Camply Pre-Push Quality Gate           ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo -e "${YELLOW}Running full check suite before push...${RESET}"
echo ""

# Navigate to the git repo root (backend directory)
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO_ROOT" ]; then
  echo -e "${RED}Could not determine repo root. Skipping pre-push hook.${RESET}"
  exit 0
fi
cd "$REPO_ROOT"

FAILURES=0

run_step() {
  local label="$1"
  shift
  echo -e "${BOLD}▶ ${label}${RESET}"
  if "$@"; then
    echo -e "${GREEN}✔ ${label} passed${RESET}\n"
  else
    echo -e "${RED}✘ ${label} FAILED${RESET}\n"
    FAILURES=$((FAILURES + 1))
  fi
}

# Step 1: Unit + Integration Tests
run_step "Test Suite (vitest)" npx vitest run

# Step 2: Security checks
run_step "Security Checks" bash scripts/security-check.sh

# Step 3: First-principles checks
run_step "First-Principles Checks" bash scripts/first-principles-check.sh

# ── Result ────────────────────────────────────────────────────
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
if [ "$FAILURES" -gt 0 ]; then
  echo -e "${BOLD}║  ${RED}PUSH BLOCKED — ${FAILURES} step(s) failed${RESET}${BOLD}         ║${RESET}"
  echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
  echo -e "${YELLOW}Fix the issues above then try again.${RESET}"
  echo -e "${YELLOW}To bypass (emergency only): git push --no-verify${RESET}"
  exit 1
else
  echo -e "${BOLD}║  ${GREEN}ALL CHECKS PASSED — push allowed ✔${RESET}${BOLD}      ║${RESET}"
  echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
  exit 0
fi
