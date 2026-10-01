# Indexer

The Velum indexer ([`indexer/`](../../indexer/)) follows one contract on Midnight and keeps a
queryable copy of part of its public state in Postgres. The same process serves the
[REST API](../03-api/README.md).

| Document | What it covers |
|---|---|
| This page | Purpose, scope and data source |
| [Mapping and parsing](mapping.md) | Per circuit: ledger change → interpretation → database row. Type rules. Known gaps. |
| [Data model](data-model.md) | Schema, indexes, the cursor table |
| [Sync and consistency](sync.md) | Start block, backfill, reorgs, idempotency, errors, reindexing, contract upgrades |
| [Operation](operations.md) | Configuration, metrics, alerts, runbook |

## Purpose and scope

### What it follows

| | |
|---|---|
| Contracts | Exactly one: the Velum contract at `CONTRACT_ADDRESS`. One indexer process and one database per contract address. |
| Preprod address | `3ce0a48228880fa377d22d364a1ad19fee5cb6e26a8ed80de11d7ab07433ceef` (see [`deployments/preprod.md`](../../deployments/preprod.md)) |
| Local devnet address | Whatever `scripts/deploy.ts` printed on the last run |
| Network | Set by `MIDNIGHT_NETWORK_ID`; it must match the Midnight indexer the process connects to |

### What it stores

Issuers, events, tokens, disclosure requests and single-use nullifiers. The exact fields are in
the [shared data contract](../00-overview/data-contract.md).

### What it cannot see

**The indexer only ever sees public ledger data.** This is a property of where it reads from,
not of how carefully it is written:

- It receives the contract's public state from the Midnight indexer. Private state, witness
  outputs and undisclosed circuit arguments never leave the user's device, so there is nothing
  for the indexer to receive.
- It has no keys, signs nothing and submits no transactions.
- It cannot see secret keys, attribute values, commitment openings or Merkle paths.
- It cannot tell which holder made an anonymous proof.
- It does not even notice stateless proofs (`proveTokenOwnership`, `proveEventAttendance`,
  `proveCredentialAttribute`, `proveAttributeMembership`): they change no state, so they produce
  no rows.

What it *can* do is observe who queries the API. That is a privacy consideration for the API,
covered in [API security](../03-api/README.md#privacy).

### What it deliberately leaves out

Some public ledger fields are not indexed: revealed metadata, the event-level metadata
commitment, the credential tree, the pause flag. See
[On the ledger but not indexed](../00-overview/data-contract.md#on-the-ledger-but-not-indexed).

## Data source

The indexer reads from **Midnight's own indexer** over GraphQL. It does not connect to a node.

| | |
|---|---|
| Protocol | GraphQL over WebSocket (`graphql-transport-ws`), library `graphql-ws` 5.16.0 |
| Endpoint | `MIDNIGHT_INDEXER_WS`, API version 4: `…/api/v4/graphql/ws` |
| Local | `ws://127.0.0.1:8088/api/v4/graphql/ws` (`midnightntwrk/indexer-standalone:4.3.3` from `devnet.yml`) |
| Preprod | `wss://indexer.preprod.midnight.network/api/v4/graphql/ws` |
| Mode | One long-lived **subscription**. No polling and no one-off queries. |

`MIDNIGHT_INDEXER_URL` (the HTTP endpoint) is read into the configuration but not used by the
indexing code.

### The subscription

[`indexer/src/subscriptions.ts`](../../indexer/src/subscriptions.ts):

```graphql
subscription ContractSub($address: HexEncoded!, $offset: BlockOffset) {
  contractActions(address: $address, offset: $offset) {
    __typename
    state
    transaction { hash block { height } }
    ... on ContractCall {
      entryPoint
    }
  }
}
```

Each message is one **contract action**:

| `__typename` | Meaning | `entryPoint` |
|---|---|---|
| `ContractDeploy` | The contract was deployed | — |
| `ContractCall` | A circuit was called | the circuit's name |
| `ContractUpdate` | A maintenance change, e.g. a verifier key was inserted or removed | — |

Every action carries:

- `state`: the contract's **entire** state after the action, hex-encoded.
- `transaction.hash` and `transaction.block.height`.

`offset` tells the Midnight indexer where to start. It is `{ height: <number> }` when resuming
and omitted on a first run. `BlockOffset.height` is an `Int` in this schema; sending a string
breaks the subscription.

### Deserializing the state

[`indexer/src/parser.ts`](../../indexer/src/parser.ts) turns the hex string into a typed view of
the ledger using the code the Compact compiler generated:

```ts
const bytes = Buffer.from(stateHex, 'hex');
const cs = compactRuntime.ContractState.deserialize(bytes);   // @midnight-ntwrk/compact-runtime 0.16.0
return ledger(cs.data);                                       // ledger() from contract/index.js
```

- `ledger()` comes from `contracts/src/managed/poap/contract/index.js`, loaded once at startup
  (`initContractModule`). The path can be overridden with `CONTRACT_MODULE_PATH`.
- The result exposes each ledger field with the compiler's TypeScript types: maps are iterable
  as `[key, value]` pairs, the set as values, `Bytes<32>` as `Uint8Array`, `Uint<64>` as `bigint`.
- **The compiled contract must match the deployed contract's ledger layout.** If it does not,
  parsing fails or returns nonsense. The production image bakes in the build from the checked-out
  commit, so that commit must be the one the contract was compiled from.

### Versions

| Package | Version |
|---|---|
| `@midnight-ntwrk/compact-runtime` | 0.16.0 |
| `@midnight-ntwrk/midnight-js-network-id` | ^4.1.1 |
| `graphql` / `graphql-ws` | 16.8.1 / 5.16.0 |
| `pg` | ^8.11.3 |
| `express` | ^4.18.2 |
| Node.js | 22 (production image) |
| Midnight indexer API | v4 |

### Process layout

[`indexer/src/index.ts`](../../indexer/src/index.ts) does, in order:

1. Sets the network id.
2. Loads the compiled contract module.
3. Applies the SQL migrations.
4. Starts the REST API.
5. Opens the WebSocket and starts the subscription.

| File | Role |
|---|---|
| `src/config.ts` | Environment variables |
| `src/client.ts` | WebSocket client with reconnect and back-off |
| `src/subscriptions.ts` | The subscription and the per-action handler |
| `src/parser.ts` | State deserialization and diff helpers |
| `src/poap-state.ts` | Turns a diff into SQL |
| `src/db.ts` | Connection pool, migrations, cursor |
| `src/api/` | REST routes |
| `db/migrations/001_init.sql` | Schema |
