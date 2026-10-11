#!/usr/bin/env bash
# Uptime of one deployment from the run history of its uptime workflow.
#
#   scripts/uptime-report.sh <mainnet|preprod> [days, default 30]
#
# Needs the GitHub CLI, authenticated. Each completed run is one sample; uptime is the share of
# successful ones. Cancelled and skipped runs are left out. Expect fewer samples than 288 a day:
# GitHub starts scheduled runs late or drops them when it is busy.
set -euo pipefail

NETWORK=${1:?mainnet or preprod}
DAYS=${2:-30}
SINCE=$(date -u -d "$DAYS days ago" +%Y-%m-%dT%H:%M:%SZ)
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

gh api --paginate \
  "repos/$REPO/actions/workflows/uptime-$NETWORK.yml/runs?status=completed&created=>=$SINCE&per_page=100" \
  -q '.workflow_runs[] | [.created_at, .conclusion] | @tsv' |
  awk -F'\t' -v net="$NETWORK" -v days="$DAYS" '
    $2 == "success" { ok++; n++ }
    $2 == "failure" || $2 == "timed_out" { n++; if (!first_fail) first_fail = $1; fails = fails "\n  " $1 }
    END {
      if (!n) { print "No completed runs for " net " in the last " days " days."; exit }
      printf "%s, last %s days: %d samples, %d passed, %d failed, uptime %.2f%%\n", net, days, n, ok, n - ok, 100 * ok / n
      if (n - ok) print "Failed samples (UTC):" fails
    }'
