# Operation

Configuration, what to measure, and what to do when it misbehaves. Procedures that involve the
whole stack are in [04-operations](../04-operations/README.md).

## Configuration

Read by [`indexer/src/config.ts`](../../indexer/src/config.ts). Run locally, the indexer loads a
`.env` file from its own working directory (`indexer/.env`). In production the values come from
`deploy/production/.env` through Docker Compose.

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `CONTRACT_ADDRESS` | **yes** | — | The contract to follow. The process refuses to start without it. |
| `MIDNIGHT_NETWORK_ID` | no | `undeployed` | Network of the Midnight indexer below. Affects address encoding and state parsing; a mismatch is not detected. |
| `MIDNIGHT_INDEXER_WS` | no | `ws://127.0.0.1:8088/api/v4/graphql/ws` | Midnight indexer, WebSocket. The one the indexer uses. |
| `MIDNIGHT_INDEXER_URL` | no | `http://127.0.0.1:8088/api/v4/graphql` | Midnight indexer, HTTP. Read but not used by the indexing code. |
| `DATABASE_URL` | no | `postgresql://poap:poap@localhost:5434/poap_indexer` | Postgres connection string |
| `PORT` | no | `3001` | REST API port |
| `CORS_ALLOWED_ORIGINS` | no | unset (CORS off) | Comma-separated exact origins allowed to call the API from a browser. Never `*`. |
| `CONTRACT_MODULE_PATH` | no | `../../contracts/src/managed/poap/contract/index.js` | Compiled contract used for parsing. Override only if it lives elsewhere, and match the filesystem's casing exactly. |

Per environment:

| | Local devnet | Preprod (production host) |
|---|---|---|
| `MIDNIGHT_NETWORK_ID` | `undeployed` | `preprod` |
| `MIDNIGHT_INDEXER_WS` | `ws://127.0.0.1:8088/api/v4/graphql/ws` | `wss://indexer.preprod.midnight.network/api/v4/graphql/ws` |
| `CONTRACT_ADDRESS` | from `deployments/undeployed.md` | from `deployments/preprod.md` |
| Database | `poap-pg` from `devnet.yml`, port 5434 | `postgres` service, internal network only |

## Logs

The indexer writes plain text to stdout. These lines are the only built-in signal.

| Line | Meaning |
|---|---|
| `[db] applied 001_init.sql` | Migrations ran |
| `[api] listening on …` | REST API is up |
| `[sub] resuming from block N` | Cursor loaded; `0` means a first run |
| `[gql-ws] connected` | WebSocket to the Midnight indexer is open |
| `[state] <entryPoint> @ block N tx …` | One action processed successfully |
| `  [+] token #N minted …`, `[-] event … deactivated`, … | A row was written |
| `[gql-ws] connection closed` / `[gql-ws] error` | Connection lost; a reconnect follows |
| `[sub] error handling event` | **An action was skipped.** Investigate. |
| `[sub] subscription errors` | The Midnight indexer returned GraphQL errors |
| `[sub] fatal subscription error` / `[main] fatal` | The process is about to exit |

```bash
docker compose logs --tail=200 -f indexer
```

## Metrics

**None are exported today.** There is no Prometheus endpoint, and `/health` only reports that
the process is running; it returns `ok` even when indexing is stalled. The metrics below are
what to collect, with a way to get each one from what exists.

| Metric | How to obtain it now |
|---|---|
| Last processed block | `SELECT last_block, updated_at FROM indexer_cursor` |
| Actions processed per minute | Count `[state]` log lines |
| Processing errors | Count `[sub] error handling event` log lines. **Any non-zero value needs attention.** |
| Reconnects | Count `[gql-ws] connection closed` log lines |
| Rows per table | `SELECT count(*) FROM tokens` etc. |
| Process up | `GET /health`, or the container's health status |

### Measuring lag

Do not compute lag as "chain tip minus `last_block`". The cursor only moves when the *contract*
has an action, so on a quiet contract it falls behind the tip without anything being wrong.

Compare against the contract's own latest action instead:

1. Ask the Midnight indexer for the contract's most recent action and note its block height.
2. Compare with `indexer_cursor.last_block`.

