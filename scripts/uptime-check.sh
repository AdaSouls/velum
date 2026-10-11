#!/usr/bin/env bash
# External uptime check for one Velum deployment. Run every 5 minutes by
# .github/workflows/uptime-<network>.yml; also fine to run by hand.
#
#   scripts/uptime-check.sh <network> <site url> <api url> <contract address>
#
# Checks (docs/04-operations/monitoring-runbooks.md, checks 1, 2 and 5, plus the web app):
#   site       GET <site>                 200
#   health     GET <api>/health           200 and {"status":"ok"}
#   events     GET <api>/api/events       200 and a JSON array
#   freshness  <api>/api/status lastBlock vs the contract's latest action on Midnight's indexer.
#              Stale when the indexer is behind an action that is more than 5 minutes old.
#
# Prints one line per check:  UPTIME <utc time> <network> <check> <pass|fail|unknown> <ms> <detail>
# and exits 1 if any check failed, so the workflow run's conclusion is the uptime sample.
set -uo pipefail

NETWORK=${1:?network}; SITE=${2:?site url}; API=${3:?api url}; CONTRACT=${4:?contract address}
STALE_AFTER_SECONDS=300
failed=0
summary=${GITHUB_STEP_SUMMARY:-/dev/null}
body=$(mktemp)
trap 'rm -f "$body"' EXIT

record() { # check result ms detail
  printf 'UPTIME %s %s %s %s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$NETWORK" "$1" "$2" "$3" "$4"
  printf '| %s | %s | %s ms | %s |\n' "$1" "$2" "$3" "$4" >> "$summary"
  [ "$2" = fail ] && failed=1
  return 0
}

# Sets $code and $ms; the response body goes to $body.
fetch() {
  local out
  out=$(curl -s -o "$body" -w '%{http_code} %{time_total}' --max-time 20 "$@") || out="000 20"
  code=${out%% *}
  ms=$(awk -v t="${out##* }" 'BEGIN { printf "%d", t * 1000 }')
}

{ echo "### Velum uptime: $NETWORK"; echo; echo '| Check | Result | Time | Detail |'; echo '|---|---|---|---|'; } >> "$summary"

fetch "$SITE"
if [ "$code" = 200 ]; then record site pass "$ms" "HTTP 200"; else record site fail "$ms" "HTTP $code"; fi

fetch "$API/health"
if [ "$code" = 200 ] && [ "$(jq -r '.status // empty' "$body" 2>/dev/null)" = ok ]; then
  record health pass "$ms" "HTTP 200"
else
  record health fail "$ms" "HTTP $code"
fi

fetch "$API/api/events"
if [ "$code" = 200 ] && jq -e 'type == "array"' "$body" >/dev/null 2>&1; then
  record events pass "$ms" "HTTP 200, $(jq length "$body") events"
else
  record events fail "$ms" "HTTP $code"
fi

# Freshness. The contract's latest action, from Midnight's indexer through the API host's proxy.
query=$(jq -cn --arg a "$CONTRACT" '{query: "{ contractAction(address: \"\($a)\") { transaction { block { height timestamp } } } }"}')
fetch -X POST -H 'content-type: application/json' -d "$query" "$API/midnight/indexer"
chain_ms=$ms
action_block=$(jq -r '.data.contractAction.transaction.block.height // empty' "$body" 2>/dev/null)
action_time=$(jq -r '.data.contractAction.transaction.block.timestamp // empty' "$body" 2>/dev/null)
if [ "$code" != 200 ] || [ -z "$action_block" ]; then
  record freshness fail "$chain_ms" "Midnight indexer did not return the contract (HTTP $code)"
else
  fetch "$API/api/status"
  indexed_block=$(jq -r '.lastBlock // empty' "$body" 2>/dev/null)
  action_age=$(( $(date +%s) - action_time / 1000 ))
  if [ "$code" = 404 ]; then
    # An API host that predates /api/status. Not a failure of the service being measured.
    record freshness unknown "$ms" "/api/status not deployed; chain's latest action is block $action_block"
  elif [ "$code" != 200 ] || [ -z "$indexed_block" ]; then
    record freshness fail "$ms" "/api/status HTTP $code"
  elif [ "$indexed_block" -ge "$action_block" ]; then
    record freshness pass "$ms" "indexed block $indexed_block, chain's latest action $action_block"
  elif [ "$action_age" -le "$STALE_AFTER_SECONDS" ]; then
    record freshness pass "$ms" "catching up: indexed $indexed_block, latest action $action_block is ${action_age}s old"
  else
    record freshness fail "$ms" "stale: indexed $indexed_block, latest action $action_block is ${action_age}s old"
  fi
fi

exit "$failed"
