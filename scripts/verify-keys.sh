#!/usr/bin/env bash
#
# Regenerates the POAP contract's keys/zkir/contract artifacts into a scratch
# directory using the exact compiler version pinned in contracts/package.json
# (currently 0.31.1, matching contracts/src/managed/poap/compiler/contract-info.json),
# then diffs the result against the checked-out contracts/src/managed/poap/
# to confirm the committed build artifacts are reproducible from source.
#
# Key generation is fully self-contained in the compact compiler toolchain per
# pinned version — it does NOT need the proof-server container running or any
# public_params.bin extracted from it. The proof-server only consumes the
# resulting .zkir circuits at runtime to produce/verify proofs; it plays no
# role in generating them. See: midnight-tooling:proof-server skill.
#
# Usage:
#   scripts/verify-keys.sh            # full compile incl. proving keys (slow)
#   scripts/verify-keys.sh --skip-zk  # fast: only compares contract/ + compiler/ (no keys/zkir)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts"
MANAGED_DIR="$CONTRACTS_DIR/src/managed/poap"
COMPILE_SCRIPT="$(node -pe "require('$CONTRACTS_DIR/package.json').scripts.compact")"

if [[ -z "$COMPILE_SCRIPT" || "$COMPILE_SCRIPT" == "undefined" ]]; then
  echo "error: couldn't read contracts/package.json's \"compact\" script" >&2
  exit 1
fi

# COMPILE_SCRIPT looks like: compact compile +0.31.1 compact/poap.compact src/managed/poap/
read -r -a PARTS <<< "$COMPILE_SCRIPT"
COMPILER_ARG="${PARTS[2]}"          # e.g. +0.31.1
SOURCE_REL="${PARTS[3]}"            # e.g. compact/poap.compact

SKIP_ZK_FLAG=()
[[ "${1:-}" == "--skip-zk" ]] && SKIP_ZK_FLAG=(--skip-zk)

# Compile into a scratch dir passed as a RELATIVE path with the same path-
# component depth as the real target (src/managed/poap/, 3 components) — the
# compiler derives index.js.map's sourceRoot from the literal source/target-dir
# argument strings (not filesystem depth after resolution), so an absolute
# scratch path — or one with different depth — produces a cosmetically
# different sourceRoot even when every other byte is identical.
SCRATCH_REL=".verify-keys-scratch/a/b"
SCRATCH="$CONTRACTS_DIR/$SCRATCH_REL"
mkdir -p "$SCRATCH"
if [[ -z "${VERIFY_KEYS_KEEP_SCRATCH:-}" ]]; then
  trap 'rm -rf "$CONTRACTS_DIR/.verify-keys-scratch"' EXIT
fi

echo "== compiler pin =="
echo "  command   : $COMPILE_SCRIPT"
echo "  installed?: $(compact list --installed 2>&1 | grep -F "${COMPILER_ARG#+}" || echo 'NOT INSTALLED')"

echo
echo "== compiling into scratch dir =="
echo "  $SCRATCH"
(
  cd "$CONTRACTS_DIR"
  compact compile "$COMPILER_ARG" "${SKIP_ZK_FLAG[@]}" "$SOURCE_REL" "$SCRATCH_REL"
)

echo
echo "== diffing regenerated output vs. checked-out $MANAGED_DIR =="

status=0

diff_dir() {
  local sub="$1"
  if [[ ! -d "$MANAGED_DIR/$sub" && ! -d "$SCRATCH/$sub" ]]; then
    return 0
  fi
  if ! diff -rq "$MANAGED_DIR/$sub" "$SCRATCH/$sub" 2>&1; then
    status=1
  fi
}

diff_dir "compiler"
diff_dir "contract"
if [[ ${#SKIP_ZK_FLAG[@]} -eq 0 ]]; then
  diff_dir "zkir"
  diff_dir "keys"
fi

echo
if [[ $status -eq 0 ]]; then
  echo "OK: regenerated artifacts are byte-identical to contracts/src/managed/poap/"
else
  echo "MISMATCH: regenerated artifacts differ from contracts/src/managed/poap/ (see diff above)"
fi

exit $status
