# Mapping and parsing

How a change on the ledger becomes rows in the database.

## The method: state diff, not event decoding

Compact contracts do not emit events. The indexer learns what a transaction did by comparing the
contract's state **before** and **after** it.

For every contract action ([`subscriptions.ts`](../../indexer/src/subscriptions.ts),
`handleEvent`):

1. Parse the action's `state` into a ledger view (`curr`).
2. Diff it against the previous view (`prev`), field by field.
3. Write the differences to Postgres in one database transaction
   ([`poap-state.ts`](../../indexer/src/poap-state.ts), `applyStateDiff`).
4. Save the cursor: this block height and this state.
5. `curr` becomes `prev`.

On a first run `prev` is an empty ledger. After a restart it is rebuilt from the state saved in
the cursor.

### Can the indexer tell which circuit ran?

Yes and no.

- **It is told.** For a `ContractCall` the Midnight indexer provides `entryPoint`, the circuit's
  name. A deploy is labelled `deploy` and a maintenance update `update`.
- **It does not use it.** The name is only written to the log line
  (`[state] claim @ block 2785214 tx 4855002cb08dd943…`). Every database write is decided by the
  diff alone.

Consequences of working from the diff:

- The handlers do not need to know the circuits. A new circuit that changes an indexed field is
  picked up without new code.
- Two circuits with the same effect are indistinguishable in the database. `claim` and `mintTo`
  both appear as "a token was added"; an issuer revocation and a self-burn both appear as "a
  token was burned".
- A call that changes nothing produces nothing.
- Diffs are cumulative. If one action fails to process, the next successful one still picks up
  its changes, attributed to the later transaction.

## Per-circuit mapping

"Detected as" is what the diff shows. "Written" is the SQL effect. Block and transaction columns
are filled from the action being processed.

### Events

| Circuit | Ledger change | Detected as | Written |
|---|---|---|---|
| `createEvent` | New entry in `events` | Key added to `events` | `INSERT INTO issuers` for the organizer if missing (`is_active = TRUE`); `INSERT INTO events` with all fields, `created_block`, `created_tx` |
| `deactivateEvent` | `events[id].isActive` → `false` | Entry updated, now inactive | `UPDATE events SET minted, is_active = FALSE, deactivated_block, deactivated_tx` |
| `reactivateEvent` | `events[id].isActive` → `true` | Entry updated, now active | `UPDATE events SET minted, is_active = TRUE, deactivated_block = NULL, deactivated_tx = NULL` |

### Tokens

| Circuit | Ledger change | Detected as | Written |
|---|---|---|---|
| `claim`, `mintTo` | New entries in `tokenOwner`, `tokenEvent`, `tokenIssuer`, `tokenMetadataURI`, `tokenPrivateMetadataCommit`; `events[id].minted` + 1; also `eventHolderToken`, `credentials`, `totalSupply` | Key added to `tokenOwner`; `events` entry updated | `INSERT INTO tokens` (the other four maps are looked up by the new token id), `minted_block`, `minted_tx`; `UPDATE events SET minted` |
| `burn` | New entry in `burnedTokens`; credential leaf cleared; pending update request removed; on a self-burn the `eventHolderToken` entry is removed | Key added to `burnedTokens` | `UPDATE tokens SET is_burned = TRUE, burned_block, burned_tx`; see the update request row below |
| `requestCredentialUpdate` | New or replaced entry in `credentialUpdateRequests` | Key added or value updated | Upsert into `credential_update_requests`: `status = 'pending'`, `payload_commit`, `requested_block`, `requested_tx`; `closed_*` cleared |
| `dismissCredentialUpdate`, `burn` | Entry removed from `credentialUpdateRequests` | Key removed | `UPDATE credential_update_requests SET status, closed_block, closed_tx`: `'burned'` if the token is burned in the same state, otherwise `'dismissed'` |

Before inserting a token the handler makes sure its issuer and event rows exist, inserting
placeholders if not. With the contract as written this never triggers, because a token's event
always exists first.

### Issuers

| Circuit | Ledger change | Detected as | Written |
|---|---|---|---|
| `registerIssuer` | New entry in `issuers`, active | Key added, active | Upsert: `INSERT INTO issuers (is_active = TRUE, registered_block, registered_tx)`; if the row already exists (the key organized an event earlier) it is updated instead |
| `deactivateIssuer` on a registered issuer | `issuers[pk].isActive` → `false` | Entry updated, now inactive | `UPDATE issuers SET is_active = FALSE, deactivated_block, deactivated_tx` |
| `deactivateIssuer` on a key with no ledger entry | New entry in `issuers`, inactive | Key added, inactive | Upsert: `INSERT INTO issuers (is_active = FALSE, deactivated_block, deactivated_tx)`; an existing row is updated to inactive. `registered_block` stays `NULL`: the key was never registered. |

### Selective disclosure

| Circuit | Ledger change | Detected as | Written |
|---|---|---|---|
| `publishDisclosureRequest` | New entry in `disclosureRequests` | Key added | `INSERT INTO disclosure_requests` with `published_block`, `published_tx` |
| `proveAttributeMembershipOnce` | New element in `usedDisclosures` | Element added to the set | `INSERT INTO disclosure_nullifiers` with `spent_block`, `spent_tx` |
| `proveAttributeMembership`, `proveTokenOwnership`, `proveEventAttendance`, `proveCredentialAttribute` | None | Empty diff | Nothing. The cursor still advances. |

### Not indexed

