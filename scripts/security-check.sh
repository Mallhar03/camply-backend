#!/usr/bin/env bash
# =============================================================================
# security-check.sh
# Local security gate: runs npm audit, TypeScript compiler check, and ESLint.
# Exit code > 0 means the check failed.
# Usage: bash scripts/security-check.sh
# =============================================================================
set -euo pipefail

BOLD="\033[1m"
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RESET="\033[0m"

PASS=0
FAIL=0

run_check() {
  local label="$1"
  shift
  echo -e "\n${BOLD}▶ ${label}${RESET}"
  if "$@"; then
    echo -e "${GREEN}✔ ${label} passed${RESET}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✘ ${label} FAILED${RESET}"
    FAIL=$((FAIL + 1))
  fi
}

echo -e "${BOLD}════════════════════════════════════════${RESET}"
echo -e "${BOLD} Camply Backend – Security Check${RESET}"
echo -e "${BOLD}════════════════════════════════════════${RESET}"

# ── 1. Dependency vulnerability audit ────────────────────────
run_check "NPM Audit (high + critical)" \
  npm audit --audit-level=high

# ── 2. TypeScript type correctness ────────────────────────────
run_check "TypeScript Compiler (tsc --noEmit)" \
  npx tsc --noEmit

# ── 3. ESLint ─────────────────────────────────────────────────
run_check "ESLint" \
  npm run lint

# ── Summary ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════${RESET}"
if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}SECURITY CHECK FAILED${RESET} — ${FAIL} check(s) failed, ${PASS} passed."
  echo -e "${BOLD}════════════════════════════════════════${RESET}"
  exit 1
else
  echo -e "${GREEN}ALL SECURITY CHECKS PASSED${RESET} — ${PASS} check(s) passed."
  echo -e "${BOLD}════════════════════════════════════════${RESET}"
  exit 0
fi
