# Monitoring and runbooks

What to watch across the whole stack, and what to do for each kind of incident. Indexer-only
procedures (behind, stuck, reorg) are in
[Indexer operation](../02-indexer/operations.md#runbook) and are linked from here.

## What exists today

Be clear about the starting point: **there is no monitoring.** No metrics endpoint, no
dashboards, no alerts, no access logs. What exists:

| Signal | Where |
|---|---|
| Liveness of the indexer process | `GET /health`, and the container health check built on it |
| Indexer activity and errors | Container logs (`docker compose logs indexer`) |
| Indexing position | `indexer_cursor` table |
| Container state | `docker compose ps` |
| TLS certificate | Renewed automatically by Caddy; failures appear in Caddy's logs |

Everything below under "Checks" is a recommendation built on those signals.

## Checks

An external monitor that runs these every minute covers most failures.

| # | Check | Healthy | Detects |
|---|---|---|---|
| 1 | `GET https://$API_DOMAIN/health` | `200`, `{"status":"ok"}` | Host, Caddy or indexer process down; expired certificate |
| 2 | `GET https://$API_DOMAIN/api/events` | `200`, a JSON array | Database down (`500`) |
| 3 | `HEAD https://$API_DOMAIN/zk/poap/keys/claim.verifier` | `200` | Missing ZK artifacts: users cannot prove |
| 4 | Indexer log contains no `[sub] error handling event` in the last 5 minutes | none | A skipped action; if repeating, a stalled indexer |
| 5 | Freshness: the contract's latest action on the Midnight indexer vs `indexer_cursor.last_block` | equal within a few minutes | Stalled or disconnected indexer |
| 6 | Consistency: `events.minted` vs token rows; ledger counts vs row counts | equal | Rows written by an older indexer version, missed data |
| 7 | Disk usage on the host | below 80 % | Postgres or Docker filling the disk |
| 8 | Container restart count | stable | Crash loop |

Check 1 alone is not enough. `/health` stays `ok` while indexing is stalled, so a monitor that
only watches it will miss the most likely data incident. Checks 4 and 5 are the ones that catch
it.

An end-to-end probe is the strongest signal: periodically send a cheap transaction (for example
publish a disclosure request from a monitoring wallet) and assert that it appears in the API
within a few minutes. It exercises the proof server, the wallet, the chain, the Midnight indexer,
the Velum indexer and the API in one go. It costs DUST and needs a key, so run it from a trusted
machine, not from the API host.

## Where to look first

| Symptom | Most likely layer | Go to |
|---|---|---|
| Site loads, lists are empty or stale | Velum indexer | [Indexer is behind](../02-indexer/operations.md#the-indexer-is-behind) |
| API returns `500` | Postgres | [Database problems](#database-problems) |
| API unreachable | Host, Caddy, DNS, certificate | [API is down](#api-is-down) |
| Every transaction fails for every user, for one or more circuits | Keys out of step after an upgrade | [Proofs rejected](#every-call-to-a-circuit-fails) |
| Transactions fail at the proving step | The user's proof server, or missing artifacts | [Proving fails](#proving-fails) |
| Transactions are submitted but never confirm | Midnight network or the wallet | [Transactions do not confirm](#transactions-do-not-confirm) |
| A transaction confirmed but the API does not show it | Normal delay, or the indexer | [Indexer is behind](../02-indexer/operations.md#the-indexer-is-behind) |
| An event shows inactive, or `minted` is wrong | Rows written by an older indexer version | [The API disagrees with the chain](../02-indexer/operations.md#the-api-disagrees-with-the-chain) |
| Admin operations fail with fee errors | Deployer wallet's DUST | [Deployer wallet](#deployer-wallet-cannot-pay) |

## Runbooks

### API is down

1. `docker compose ps` on the host. Are `caddy`, `indexer` and `postgres` up?
2. `docker compose logs --tail=100 caddy`. Certificate errors mean DNS no longer points at the
   host, or ports 80/443 are blocked.
3. `docker compose logs --tail=100 indexer`. If it exits at start, read the first error: a
   missing variable in `.env`, or Postgres not reachable.
4. `docker compose up -d` brings back anything that stopped. All services use
   `restart: unless-stopped`.

Users can still use credentials they already hold while the API is down: proofs go to the chain,
not through the API. They cannot browse events or list their credentials.

### Database problems

Symptom: `500` on every data endpoint, `/health` still `ok`.

1. `docker compose logs --tail=100 postgres`. Look for out-of-disk or startup errors.
2. `df -h`. Free space if needed; old Docker images are the usual cause (`docker image prune`).
3. Restart: `docker compose restart postgres indexer`.
4. If the data is damaged, do not repair it. It is a copy of the chain:
   [reindex](../02-indexer/sync.md#reindexing-from-scratch), then check the counters.

Backups (see [`deploy/production/README.md`](../../deploy/production/README.md#7-operations))
only save resync time.

### Every call to a circuit fails

Symptom: after a contract upgrade, all users get a failure for specific circuits, at submission
or verification.

Cause: the verifier key on-chain and the prover key clients use are different builds.

1. See what is on-chain compared with a build:
   `CONTRACT_ADDRESS=<addr> npx tsx scripts/upgrade.ts` (plan only). It lists every circuit whose
   on-chain key differs from the local build.
2. Decide which build is the intended one, and make the rest match it:
   - Artifacts on the host: `sync-zk.sh` + `rsync`, then verify `SHA256SUMS`.
   - Web app: redeploy with the matching compiled contract.
   - Chain: `upgrade.ts --apply` from the intended build.
3. Confirm with one real transaction.

A circuit also fails for everyone during the short window between its key being removed and
re-inserted in an upgrade. That resolves on its own when `--apply` finishes; if `--apply` was
interrupted, run it again.

### Proving fails

Symptom: the web app fails at the "proving" stage.

| Cause | Check |
|---|---|
| The user has no proof server running | The web app talks to `http://localhost:6300` by default. See the open decision in [`deploy/production/README.md`](../../deploy/production/README.md#proof-server-open-decision). |
| ZK artifacts missing or partial | `curl -sI https://$API_DOMAIN/zk/poap/keys/<circuit>.prover`; re-run `sync-zk.sh`, which refuses to produce a partial set |
| Artifacts from a different build | See [above](#every-call-to-a-circuit-fails) |

### Transactions do not confirm

Symptom: a transaction is submitted and never appears on-chain.

1. Is Midnight preprod producing blocks? Check the network's status and its indexer.
2. Is the user's wallet synced and does it have DUST? Fee problems surface as rejected
   transactions, not as Velum errors.
3. Did the contract reject it? A failed `assert` stops the call locally before submission, with
   the assert's message. A paused contract rejects every state-changing circuit.

Nothing on the API host is involved in submitting transactions.

### Deployer wallet cannot pay

Symptom: `deploy.ts` or `upgrade.ts` fails with an insufficient-funds or invalid-fee error.

| Error | Meaning | Action |
|---|---|---|
| `Wallet has no NIGHT` | The wallet is unfunded | Fund it from the network's faucet |
| `Wallet.InsufficientFunds` | No spendable DUST yet | Wait for the DUST sync to finish; DUST accrues from registered NIGHT over time |
| `Custom error: 170` | The node rejected the DUST spend proof. Two known causes: the proof was built against a stale state, or the proof server is older than the network expects. | Let the wallet catch up fully, then retry; the script waits for this by default. If it still fails with the wallet at the head, compare the proof server's `/version` with the latest release: on 2026-10-04 preprod rejected every deploy attempt proved with `proof-server:8.1.0` and accepted them with `8.1.3`, which `devnet.yml` now pins. Anyone with an older container has to recreate it (`docker compose -f devnet.yml up -d proof-server` after pulling). |
| `Custom error: 117` | A zero-fee transaction | Fixed in `scripts/lib/network.ts` by a small fixed overhead; make sure you run the current code |

The first DUST sync on preprod takes 1.5–2 hours. Raise the ceiling with
`DUST_SYNC_TIMEOUT_MIN` if needed. Delete `.wallet-state/` to force a clean sync.

### The contract must be stopped

For abuse or a discovered vulnerability:

1. `pause` from the admin key stops every state-changing circuit. Proofs keep working.
2. For one event or organizer, use `deactivateEvent` or `deactivateIssuer` instead.
3. Fix, then upgrade in place if the ledger layout allows it
   ([Deploying](deploy.md#contract-upgrade-same-address)), and `unpause`.

The API keeps serving the last indexed state throughout. The pause flag is not indexed, so the
API will not show that the contract is paused.

### The deployer seed is lost or leaked

- **Lost:** no more admin actions and no more upgrades, ever. The contract keeps working as it
  is. The only way forward for changes is a new deployment.
- **Leaked:** whoever has it can act as admin and replace the contract's circuits. There is no
  key rotation. Treat the contract as compromised, pause it if you still can, and plan a new
  deployment.

Keep the seed offline and backed up. See [Security](../01-contract/security.md#trust-assumptions).

### The API host is compromised

The host holds no key that controls funds or the contract. An attacker on it could:

- Serve altered API responses or altered ZK artifacts to the web app.
- Observe which pseudonyms each client asks about.
- Read the Pinata token if the IPFS profile is enabled.

Response: rebuild the host from a clean image, rotate `POSTGRES_PASSWORD` and `PINATA_JWT`,
re-sync the artifacts and verify `SHA256SUMS`, and reindex. Altered artifacts cannot make the
chain accept an invalid proof; they can only make users' proofs fail.

## After an incident

Record what happened, the block heights involved and what fixed it. If the cause was one of the
[known indexer bugs](../02-indexer/mapping.md#known-gaps-and-bugs), note it there; if it was
something new, add it.
