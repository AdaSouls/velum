# Sync and consistency

How the indexer starts, catches up, recovers, and what it does when something goes wrong. Where
a safeguard does not exist, this page says so.

## Start-up and backfill

| Situation | Cursor | Subscription offset | Previous state for the diff |
|---|---|---|---|
| First run (empty database) | `last_block = 0`, `last_state = NULL` | none | empty ledger |
| Restart | `last_block = N`, `last_state` set | `{ height: N }` | parsed from `last_state` |

- **There is no configured start block.** On a first run the subscription is opened without an
  offset and the Midnight indexer delivers the contract's actions from its first one, the
  deployment. You do not need to know the deployment block.
- **Backfill and live indexing are the same code path.** The subscription replays history and
  then keeps delivering new actions on the same stream. There is no separate backfill job and no
  "caught up" signal.
- **On restart** the subscription resumes from the saved block height. Actions in that block may
  be delivered again; that is safe (see [Idempotency](#idempotency)).
- **Actions are processed one at a time, in arrival order**, during backfill as well as live.
  The subscription handler queues them, so each action is diffed against the state the previous
  one left.

## Finality and reorgs

**The indexer has no reorg handling.**

- It waits for no confirmations. Each action is written as soon as the Midnight indexer delivers
  it.
- It stores no block hashes, so it cannot detect that a block it processed was replaced.
- It has no rollback: nothing deletes or reverts rows.

It therefore relies entirely on the Midnight indexer to deliver only data that will not be
reverted. Whether the `contractActions` subscription can emit actions from non-final blocks has
not been verified for this project. Until it is, treat a suspected reorg as a reason to
[reindex](#reindexing-from-scratch).

What a missed reorg would look like: rows whose `*_tx` hash no longer exists on-chain, or values
that disagree with the contract's current state. The next action processed after the reorg
repairs part of the damage on its own, because diffs are computed against the full current
state: entries that appear are inserted and changed events are updated. Rows that should no
longer exist are never removed, and a burn that was reverted stays marked as burned.

## Idempotency

Processing the same action twice leaves the database unchanged.

| Write | Why it is safe to repeat |
|---|---|
| Inserts (events, tokens, requests, nullifiers) | `ON CONFLICT DO NOTHING` on the primary key |
| Issuer upserts | `ON CONFLICT DO UPDATE` sets absolute values; block and transaction columns keep their first value (`COALESCE`) |
| Updates (`minted`, `is_active`, `is_burned`, block/tx columns) | They set absolute values taken from the state, not increments |
| Cursor | Overwrites the single row |

In addition, a replayed action is diffed against the state saved in the cursor. If it is the
action that produced that state, the diff is empty and nothing is written.

One subtlety: the cursor stores a block height, not a position within the block. If a block
contains several actions for the contract and the indexer restarts, the earlier actions of that
block are replayed against a *later* saved state. The diff then briefly goes "backwards" (for
example `minted` is set to an older value) and is corrected by the following action. The end
result is correct once the block has been replayed.

### Atomicity

- All row changes for one action happen in one database transaction.
- The cursor is saved in a **separate** statement afterwards. A crash between the two means the
  action is processed again on restart, which idempotency makes harmless.

## Reconnects and retries

| Failure | Behaviour |
|---|---|
| WebSocket drops | `graphql-ws` reconnects indefinitely with back-off: 1 s, 2 s, 4 s, 8 s, 16 s, then every 30 s. The back-off resets on a successful connection. |
| Midnight indexer unreachable at start | Same retry loop. The REST API is already up and serves the existing data. |
| GraphQL errors inside a message | Logged (`[sub] subscription errors`), the message is skipped. |
| Fatal subscription error | Logged, the process exits with status 1. Docker restarts it (`restart: unless-stopped`). |
| Postgres unreachable at start | Migrations fail, the process exits, Docker restarts it. |
| Database error while processing an action | The transaction is rolled back, the error is logged (`[sub] error handling event`), and the action is **skipped**. |

There is no retry of a failed action and no dead-letter queue.

## What happens with data it cannot process

**It logs and skips. It does not stop.**

When handling an action throws, for any reason:

1. The database transaction is rolled back.
2. The error is logged.
3. The cursor is **not** advanced and the in-memory "previous state" is **not** updated.
4. The indexer waits for the next action.

Because the next action is diffed against the last *successfully* processed state, its diff
includes everything the failed action changed. Two outcomes follow:

| Kind of failure | Result |
|---|---|
| **Transient** (a database hiccup) | Self-healing. The next action applies both sets of changes. The skipped action's changes are attributed to the later transaction and block. |
| **Persistent** (a value the schema cannot hold, or a state the compiled contract cannot parse) | Every following action fails the same way. Indexing is stalled, while the process stays up, the API keeps answering and `/health` keeps returning `ok`. |

A persistent failure is silent unless someone watches the logs or the cursor. The known trigger
is a compiled contract in the image that does not match the deployed contract's ledger layout.
(Out-of-range `Uint<64>` values used to be another; see
[fixed bug 3](mapping.md#fixed).)

## Reindexing from scratch

The database holds nothing that is not on-chain, so it can always be rebuilt.

**Production:**

```bash
cd /opt/velum/poap-midnight/deploy/production
docker compose down
docker volume rm velum_pgdata
docker compose up -d --build
docker compose logs -f indexer      # watch the replay
```

**Local:**

```bash
docker compose -f devnet.yml down -v       # wipes the devnet and the indexer database
# or, to keep the chain and reset only the indexer's tables:
psql postgresql://poap:poap@localhost:5434/poap_indexer -c \
  "TRUNCATE tokens, events, issuers, disclosure_requests, disclosure_nullifiers, indexer_cursor CASCADE;
   INSERT INTO indexer_cursor (id) VALUES (1);"
```

Then start the indexer. It replays from the deployment.

A cheaper partial reset is to clear only the cursor
(`UPDATE indexer_cursor SET last_block = 0, last_state = NULL`). The whole history is replayed
over the existing rows; inserts are skipped and updates re-applied. This does not remove rows
that should not exist.

### How long it takes

Not measured. It is proportional to the number of contract actions, and each action costs more
as the contract grows, because every action carries the **entire** contract state, which is
parsed and diffed in full. Expect a reindex to slow down as the number of tokens grows. The
API serves partial data while the replay runs.

### After a reindex

- `created_at` on every row is the reindex time.
- If an action had been skipped before, its changes are now attributed to the correct
  transaction.
- Rows that an older version of the indexer wrote wrongly (see [fixed bugs](mapping.md#fixed))
  are now correct.

A quick consistency check, which should return no rows:

```sql
SELECT e.event_id, e.minted, count(t.token_id) AS tokens
FROM events e LEFT JOIN tokens t ON t.first_event_id = e.event_id
GROUP BY e.event_id HAVING e.minted <> count(t.token_id);
```

## Contract upgrades

There is no parser versioning. One process loads one compiled contract and applies it to every
action, old and new.

| Change to the contract | What the indexer needs |
|---|---|
| **Circuit-only upgrade** (`scripts/upgrade.ts`: same address, same ledger layout) | Nothing has to change for correctness. The verifier-key swaps arrive as `ContractUpdate` actions with an empty diff. Redeploy the indexer image anyway so its compiled contract matches the repository. **No database reset.** |
| **New deployment** (new address; required when the ledger layout changes) | The old database belongs to the old contract. Set the new `CONTRACT_ADDRESS`, deploy the image built from the matching commit, and reset the database. |
| **Ledger layout change at the same address** | Not possible with this contract's upgrade mechanism; a layout change needs a new deployment. |
| **New indexed field** in the schema or handlers | Add a migration and the handler code, then reindex so old rows get the value. |

Rules that keep it working:

1. The compiled contract baked into the indexer image must be the build that matches the
   deployed contract's ledger layout.
2. One database per contract address. Never point an existing database at a different address:
   the cursor holds the old contract's state.
3. To serve two contract versions at once, run two indexers with two databases.

The step-by-step procedures are in [Operations](../04-operations/deploy.md).
