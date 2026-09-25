#!/usr/bin/env bash
# Copies the ZK artifacts for the compiled contract into deploy/production/zk/poap/, which Caddy
# serves at https://$API_DOMAIN/zk/poap/{keys,zkir}/... for the frontend.
#
# Source: contracts/src/managed/poap/ (keys/ is gitignored — generate it with
# `cd contracts && npm run compact`, or unzip a keys bundle there first).
# Run on whichever machine has the keys, then copy deploy/production/zk/ to the server
# (see README.md). Refuses to produce a partial set.
set -euo pipefail
cd "$(dirname "$0")/../.."

SRC=contracts/src/managed/poap
DEST=deploy/production/zk/poap

circuits=$(node -e "
  const info = require('./$SRC/compiler/contract-info.json');
  console.log(info.circuits.filter((c) => c.proof).map((c) => c.name).join(' '));
")

missing=0
for c in $circuits; do
  for f in "$SRC/keys/$c.prover" "$SRC/keys/$c.verifier" "$SRC/zkir/$c.bzkir"; do
    [ -f "$f" ] || { echo "missing: $f" >&2; missing=1; }
  done
done
[ "$missing" -eq 0 ] || { echo "aborting: incomplete ZK artifacts" >&2; exit 1; }

rm -rf "$DEST"
mkdir -p "$DEST/keys" "$DEST/zkir"
for c in $circuits; do
  cp "$SRC/keys/$c.prover" "$SRC/keys/$c.verifier" "$DEST/keys/"
  cp "$SRC/zkir/$c.bzkir" "$SRC/zkir/$c.zkir" "$DEST/zkir/"
done
(cd "$DEST" && find . -type f ! -name SHA256SUMS | sort | xargs sha256sum > SHA256SUMS)
echo "synced $(echo $circuits | wc -w) circuits into $DEST ($(du -sh "$DEST" | cut -f1))"