| Circuit | Ledger change | Why nothing is written |
|---|---|---|
| `pause`, `unpause` | `isPaused` | Parsed but not diffed |
| `revealPrivateMetadata` | New entry in `eventRevealedMetadata` | The field is not in the indexer's ledger view |
| `revealPrivateTokenMetadata` | New entry in `tokenRevealedMetadata` | Same |
| Constructor (deploy) | `adminPk`, `isPaused` | Parsed but not stored |
| Maintenance update (verifier key insert/remove) | Contract operations, not ledger data | Empty diff |
| `getCallerPk`, `getHolderPk`, `compute…` | No transaction | Never reach the chain |

### Order within one action

`applyStateDiff` runs the handlers in this order inside one database transaction: issuers →
events → tokens → nullifiers → disclosure requests. The order satisfies the foreign keys (an
event needs its issuer, a token and a request need their event). If any handler throws, the
whole transaction rolls back.

## Type rules

| Compact type | In the ledger view (TypeScript) | In Postgres | How |
|---|---|---|---|
| `Bytes<32>` | `Uint8Array` | `TEXT` | `Buffer.from(bytes).toString('hex')`: 64 lowercase hex characters, no `0x` prefix |
| `Uint<64>` | `bigint` | `NUMERIC(20,0)` for `max_supply`, `expiration`, `minted`; `BIGINT` for token ids | `value.toString()` passed as a query parameter |
| `Boolean` | `boolean` | `BOOLEAN` | direct |
| `Opaque<"string">` | `string` | `TEXT` | direct |
| `Counter` (`totalSupply`) | `bigint` | not stored | — |
| `Map<K, V>` | iterable of `[K, V]` | one row per entry | snapshot to a JS `Map` keyed by hex or decimal string, then diff |
| `Set<Bytes<32>>` | iterable of `Uint8Array` | one row per element | diff by hex; additions only |
| `HistoricMerkleTree` (`credentials`) | not read | not stored | — |
| struct (`EventRecord`, …) | object | columns | field by field |

All hashes and identifiers are hex. Base64 is not used anywhere.

### Large numbers

- A Compact `Uint<64>` goes up to 2^64 − 1. A Postgres `BIGINT` is signed and stops at
  2^63 − 1, so the columns that hold caller-chosen `Uint<64>` values (`max_supply`,
  `expiration`) and `minted` are `NUMERIC(20,0)`, which covers the full range
  (migration `002_uint64_columns.sql`).
- Token ids stay `BIGINT`: the contract caps them below 2^20.
- Block heights come from GraphQL as numbers and are converted with `BigInt()` before use.
- The cursor's resume offset is converted back with `Number()`, safe for any realistic height.
- The API converts these columns to JSON numbers; see
  [API conventions](../03-api/README.md#formats).

### Equality used by the diff

An entry counts as "updated" when the comparison function says it changed:

| Field | Compared |
|---|---|
| `events` | `isActive`, `minted`, `maxSupply`, `expiration`, `isPublicMint`, `metadataURI`, `organizer`, `privateAttributesRoot` (not `privateMetadataCommit`) |
| `issuers` | `isActive`, `organizerPk` |
| `disclosureRequests` | all four fields (they never change in practice) |
| `tokenOwner` | only additions are used |
| `burnedTokens` | only additions are used |

Removed entries are computed but ignored: nothing in the indexed fields is ever removed by the
contract.

## Known gaps and bugs

### Open

Gaps in what is indexed. None of them makes the indexed data wrong.

| # | Gap | Effect | Where |
|---|---|---|---|
| 4 | The `issuers` table holds two kinds of rows: issuers the admin registered or blocked, and organizers that simply created an event. | `is_active = TRUE` does not mean "verified". A registered issuer is one with `registered_block` set. | `handleEvents`, `handleTokens` |
| 5 | A self-burn and a revocation are stored identically. | The distinction, which is visible on-chain, is lost. | `handleTokens` |
| 7 | Revealed metadata, the event metadata commitment and the pause flag are not indexed. | Clients must read them from the chain. | `parser.ts` (`LedgerView`) |

### Fixed

Found while writing this documentation and fixed in the same change. Each has a regression test
in [`indexer/src/integration.test.ts`](../../indexer/src/integration.test.ts).

| # | Problem | Fix |
|---|---|---|
| 1 | `reactivateEvent` was not reflected: the event kept `is_active = FALSE` and its `deactivated_block`. | The "updated and active" branch now sets `is_active = TRUE` and clears the deactivation columns. |
| 2 | Registering or blocking an organizer that already had a row (because it had created an event) did nothing: the insert conflicted and was skipped. | Both cases are upserts now. |
| 3 | An event with `maxSupply` or `expiration` ≥ 2^63 could not be inserted into a `BIGINT` column. Because diffs are cumulative, every later action failed the same way and indexing stopped for the whole contract. `createEvent` is permissionless, so anyone could trigger it. | The columns are `NUMERIC(20,0)` (migration `002_uint64_columns.sql`, applied automatically at start). |
| 6 | Actions were not processed one at a time. The subscription callback is asynchronous and the WebSocket client does not wait for it, so during a backfill many actions were handled concurrently, all diffed against the same starting state. Whichever insert landed first won, even with an older value. On preprod this left two events with `minted: 0` in the API while the chain said `1`. | Actions are queued and handled strictly in arrival order (`startSubscription`). |

How the fixes were checked:

- The regression tests fail on the old code and pass on the new. The ordering test reproduces
  the preprod symptom (`minted` stays `0`) when the queue is removed.
- The fixed indexer was run against the live preprod contract into an empty local database: 41
  actions processed with no errors, the cursor ended on the contract's latest action, and
  `minted` matched the chain for every event.

**A deployed indexer keeps its old rows.** Updating the code does not rewrite data that was
indexed wrongly before. After deploying the fix,
[reindex](sync.md#reindexing-from-scratch) once.
