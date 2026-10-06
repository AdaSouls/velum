# API

The REST API served by the Velum indexer ([`indexer/src/api/`](../../indexer/src/api/)).

| Document | What it covers |
|---|---|
| This page | Overview, conventions, security and access, performance |
| [Endpoint reference](endpoints.md) | Every endpoint: parameters, responses, errors, examples, and where each field comes from |
| [`openapi.yaml`](openapi.yaml) | The same reference as an OpenAPI 3.0 document |
| [For integrators](quickstart.md) | First request in five minutes, common use cases, changelog |

## Overview

| | |
|---|---|
| Style | REST, JSON, read-only (`GET` only) |
| Base URL, preprod | `https://velum-api.adasouls.io` |
| Base URL, local | `http://localhost:3001` |
| Audience | The Velum web app. It is also open to third parties: there is no authentication. |
| Data | Public state of one Velum contract: events, tokens, disclosure requests |
| Implementation | Express 4, in the same process as the indexer, reading Postgres |

The API cannot change anything. Creating events, minting and proving are transactions sent to
the contract from the user's device; see [Circuits and flows](../01-contract/circuits.md).

### Eventual consistency

**The API is a delayed copy of the chain.** A change is final on-chain before it appears here.
The delay is normally the time for the Midnight indexer to index the block plus the time for the
Velum indexer to write the rows, and it can be much longer if the indexer is restarting,
backfilling or stalled.

- Do not use the API to confirm a transaction you just sent. Watch the transaction through the
  Midnight indexer, as the web app does.
- Do not use the API as proof of anything. Ownership and revocation are decided by the
  contract.
- **The API does not say how fresh it is.** There is no `/status` endpoint and no header with
  the last indexed block. `/health` only says the process is up. Operators can read the cursor
  from the database (`SELECT last_block, updated_at FROM indexer_cursor`).

  Exposing the last indexed block, for example as `GET /status` or an `X-Indexed-Block`
  response header, is the most useful addition for clients and is not implemented yet.