Equal means caught up. A cursor that is lower, and stays lower for more than a minute or two, is
real lag. A practical proxy is to compare a value directly: the event count or `totalSupply` on
the ledger against the row counts in the database.

## Alerts

Suggested, since none are configured:

| Alert | Condition | Severity |
|---|---|---|
| Processing error | Any `[sub] error handling event` in the logs | High. A persistent one means indexing has stopped. |
| Stalled | The contract's latest action is newer than the cursor for more than 5 minutes | High |
| Disconnected | No `[gql-ws] connected` within 5 minutes of a `connection closed` | Medium |
| Restart loop | The container restarted more than 3 times in 10 minutes | High |
| API down | `/health` fails | High |
| Disk | Postgres volume above 80 % | Medium. `last_state` and the tables grow with the contract. |

## Runbook

### "The indexer is behind"

Symptom: something visible on-chain is missing from the API.

1. Is it connected? Look for `[gql-ws] connected` after the most recent `connection closed`.
   - Not connected: check the Midnight indexer endpoint and the host's outbound network. The
     client retries on its own.
2. Is it processing? Look for recent `[state]` lines.
   - Processing steadily: it is catching up (after a restart or a reindex). Wait.
3. Are there `[sub] error handling event` lines? Go to "stuck" below.
4. Is the Midnight indexer itself behind the chain? That is upstream; nothing to do locally.
5. Was the missing thing a stateless proof, a reveal or a pause? Those are
   [not indexed](mapping.md#not-indexed).

### "The indexer is stuck"

Symptom: the process is up, `/health` is `ok`, but the cursor does not move while the contract
is active.

1. Read the error:
   ```bash
   docker compose logs --tail=500 indexer | grep -A5 "error handling event"
   ```
2. If the same error repeats on every action, it is persistent:

   | Error | Cause | Fix |
   |---|---|---|
   | `value "…" is out of range for type …` | A value the schema cannot hold. The known case (`Uint<64>` ≥ 2^63 in `max_supply` / `expiration`) is fixed by migration `002_uint64_columns.sql`. | Make sure the running image includes that migration; otherwise widen the column, then restart. A restart alone does not help. |
   | `expected instance of ChargedState`, or other parse errors | The compiled contract does not match the deployed one, or it was loaded twice through different paths | Check out the commit the contract was compiled from and rebuild the image. Check `CONTRACT_MODULE_PATH`. |
   | Foreign key violations | An unexpected state shape | Capture the log and the state, then reindex. |
   | Connection errors to Postgres | Database down or out of disk | Fix Postgres; the next action recovers the gap. |

3. If no errors are logged and nothing is processed, restart the container. It resumes from the
   cursor:
   ```bash
   docker compose restart indexer
   ```
4. If the data is wrong after recovery, [reindex](sync.md#reindexing-from-scratch).

### "There was a reorg"

The indexer does not detect or handle reorgs ([details](sync.md#finality-and-reorgs)).

1. Confirm it: pick the most recent rows and check that their transaction hashes still exist on
   the Midnight indexer.
   ```sql
   SELECT token_id, minted_block, minted_tx FROM tokens ORDER BY minted_block DESC LIMIT 10;
   ```
2. If any are gone, or the row counts disagree with the ledger,
   [reindex from scratch](sync.md#reindexing-from-scratch). There is no partial rollback.
3. Record the block heights involved, to learn whether the Midnight indexer delivers non-final
   blocks.

### "The API disagrees with the chain"

For example an event shown as inactive that is active on-chain, or `minted` lower than the
number of tokens.

Versions of the indexer before the [fixes listed here](mapping.md#fixed) could write such rows,
and updating the code does not rewrite them. If the database was filled by an older version:

1. Confirm the running image contains the fixes (`indexer/db/migrations/002_uint64_columns.sql`
   exists in the checkout).
2. [Reindex from scratch](sync.md#reindexing-from-scratch).
3. Run the consistency query in [After a reindex](sync.md#after-a-reindex); it should return no
   rows.

If the database was filled by the current version and still disagrees, it is a new bug: capture
the logs and the affected rows before reindexing.

### After any incident

Write down what happened and the block heights involved. The database is rebuildable, so when in
doubt, reindex and run the consistency query afterwards.
