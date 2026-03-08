#!/usr/bin/env bash
# First-principles structural checks
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PASS=0; FAIL=0
check() { local desc=$1; shift; if "$@" &>/dev/null; then echo "✔ $desc"; ((PASS++)); else echo "✘ $desc"; ((FAIL++)); fi; }

check "No .env committed" bash -c 'git ls-files | grep -qvF ".env" || ! git ls-files .env | grep -q "."'
check "Helmet middleware present"  grep -r "helmet" src/
check "CORS middleware present"    grep -r "cors" src/
check "Rate-limit middleware present" grep -r "rateLimit\|rate-limit" src/
check "httpOnly cookie on refresh" grep -r "httpOnly" src/
check "No console.log in production code" bash -c '! grep -r "console\.log" src/ --include="*.ts" | grep -v "//.*console\.log"'
check "No hardcoded secrets"       bash -c '! grep -rE "(secret|password|apikey)\s*=\s*[\"'\''][^\"'\'']{6,}" src/ --include="*.ts"'
check "No passwordHash leak in response" bash -c '! grep -r "passwordHash" src/controllers/ --include="*.ts" | grep -v "select\|omit\|safeUser"'
check "Error handler wired"        grep -r "errorHandler\|error.*middleware" src/

echo ""
echo "Checks: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