If the API disagrees with the chain for longer than the usual delay, see
[The API disagrees with the chain](../02-indexer/operations.md#the-api-disagrees-with-the-chain).

### Other services on the same host

In production, Caddy routes some paths on the same domain to other things. They are not part of
this API and are not documented here.

| Path | Served by |
|---|---|
| `/zk/poap/keys/…`, `/zk/poap/zkir/…` | Static ZK artifacts for the deployed contract |
| `/api/ipfs/*`, `/api/backup`, `/api/credential-delivery`, `/api/disclosure-sets` | The optional IPFS proxy from the `poap-frontend` repository |

## Conventions

### Formats

| Kind | Format | Example |
|---|---|---|
| Identifiers and hashes (event id, public key, pseudonym, request id, commitment, root) | 64 lowercase hex characters, no `0x` | `0aa2e6ea…aee0b4` |
| Transaction hash | lowercase hex | `ff2deed1…1a09a2` |
| Token id | JSON number | `0` |
| Counts and caps (`maxSupply`, `minted`, `liveTokens`) | JSON number | `100` |
| `expiration` | JSON number: block time, `0` = never | `0` |
| Block heights | JSON number or `null` | `2685997` |
| Booleans | JSON boolean | `true` |
| "No commitment" / "no attributes" | 64 zeros | `0000…0000` |
| Dates | **None.** The API returns block heights, not timestamps. | |

Things to know:

- **Hex is matched exactly.** Path and query values are compared as strings. Uppercase hex or a
  `0x` prefix simply matches nothing: you get `404`, or an empty list.
- **Large numbers are JSON numbers, not strings.** On-chain, `maxSupply` and `expiration` are
  64-bit unsigned integers. The API converts them with JavaScript's `Number`, so values above
  2^53 − 1 lose precision. In practice these values are small. If you build a new client, do not
  rely on exact values above that limit.
- Field names are camelCase. `metadataURI` and `tokenMetadataURI` keep `URI` in capitals.
- `firstEventId` is the token's only event. The name is historical.

### Pagination, filters and order

- **There is no pagination.** List endpoints return every matching row in one response.
- Filters are exact-match query parameters:

  | Endpoint | Filter |
  |---|---|
  | `GET /api/events` | `issuerPk` |
  | `GET /api/events/:eventId/tokens` | `includeBurned=false` |
  | `GET /api/disclosure-requests` | `verifierPk`, `recipientPk` |
  | `GET /api/credential-update-requests` | `issuerPk`, `ownerPk`, `status` |

- Order is fixed per endpoint and cannot be changed:

  | Endpoint | Order |
  |---|---|
  | Events | active first, then by creation block ascending |
  | Tokens | by token id ascending |
  | Disclosure requests | by publication block ascending |

### Errors

Errors from the API's own routes are JSON with one field:

```json
{ "error": "event not found" }
```

| Status | When | Body |
|---|---|---|
| `400` | `tokenId` is not a number | `{"error":"invalid tokenId"}` |
| `404` | The event, token or request does not exist | `{"error":"event not found"}`, `"token not found"`, `"disclosure request not found"` |
| `404` | The path matches no route | Express's default **HTML** page, not JSON |
| `410` | `GET /api/tokens/:tokenId/attendance` (removed) | `{"error":"gone — …","note":"…"}` |
| `500` | Any unexpected failure, including a database error | `{"error":"internal server error"}` |

There are no error codes beyond the HTTP status and the message. Details of a `500` are written
to the server log only. A `tokenId` that is numeric but not an integer (`1.5`) currently returns
`500`, not `400`.

List endpoints answer `200` with `[]` when nothing matches.

### Versioning and deprecation

- **The API is not versioned.** Paths are `/api/…`, with no `/v1`.
- There is no written deprecation policy. The one precedent is
  `GET /api/tokens/:tokenId/attendance`, which was kept as a route that answers `410 Gone` with a
  pointer to the replacement.
- Until versioning exists, treat field additions as possible at any time and write clients that
  ignore unknown fields. Field renames and removals are listed in the
  [changelog](quickstart.md#changelog).

## Security and access

### Authentication

None. Every endpoint is public and read-only. There are no API keys and no user accounts.

### CORS

Browser access is restricted by origin. `CORS_ALLOWED_ORIGINS` is a comma-separated list of
exact origins; if it is unset, no cross-origin browser requests are allowed. It is never `*`.
CORS does not restrict non-browser clients such as `curl` or a server.

### Rate limiting

**None**, neither in the application nor in Caddy. Combined with unpaginated list endpoints,
this is the main abuse risk. See [Performance](#performance).

### Transport

In production Caddy terminates TLS (Let's Encrypt), redirects HTTP to HTTPS and sets
`Strict-Transport-Security`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
Postgres and the indexer are not reachable from outside the host.

### Privacy

Every value the API returns is already public on-chain. The API still deserves care, because it
makes that data easy to query and because the server sees who asks.

**What the server can observe.** A request for `/api/tokens/owner/:ownerPk` tells the server
that this client is interested in that pseudonym. The web app, to list "my credentials", asks
for the user's pseudonym under *every* organizer, one request after another. Whoever operates
the API, or can read its traffic or logs, can therefore link one user's pseudonyms across
organizers. That is exactly the link the contract's per-organizer pseudonyms are designed to
hide.

- No access logging is configured in the application or in the Caddyfile. That is a deployment
  choice, not a guarantee: an operator can add it.
- A user who needs this protection should query through their own indexer, or over a network
  path that does not identify them.

**What anyone can learn by combining public data:**

| Query | Reveals |
|---|---|
| Tokens by owner pseudonym | Everything one holder has from one organizer, with mint blocks |
| An event's tokens | The full list of holder pseudonyms of the event: the anonymity set of its anonymous proofs. A short list means weak anonymity. |
| `mintedBlock` and `burnedBlock` | When each credential was issued and revoked. Timing can link a mint to something observed off-chain. |
| `tokenMetadataURI` | If an organizer uses personalized metadata, the content behind the URI may identify the holder. |
| Disclosure requests | What each verifier is asking, about which event, and when |
| Events by organizer, requests by verifier | Everything one organizer or verifier has done |

None of this breaks the contract's guarantees: the API cannot link pseudonyms across organizers
from the data, and cannot tell who made an anonymous proof. The full analysis is in
[Public and private data](../01-contract/data-privacy.md#indirect-leaks).

**Rule for anyone extending the API:** do not add endpoints that take several pseudonyms in one
request, or that accept a secret, a wallet address or anything else that would let the server
tie pseudonyms together.

## Performance

| Topic | Current state |
|---|---|
| Server-side cache | None. Every request runs its SQL query. |
| HTTP caching | Express adds a weak `ETag`. A request with `If-None-Match` gets `304 Not Modified` when the body is unchanged, but the query still runs. No `Cache-Control` header is sent on API responses. |
| Static ZK artifacts (`/zk/*`) | `Cache-Control: public, max-age=3600` |
| Compression | Caddy compresses responses (zstd, gzip) |
| Response size | Unbounded on list endpoints: `GET /api/events`, `GET /api/disclosure-requests`, `GET /api/credential-update-requests`, `GET /api/events/:eventId/tokens` |
| Query limits | None: no row limit, no statement timeout, no request timeout |
| Indexed lookups | All filters and joins used by the endpoints are backed by an index; see [Data model](../02-indexer/data-model.md#indexes) |

Freshness and caching: because the data only changes when the contract has an action, a client
can cache list responses for a few seconds, or revalidate with `If-None-Match`, without making
the data meaningfully staler than it already is.

The heaviest query is `GET /api/events/:eventId/tokens` for a large event. The contract allows
up to 1,048,576 tokens in total, so the worst case is a response with that many rows. If the API
is opened to third parties in earnest, add pagination and a rate limit first.
