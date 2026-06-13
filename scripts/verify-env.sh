#!/usr/bin/env bash
# Verifies the Midnight development toolchain is correctly installed.
# Run: bash scripts/verify-env.sh

set -euo pipefail

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  local cmd="$2"
  local expected_pattern="${3:-}"

  if output=$(eval "$cmd" 2>&1); then
    if [[ -n "$expected_pattern" ]] && ! echo "$output" | grep -qE "$expected_pattern"; then
      echo "  WARN  $label — unexpected output: $output"
      ((WARN++))
    else
      echo "  OK    $label — $output"
      ((PASS++))
    fi
  else
    echo "  FAIL  $label — not found or errored"
    ((FAIL++))
  fi
}

echo "=== Midnight Development Environment Check ==="
echo ""

echo "── Node.js / npm"
check "node version (>=20 required)" "node --version" "v2[0-9]\."
check "npm version" "npm --version"
echo ""

echo "── Midnight Compact Compiler"
check "compactc" "compactc --version" ""
echo ""

echo "── Docker"
check "docker daemon running" "docker info --format '{{.ServerVersion}}'" "[0-9]"
check "docker compose" "docker compose version" ""
echo ""

echo "── Midnight Docker images"
check "midnight-node image" \
  "docker images --format '{{.Repository}}:{{.Tag}}' | grep midnight" \
  "midnight"
check "midnight-indexer image" \
  "docker images --format '{{.Repository}}:{{.Tag}}' | grep midnight.*indexer" \
  "indexer" || true
echo ""

echo "── Midnight JS packages (global)"
check "midnight-js-toolchain" \
  "npm list -g @midnight-ntwrk/midnight-js-toolchain 2>/dev/null | grep midnight-js-toolchain" \
  "midnight-js-toolchain" || true
echo ""

echo "=== Summary ==="
echo "  Passed: $PASS"
echo "  Warnings: $WARN"
echo "  Failed: $FAIL"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Next steps:"
  echo "  1. Install Node.js 20+: https://nodejs.org"
  echo "  2. Install Midnight toolchain: npx @midnight-ntwrk/midnight-js-toolchain install"
  echo "  3. Install Docker Desktop: https://docs.docker.com/get-docker/"
  echo "  4. See docs/environment.md for the full setup guide"
  exit 1
fi
