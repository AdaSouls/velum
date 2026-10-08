# Endpoint reference

The machine-readable version of this page is [`openapi.yaml`](openapi.yaml). Both are written by
hand from the route code in [`indexer/src/api/routes/`](../../indexer/src/api/routes/); neither
is generated. The route code is the final authority.

Conventions (formats, errors, ordering) are in the [API overview](README.md#conventions).
Examples use the preprod deployment.

| Method and path | Purpose |
|---|---|
| [`GET /health`](#get-health) | Liveness |
| [`GET /api/events`](#get-apievents) | List events |
| [`GET /api/events/:eventId`](#get-apieventseventid) | One event |
| [`GET /api/events/:eventId/tokens`](#get-apieventseventidtokens) | An event's tokens |
| [`GET /api/tokens/owner/:ownerPk`](#get-apitokensownerownerpk) | Tokens of a holder pseudonym |
| [`GET /api/tokens/:tokenId`](#get-apitokenstokenid) | One token |
| [`GET /api/tokens/:tokenId/attendance`](#get-apitokenstokenidattendance) | Removed (`410`) |
| [`GET /api/disclosure-requests`](#get-apidisclosure-requests) | List disclosure requests |
| [`GET /api/disclosure-requests/:requestId`](#get-apidisclosure-requestsrequestid) | One disclosure request |
| [`GET /api/credential-requests`](#get-apicredential-requests) | List credential requests |
| [`GET /api/credential-requests/:requestId`](#get-apicredential-requestsrequestid) | One credential request |
| [`GET /api/credential-update-requests`](#get-apicredential-update-requests) | List credential update requests |
| [`GET /api/credential-update-requests/:tokenId`](#get-apicredential-update-requeststokenid) | A token's update request |

---

## Objects

Field origin reads: ledger field → database column → API field.

### Event

| API field | Type | Database column | Ledger origin |
|---|---|---|---|
| `eventId` | hex string | `events.event_id` | key of `events` |
| `issuerPk` | hex string | `events.issuer_pk` | `events[id].organizer` |
| `maxSupply` | number | `events.max_supply` | `events[id].maxSupply` (`0` = unlimited) |
| `expiration` | number | `events.expiration` | `events[id].expiration` (`0` = never) |
| `isActive` | boolean | `events.is_active` | `events[id].isActive` |
| `isPublicMint` | boolean | `events.is_public_mint` | `events[id].isPublicMint` |
| `metadataURI` | string | `events.metadata_uri` | `events[id].metadataURI` |
| `minted` | number | `events.minted` | `events[id].minted` (includes burned tokens) |
| `privateAttributesRoot` | hex string | `events.private_attributes_root` | `events[id].privateAttributesRoot` |
| `createdBlock` | number or `null` | `events.created_block` | block of the `createEvent` transaction |
| `createdTx` | string or `null` | `events.created_tx` | hash of that transaction |
| `deactivatedBlock` | number or `null` | `events.deactivated_block` | block of the `deactivateEvent` transaction |
| `liveTokens` | number | computed: non-burned rows in `tokens` | — (single-event endpoint only) |

`minted` counts every token ever minted for the event, burned ones included. `liveTokens`
counts only the ones that are not burned.

### Token

| API field | Type | Database column | Ledger origin |
|---|---|---|---|
| `tokenId` | number | `tokens.token_id` | key of `tokenOwner` |
| `ownerPk` | hex string | `tokens.owner_pk` | `tokenOwner[id]`: the holder's pseudonym for this issuer |
| `issuerPk` | hex string | `tokens.issuer_pk` | `tokenIssuer[id]` |
| `firstEventId` | hex string | `tokens.first_event_id` | `tokenEvent[id]` |
| `isBurned` | boolean | `tokens.is_burned` | presence in `burnedTokens` |
| `mintedBlock` | number or `null` | `tokens.minted_block` | block of the `claim` / `mintTo` / `reissueCredential` transaction |
| `mintedTx` | string or `null` | `tokens.minted_tx` | hash of that transaction |
| `burnedBlock` | number or `null` | `tokens.burned_block` | block of the `burn` or `reissueCredential` transaction |
| `burnedTx` | string or `null` | `tokens.burned_tx` | hash of that transaction |
| `replacesTokenId` | number or `null` | `tokens.replaces_token_id` | — (derived): the token this one replaced, when it was minted by `reissueCredential`; `null` otherwise |
| `tokenMetadataURI` | string | `tokens.token_metadata_uri` | `tokenMetadataURI[id]` |
| `tokenPrivateMetadataCommit` | hex string | `tokens.token_private_metadata_commit` | `tokenPrivateMetadataCommit[id]` |
| `metadataURI` | string | `events.metadata_uri` (joined) | the parent event's `metadataURI` |

Use `tokenMetadataURI` to render the credential; `metadataURI` is the event's, for context.

### Disclosure request

| API field | Type | Database column | Ledger origin |
|---|---|---|---|
| `requestId` | hex string | `disclosure_requests.request_id` | key of `disclosureRequests` |
| `verifierPk` | hex string | `disclosure_requests.verifier_pk` | `disclosureRequests[id].verifier` |
| `eventId` | hex string | `disclosure_requests.event_id` | `.eventId` |
| `fieldId` | hex string | `disclosure_requests.field_id` | `.fieldId` (zeros = ownership-only) |
| `setRoot` | hex string | `disclosure_requests.set_root` | `.setRoot` (zeros = ownership-only) |
| `recipientPk` | hex string or `null` | `disclosure_requests.recipient_pk` | `.recipient`: the holder pseudonym (a token's `ownerPk`) that must answer. `null` (zeros on the ledger) = open request |
| `publishedBlock` | number or `null` | `disclosure_requests.published_block` | block of the `publishDisclosureRequest` transaction |
| `publishedTx` | string or `null` | `disclosure_requests.published_tx` | hash of that transaction |

A request carries only the root of the accepted set. The set's members are shared by the
verifier outside this API.

### Credential request

A verifier's question of up to four conditions about one holder's credential. The holder answers
all of them in one proof (`proveCredentialAttributes`), or none.

| API field | Type | Database column | Ledger origin |
|---|---|---|---|
| `requestId` | hex string | `credential_requests.request_id` | key of `credentialRequests` |
| `verifierPk` | hex string | `credential_requests.verifier_pk` | `credentialRequests[id].verifier` |
| `eventId` | hex string | `credential_requests.event_id` | `.eventId` |
| `recipientPk` | hex string | `credential_requests.recipient_pk` | `.recipient`: the holder pseudonym (a token's `ownerPk`) that must answer. Never `null`: a credential request is always addressed |
| `conditions` | array of `{ slot, fieldId, setRoot }` | `credential_requests.conditions` | `.conditions`: the used conditions, in order. Unused (all-zero) slots are left out |
| `publishedBlock` | number or `null` | `credential_requests.published_block` | block of the `publishCredentialRequest` transaction |
| `publishedTx` | string or `null` | `credential_requests.published_tx` | hash of that transaction |

Each condition:

| Field | Type | Meaning |
|---|---|---|
| `slot` | number, `0` to `3` | Position of the condition in the on-chain vector, which is where its answer goes in `proveCredentialAttributes` |
| `fieldId` | hex string | The credential attribute asked about |
| `setRoot` | hex string | Merkle root of the accepted values for that attribute |

As with disclosure requests, the sets' members are shared by the verifier outside this API.

### Credential update request

| API field | Type | Database column | Ledger origin |
|---|---|---|---|
| `tokenId` | number | `credential_update_requests.token_id` | key of `credentialUpdateRequests` |
| `ownerPk` | hex string | `tokens.owner_pk` | `tokenOwner[tokenId]`: the holder who filed it |
| `issuerPk` | hex string | `tokens.issuer_pk` | `tokenIssuer[tokenId]`: who should act on it |
| `eventId` | hex string | `tokens.first_event_id` | `tokenEvent[tokenId]` |
| `payloadCommit` | hex string | `credential_update_requests.payload_commit` | `credentialUpdateRequests[tokenId]`: commitment to the off-chain request |
| `status` | `"pending"`, `"dismissed"`, `"burned"` or `"reissued"` | `credential_update_requests.status` | `pending` while on the ledger; `dismissed` after `dismissCredentialUpdate`; `reissued` after `reissueCredential`; `burned` after `burn` (a revocation or a self-burn) |
| `requestedBlock` | number or `null` | `credential_update_requests.requested_block` | block of the latest `requestCredentialUpdate` |
| `requestedTx` | string or `null` | `credential_update_requests.requested_tx` | hash of that transaction |
| `closedBlock` | number or `null` | `credential_update_requests.closed_block` | block that removed it; `null` while pending |
| `closedTx` | string or `null` | `credential_update_requests.closed_tx` | hash of that transaction |
| `reissuedTokenId` | number or `null` | `credential_update_requests.reissued_token_id` | — (derived): for `reissued`, the token that replaced this one; `null` otherwise |

The request's content (which document, the new data) never reaches the chain or this API: the
holder sends it to the issuer off-chain, encrypted, and the issuer checks it against
`payloadCommit`.

---

## `GET /health`

Liveness. Says nothing about whether indexing is current.

```bash
curl https://velum-api.adasouls.io/health
```

```json
{ "status": "ok" }
```

---

## `GET /api/events`

All events. Active events first, then by creation block ascending. Not paginated.

| Parameter | In | Required | Description |
|---|---|---|---|
| `issuerPk` | query | no | Only events organized by this public key |

| Status | Body |
|---|---|
| `200` | Array of [Event](#event) (without `liveTokens`). `[]` if none. |
| `500` | `{"error":"internal server error"}` |

```bash
curl "https://velum-api.adasouls.io/api/events?issuerPk=f6cadf33f9b442a62af1bbed5fac3f3dcbb859eaf4b294c35c2eadbf2f523ac7"
```

```json
[
  {
    "eventId": "0aa2e6eaecb0d497f4894627e66bb98c48a579719389c44fd997086168aee0b4",
    "issuerPk": "f6cadf33f9b442a62af1bbed5fac3f3dcbb859eaf4b294c35c2eadbf2f523ac7",
    "maxSupply": 100,
    "expiration": 0,
    "isActive": true,
    "isPublicMint": true,
    "metadataURI": "ipfs://bafybeih6xhqqfxfyfqgw2xkjxhcxc4kdemoevent/metadata.json",
    "minted": 0,
    "privateAttributesRoot": "0000000000000000000000000000000000000000000000000000000000000000",
    "createdBlock": 2685997,
    "createdTx": "ff2deed1f90f23da96bd02171f0cdf849d46a232474e2a55024966a53f1a09a2",
    "deactivatedBlock": null
  }
]
```

---

## `GET /api/events/:eventId`

One event, plus the number of its tokens that are not burned.

| Parameter | In | Required | Description |
|---|---|---|---|
| `eventId` | path | yes | Event id, hex |

| Status | Body |
|---|---|
| `200` | [Event](#event) with `liveTokens` |
| `404` | `{"error":"event not found"}` |
| `500` | `{"error":"internal server error"}` |

```bash
curl https://velum-api.adasouls.io/api/events/0aa2e6eaecb0d497f4894627e66bb98c48a579719389c44fd997086168aee0b4
```

```json
{
  "eventId": "0aa2e6eaecb0d497f4894627e66bb98c48a579719389c44fd997086168aee0b4",
  "issuerPk": "f6cadf33f9b442a62af1bbed5fac3f3dcbb859eaf4b294c35c2eadbf2f523ac7",
  "maxSupply": 100,
  "expiration": 0,
  "isActive": true,
  "isPublicMint": true,
  "metadataURI": "ipfs://bafybeih6xhqqfxfyfqgw2xkjxhcxc4kdemoevent/metadata.json",
  "minted": 0,
  "privateAttributesRoot": "0000000000000000000000000000000000000000000000000000000000000000",
  "createdBlock": 2685997,
  "createdTx": "ff2deed1f90f23da96bd02171f0cdf849d46a232474e2a55024966a53f1a09a2",
  "deactivatedBlock": null,
  "liveTokens": 0
}
```

---

## `GET /api/events/:eventId/tokens`

Every token minted for the event, by token id ascending. Not paginated. Burned tokens are
included unless asked otherwise; each carries `isBurned`.

| Parameter | In | Required | Description |
|---|---|---|---|
| `eventId` | path | yes | Event id, hex |
| `includeBurned` | query | no | `false` leaves out burned tokens. Any other value includes them. |

| Status | Body |
|---|---|
| `200` | Array of [Token](#token). `[]` if the event has no tokens. |
| `404` | `{"error":"event not found"}` |
| `500` | `{"error":"internal server error"}` |

```bash
curl "https://velum-api.adasouls.io/api/events/e66a035b06598dc62fac699291c2f3841dc746f1fedb45201bb11a2b219525a0/tokens?includeBurned=false"
```

The response is an array of the token object shown under
[`GET /api/tokens/:tokenId`](#get-apitokenstokenid).

---

## `GET /api/tokens/owner/:ownerPk`

Every token owned by a holder pseudonym, by token id ascending. **Burned tokens are included**;
filter on `isBurned`.

`ownerPk` is a pseudonym for one organizer, so the result only contains tokens from that
organizer. To list everything a user holds, a client computes the user's pseudonym for each
organizer and calls this endpoint once per organizer. Read the
[privacy note](README.md#privacy) before doing that against a server you do not control.

| Parameter | In | Required | Description |
|---|---|---|---|
| `ownerPk` | path | yes | Holder pseudonym, hex |

| Status | Body |
|---|---|
| `200` | Array of [Token](#token). `[]` for an unknown pseudonym. |
| `500` | `{"error":"internal server error"}` |

```bash
curl https://velum-api.adasouls.io/api/tokens/owner/d5ee8e3db2dbdfb257c54aa952b59bd8a484e34545735d17ecb4ea786c07413e
```

---

## `GET /api/tokens/:tokenId`

One token.

| Parameter | In | Required | Description |
|---|---|---|---|
| `tokenId` | path | yes | Token id, a non-negative integer |

| Status | Body |
|---|---|
| `200` | [Token](#token) |
| `400` | `{"error":"invalid tokenId"}` when the value is not a number |
| `404` | `{"error":"token not found"}` |
| `500` | `{"error":"internal server error"}` (also returned for a non-integer number such as `1.5`) |

```bash
curl https://velum-api.adasouls.io/api/tokens/0
```

```json
{
  "tokenId": 0,
  "ownerPk": "d5ee8e3db2dbdfb257c54aa952b59bd8a484e34545735d17ecb4ea786c07413e",
  "issuerPk": "e8a483ec4446da682b69394c5abb6649ebfa3180a75ca97d25ae6db323274bf8",
  "firstEventId": "e66a035b06598dc62fac699291c2f3841dc746f1fedb45201bb11a2b219525a0",
  "isBurned": false,
  "mintedBlock": 2785214,
  "mintedTx": "4855002cb08dd9431673990683a077289e60b11d5aae458267d0b090c5261fd6",
  "burnedBlock": null,
  "burnedTx": null,
  "replacesTokenId": null,
  "tokenMetadataURI": "ipfs://bafkreihpzs55ta2stbkdf3r744kz77dmlid74xbo5wpj5xlssj7dvvdfoa",
  "tokenPrivateMetadataCommit": "0000000000000000000000000000000000000000000000000000000000000000",
  "metadataURI": "ipfs://bafkreihpzs55ta2stbkdf3r744kz77dmlid74xbo5wpj5xlssj7dvvdfoa"
}
```

---

## `GET /api/tokens/:tokenId/attendance`

Removed. Always answers `410`. A token belongs to exactly one event: read `firstEventId`.

```json
{
  "error": "gone — a token now maps to exactly one event",
  "note": "see firstEventId on GET /api/tokens/:tokenId instead"
}
```

---

## `GET /api/disclosure-requests`

Every published disclosure request, by publication block ascending. Not paginated.

| Parameter | In | Required | Description |
|---|---|---|---|
| `verifierPk` | query | no | Only requests published by this public key |
| `recipientPk` | query | no | Only requests addressed to this holder pseudonym |

| Status | Body |
|---|---|
| `200` | Array of [Disclosure request](#disclosure-request). `[]` if none. |
| `500` | `{"error":"internal server error"}` |

```bash
curl "https://velum-api.adasouls.io/api/disclosure-requests?verifierPk=e8a483ec4446da682b69394c5abb6649ebfa3180a75ca97d25ae6db323274bf8"
```

```json
[
  {
    "requestId": "22d45167fa682ed88d8bc7aa86ddf7d18b0dfca33248100d67a5f9cc7cbca533",
    "verifierPk": "e8a483ec4446da682b69394c5abb6649ebfa3180a75ca97d25ae6db323274bf8",
    "eventId": "e66a035b06598dc62fac699291c2f3841dc746f1fedb45201bb11a2b219525a0",
    "fieldId": "0000000000000000000000000000000000000000000000000000000000000000",
    "setRoot": "0000000000000000000000000000000000000000000000000000000000000000",
    "recipientPk": null,
    "publishedBlock": 2785313,
    "publishedTx": "ead87331b45b9ff42970f3d6f50ce573d1e7864c359db016f90f99d5f8ffc602"
  }
]
```

This one is an open, ownership-only request: `fieldId` and `setRoot` are all zeros and
`recipientPk` is `null`, so any holder of the event can answer it.

---

## `GET /api/disclosure-requests/:requestId`

One disclosure request. A holder's client reads this to learn what it is being asked to prove.

| Parameter | In | Required | Description |
|---|---|---|---|
| `requestId` | path | yes | Request id, hex |

| Status | Body |
|---|---|
| `200` | [Disclosure request](#disclosure-request) |
| `404` | `{"error":"disclosure request not found"}` |
| `500` | `{"error":"internal server error"}` |

```bash
curl https://velum-api.adasouls.io/api/disclosure-requests/22d45167fa682ed88d8bc7aa86ddf7d18b0dfca33248100d67a5f9cc7cbca533
```

---

## `GET /api/credential-requests`

Every published credential request, by publication block ascending. Not paginated. A holder's
wallet lists the ones addressed to its pseudonym; a verifier's tooling lists the ones it asked.
Credential requests do not appear under `/api/disclosure-requests`.

| Parameter | In | Required | Description |
|---|---|---|---|
| `verifierPk` | query | no | Only requests published by this public key |
| `recipientPk` | query | no | Only requests addressed to this holder pseudonym |
| `eventId` | query | no | Only requests about this event |

| Status | Body |
|---|---|
| `200` | Array of [Credential request](#credential-request). `[]` if none. |
| `500` | `{"error":"internal server error"}` |

```bash
curl "https://velum-api.adasouls.io/api/credential-requests?recipientPk=<holder pseudonym>"
```

```json
[
  {
    "requestId": "<request id>",
    "verifierPk": "<verifier public key>",
    "eventId": "<event id>",
    "recipientPk": "<holder pseudonym>",
    "conditions": [
      { "slot": 0, "fieldId": "<identity field id>", "setRoot": "<root of the one-value set>" },
      { "slot": 1, "fieldId": "<grade field id>", "setRoot": "<root of the accepted grades>" }
    ],
    "publishedBlock": 2,
    "publishedTx": "<transaction hash>"
  }
]
```

The example shows the shape only. The contract with credential requests is deployed on preprod,
but the public API host does not follow it yet (see
[`deployments/preprod.md`](../../deployments/preprod.md)).

---

## `GET /api/credential-requests/:requestId`

One credential request. A holder's client reads this to learn what it is being asked to prove.

| Parameter | In | Required | Description |
|---|---|---|---|
| `requestId` | path | yes | Request id, hex |

| Status | Body |
|---|---|
| `200` | [Credential request](#credential-request) |
| `404` | `{"error":"credential request not found"}` |
| `500` | `{"error":"internal server error"}` |

---

## `GET /api/credential-update-requests`

Credential update requests, by request block ascending. Not paginated. An issuer's tooling lists
its pending ones; a holder's wallet checks its own.

| Parameter | In | Required | Description |
|---|---|---|---|
| `issuerPk` | query | no | Only requests for tokens of this issuer |
| `ownerPk` | query | no | Only requests filed by this holder pseudonym |
| `status` | query | no | `pending`, `dismissed`, `burned` or `reissued` |

| Status | Body |
|---|---|
| `200` | Array of [Credential update request](#credential-update-request). `[]` if none. |
| `400` | `{"error":"status must be one of pending, dismissed, burned, reissued"}` |
| `500` | `{"error":"internal server error"}` |

```bash
curl "https://velum-api.adasouls.io/api/credential-update-requests?issuerPk=<issuer pk>&status=pending"
```

---

## `GET /api/credential-update-requests/:tokenId`

A token's latest update request.

| Parameter | In | Required | Description |
|---|---|---|---|
| `tokenId` | path | yes | Token id, a non-negative integer |

| Status | Body |
|---|---|
| `200` | [Credential update request](#credential-update-request) |
| `400` | `{"error":"invalid tokenId"}` |
| `404` | `{"error":"update request not found"}`: the token's holder never filed one |
| `500` | `{"error":"internal server error"}` |

---

## What the API does not serve

| You want | Where to get it |
|---|---|
| Whether a proof was made | The transaction on the Midnight indexer. Stateless proofs leave no trace here. |
| The credentials Merkle tree, for building a proof path | The contract's state, through the Midnight indexer |
| Revealed metadata, the event-level metadata commitment, the pause flag, the admin key | The contract's state |
| Registered and blocked issuers | Stored in the database (`issuers`), no endpoint |
| Single-use nullifiers | Stored in the database (`disclosure_nullifiers`), no endpoint |
| The last indexed block | The database (`indexer_cursor`), no endpoint |
| Metadata content | Fetch the `ipfs://` URI from an IPFS gateway |
