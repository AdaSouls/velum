# Shared data contract

The bridge between the three pieces: which public contract data ends up in the database and in
the API. Read a row left to right to trace a value from the chain to a client; read it right to
left to debug a wrong value.

Only public ledger data is listed, because nothing else exists outside the user's device. See
[Public and private data](../01-contract/data-privacy.md) for what is private.

## Encoding rules

| Compact type | Database | API (JSON) |
|---|---|---|
| `Bytes<32>` | `TEXT`, 64 lowercase hex characters, no `0x` | string, same |
| `Uint<64>` | `NUMERIC(20,0)` (`BIGINT` for token ids) | number |
| `Boolean` | `BOOLEAN` | boolean |
| `Opaque<"string">` | `TEXT` | string |
| Block height | `BIGINT` | number, or `null` |
| Transaction hash | `TEXT` hex | string, or `null` |

Details and limits are in [Mapping](../02-indexer/mapping.md#type-rules).

## Events

Ledger: `events: Map<Bytes<32>, EventRecord>` → table `events` → `GET /api/events`,
`GET /api/events/:eventId`

| Ledger | Table column | API field |
|---|---|---|
| map key (event id) | `event_id` | `eventId` |
| `organizer` | `issuer_pk` | `issuerPk` |
| `maxSupply` | `max_supply` | `maxSupply` |
| `minted` | `minted` | `minted` |
| `expiration` | `expiration` | `expiration` |
| `isActive` | `is_active` | `isActive` |
| `isPublicMint` | `is_public_mint` | `isPublicMint` |
| `metadataURI` | `metadata_uri` | `metadataURI` |
| `privateAttributesRoot` | `private_attributes_root` | `privateAttributesRoot` |
| `privateMetadataCommit` | **not stored** | — |
| — (transaction that created it) | `created_block`, `created_tx` | `createdBlock`, `createdTx` |
| — (transaction that deactivated it) | `deactivated_block`, `deactivated_tx` | `deactivatedBlock` (`deactivated_tx` is not exposed) |
| — (computed) | count of non-burned `tokens` rows | `liveTokens` (single-event endpoint only) |

## Tokens

Ledger: five maps keyed by token id → table `tokens` → `GET /api/tokens/:tokenId`,
`GET /api/tokens/owner/:ownerPk`, `GET /api/events/:eventId/tokens`

| Ledger | Table column | API field |
|---|---|---|
| key of `tokenOwner` | `token_id` | `tokenId` |
| `tokenOwner[id]` (holder pseudonym) | `owner_pk` | `ownerPk` |
| `tokenIssuer[id]` | `issuer_pk` | `issuerPk` |
| `tokenEvent[id]` | `first_event_id` | `firstEventId` |
| `tokenMetadataURI[id]` | `token_metadata_uri` | `tokenMetadataURI` |
| `tokenPrivateMetadataCommit[id]` | `token_private_metadata_commit` | `tokenPrivateMetadataCommit` |
| `burnedTokens[id]` present | `is_burned` | `isBurned` |
| — (mint transaction) | `minted_block`, `minted_tx` | `mintedBlock`, `mintedTx` |
| — (burn transaction) | `burned_block`, `burned_tx` | `burnedBlock`, `burnedTx` |
| `events[tokenEvent[id]].metadataURI` | joined from `events.metadata_uri` | `metadataURI` |

The name `first_event_id` / `firstEventId` is historical. A token belongs to exactly one event.

## Disclosure requests

Ledger: `disclosureRequests: Map<Bytes<32>, DisclosureRequest>` → table `disclosure_requests` →
`GET /api/disclosure-requests`, `GET /api/disclosure-requests/:requestId`

| Ledger | Table column | API field |
|---|---|---|
| map key (request id) | `request_id` | `requestId` |
| `verifier` | `verifier_pk` | `verifierPk` |
| `eventId` | `event_id` | `eventId` |
| `fieldId` | `field_id` | `fieldId` |
| `setRoot` | `set_root` | `setRoot` |
| — (publishing transaction) | `published_block`, `published_tx` | `publishedBlock`, `publishedTx` |

## Stored but not served by the API

| Ledger | Table | Notes |
|---|---|---|
| `issuers: Map<Bytes<32>, IssuerRecord>` | `issuers` | Also gets a row for every organizer that creates an event, registered or not. See [open gaps](../02-indexer/mapping.md#open). |
| `usedDisclosures: Set<Bytes<32>>` | `disclosure_nullifiers` | One row per single-use proof |

## On the ledger but not indexed

A client that needs these must read the contract state from the Midnight indexer directly.

| Ledger field | What it holds |
|---|---|
| `events[…].privateMetadataCommit` | Commitment to an event's hidden metadata |
| `eventRevealedMetadata` | Event metadata digests revealed so far |
| `tokenRevealedMetadata` | Token metadata digests revealed so far |
| `eventHolderToken` | (holder, event) → token index |
| `credentials` | The credential Merkle tree. Holders need it to build proof paths. |
| `totalSupply` | Tokens ever minted |
| `isPaused` | Pause flag |
| `adminPk` | Admin public key |

## Not on the ledger at all

No server-side component can have these:

- Secret keys, and the link between a holder's pseudonyms under different organizers.
- Attribute values, their randomness, Merkle paths.
- Which holder made an anonymous proof.
- That a stateless proof happened at all (the Velum indexer sees no state change; the chain still
  records the transaction).
- The `isSoulbound` flag.
