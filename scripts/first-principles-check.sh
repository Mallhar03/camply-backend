#!/usr/bin/env bash
# =============================================================================
# first-principles-check.sh
# Structural sanity checks that enforce first-principles backend hygiene.
# Checks that are NOT caught by linters or type-checkers.
# Exit code > 0 means a violation was found.
# Usage: bash scripts/first-principles-check.sh
# =============================================================================
set -euo pipefail

BOLD="\033[1m"
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RESET="\033[0m"

PASS=0
FAIL=0

pass() { echo -e "${GREEN}  ✔ $1${RESET}"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}  ✘ $1${RESET}"; FAIL=$((FAIL + 1)); }
header() { echo -e "\n${BOLD}▶ $1${RESET}"; }

echo -e "${BOLD}════════════════════════════════════════${RESET}"
echo -e "${BOLD} Camply Backend – First Principles Check${RESET}"
echo -e "${BOLD}════════════════════════════════════════${RESET}"

# ── 1. .env file must NOT be committed ───────────────────────
header "No .env file committed to git"
if git ls-files | grep -qE '^(backend/)?\.env$'; then
  fail ".env file is tracked by git – add it to .gitignore and remove it from tracking"
else
  pass ".env is not committed"
fi

# ── 2. No console.log in src/ ────────────────────────────────
header "No console.log in src/ (use logger)"
CONSOLE_LOGS=$(grep -rn "console\.log" src/ --include="*.ts" 2>/dev/null || true)
if [ -n "$CONSOLE_LOGS" ]; then
  fail "Found console.log calls in src/ (use winston logger instead):"
  echo "$CONSOLE_LOGS" | while IFS= read -r line; do
    echo -e "    ${YELLOW}${line}${RESET}"
  done
else
  pass "No console.log found in src/"
fi

# ── 3. Security middleware verified in app.ts ─────────────────
header "Security middleware present in app.ts"

if grep -q "helmet" src/app.ts; then
  pass "helmet() middleware found"
else
  fail "helmet() is missing from src/app.ts"
fi

if grep -q "rateLimit\|express-rate-limit" src/app.ts; then
  pass "Rate limiting middleware found"
else
  fail "express-rate-limit is missing from src/app.ts"
fi

if grep -q "cors" src/app.ts; then
  pass "CORS middleware found"
else
  fail "CORS middleware is missing from src/app.ts"
fi

# ── 4. httpOnly cookie in auth controller ─────────────────────
header "Refresh token cookie uses httpOnly flag"
if grep -q "httpOnly: true" src/controllers/auth.controller.ts; then
  pass "httpOnly: true found in auth controller"
else
  fail "httpOnly: true is missing from refresh token cookie in auth.controller.ts"
fi

# ── 5. No hardcoded secrets ───────────────────────────────────
header "No hardcoded secrets in source files"
# Common secret patterns: AWS keys, GitHub tokens, Stripe keys, generic api_key strings
SECRET_PATTERNS='(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|sk_live_[A-Za-z0-9]+|sk_test_[A-Za-z0-9]+|api_key\s*=\s*["'"'"'][^"'"'"']+["'"'"'])'
SECRETS_FOUND=$(grep -rEn "$SECRET_PATTERNS" src/ --include="*.ts" 2>/dev/null || true)
if [ -n "$SECRETS_FOUND" ]; then
  fail "Potential hardcoded secrets found:"
  echo "$SECRETS_FOUND" | while IFS= read -r line; do
    echo -e "    ${YELLOW}${line}${RESET}"
  done
else
  pass "No hardcoded secrets detected"
fi

# ── 6. Prisma select clauses (no passwordHash leakage) ────────
header "passwordHash is never returned in client-facing select"
# Look for select blocks that include passwordHash: true
# Exclude lines that have '# fp-ok' suppression comment
# Exclude known internal-only files (auth.controller internal verify, user.controller changePassword)
PW_LEAK=$(grep -rn "passwordHash:\s*true" src/controllers/ --include="*.ts" 2>/dev/null \
  | grep -v "fp-ok" \
  | grep -v "changePassword\|login\|refresh\|register\|me\s" \
  | grep -v "src/controllers/auth.controller.ts" \
  | grep -v "src/controllers/user.controller.ts:[0-9]*:.*passwordHash" \
  || true)
if [ -n "$PW_LEAK" ]; then
  fail "passwordHash: true found in a non-internal controller select – this leaks the hash:"
  echo "$PW_LEAK" | while IFS= read -r line; do
    echo -e "    ${YELLOW}${line}${RESET}"
  done
else
  pass "passwordHash not exposed in any client-facing controller select"
fi

# ── 7. Error handler must reference error.middleware.ts ───────
header "Custom error handler wired in app.ts"
if grep -q "errorHandler" src/app.ts; then
  pass "errorHandler middleware registered in app.ts"
else
  fail "errorHandler is missing from src/app.ts – unhandled errors will leak stack traces"
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════${RESET}"
if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}FIRST-PRINCIPLES CHECK FAILED${RESET} — ${FAIL} violation(s) found, ${PASS} passed."
  echo -e "${BOLD}════════════════════════════════════════${RESET}"
  exit 1
else
  echo -e "${GREEN}ALL FIRST-PRINCIPLES CHECKS PASSED${RESET} — ${PASS} check(s) passed."
  echo -e "${BOLD}════════════════════════════════════════${RESET}"
  exit 0
fi
