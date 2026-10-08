# For integrators

## Quickstart

No key, no sign-up. The API is public and read-only.

**1. Check that it is up**

```bash
curl https://velum-api.adasouls.io/health
# {"status":"ok"}
```

**2. List the events**

```bash
curl https://velum-api.adasouls.io/api/events
```

Each event has an `eventId` (64 hex characters) and the organizer's `issuerPk`.

**3. Look at one event and its credentials**

```bash
EVENT=e66a035b06598dc62fac699291c2f3841dc746f1fedb45201bb11a2b219525a0

curl https://velum-api.adasouls.io/api/events/$EVENT
curl "https://velum-api.adasouls.io/api/events/$EVENT/tokens?includeBurned=false"
```

**4. Look at one credential**

```bash
curl https://velum-api.adasouls.io/api/tokens/0
```

That is the whole surface: events, tokens, disclosure requests, credential requests and credential
update requests. The
[endpoint reference](endpoints.md) has every field.

Three things to keep in mind from the start:

- **Identifiers are lowercase hex without `0x`.** Anything else matches nothing.
- **The data is a delayed copy of the chain**, and the API does not tell you how delayed. Do not
  use it to confirm a transaction or as proof of ownership.
- **`ownerPk` is not a wallet address.** It is a pseudonym that is different for every
  organizer. You cannot look up "everything this person holds" with one value.

From a browser, your origin must be on the server's CORS allowlist. From a server or `curl`
there is no restriction.

## Common use cases

### Show an event page

```bash
curl https://velum-api.adasouls.io/api/events/$EVENT
```

- Fetch `metadataURI` from an IPFS gateway for the name, description and image.
- `isActive`, `isPublicMint`, `maxSupply` and `expiration` tell you whether it can still be
  claimed. `maxSupply: 0` means unlimited; `expiration: 0` means never.
- Use `liveTokens` for "holders". `minted` counts burned tokens too.

### List an organizer's events

```bash
curl "https://velum-api.adasouls.io/api/events?issuerPk=<organizer public key>"
```

### Show the credentials a user holds

A user has one pseudonym per organizer. The client must compute them: the server cannot.

1. Get the list of organizers from `GET /api/events` (the distinct `issuerPk` values).
2. For each one, compute the user's pseudonym locally from their secret key:
   `H("adasouls:holder-pk:v1:", secretKey, issuerPk)`. See
   [Integration](../01-contract/integration.md#deriving-the-public-identifiers-off-chain).
3. Call `GET /api/tokens/owner/<pseudonym>` for each.
4. Drop tokens with `isBurned: true`.

This sequence shows the server all of the user's pseudonyms together. Read the
[privacy note](README.md#privacy) before using it against a server you do not operate.

### Check whether a credential is still valid

```bash
curl https://velum-api.adasouls.io/api/tokens/0
```

`isBurned: false` means it has not been burned or revoked, as of the last indexed block. For a
decision that matters, do not rely on this: ask the holder for a proof against a disclosure
request, which is checked on-chain.

### Size up the anonymity set of an event

```bash
curl "https://velum-api.adasouls.io/api/events/$EVENT/tokens?includeBurned=false" | jq length
```

The number of live credentials is the upper bound on how anonymous an anonymous proof for that
event can be. A verifier should check it before relying on anonymity; a holder's client should
show it before proving.

### Read what a verifier is asking

```bash
curl https://velum-api.adasouls.io/api/disclosure-requests/<requestId>
```

- `fieldId` and `setRoot` all zeros: an ownership-only request.
- Otherwise: "is the attribute `fieldId` of event `eventId` one of the values under `setRoot`?"
  The accepted values themselves come from the verifier, not from this API.

### Read a question about one holder's credential

```bash
curl https://velum-api.adasouls.io/api/credential-requests/<requestId>
curl "https://velum-api.adasouls.io/api/credential-requests?recipientPk=<holder pseudonym>"
```

A credential request holds up to four conditions, each "is the credential's private attribute
`fieldId` one of the values under `setRoot`?". The holder answers all of them in one proof, or
none. `slot` says where each answer goes in `proveCredentialAttributes`. These requests are not
listed under `/api/disclosure-requests`.

### List the requests a verifier has published

```bash
curl "https://velum-api.adasouls.io/api/disclosure-requests?verifierPk=<verifier public key>"
```

### List the update requests an issuer has to answer

```bash
curl "https://velum-api.adasouls.io/api/credential-update-requests?issuerPk=<issuer public key>&status=pending"
```

Each one names the token and carries `payloadCommit`. The request's content is not here: the
holder sends it to the issuer off-chain, and the issuer checks it against `payloadCommit` before
re-issuing or dismissing.

### Check what happened to a holder's update request

```bash
curl https://velum-api.adasouls.io/api/credential-update-requests/<tokenId>
```

- `pending`: the issuer has not acted yet.
- `dismissed`: the issuer or the admin closed it without re-issuing.
- `reissued`: the issuer or the admin replaced the credential with `reissueCredential`. The new
  credential is the token in `reissuedTokenId`, under the same `ownerPk`; that token carries
  `replacesTokenId` pointing back.
- `burned`: the token was burned without a replacement in the same transaction: a revocation or
  a self-burn.

### Follow new activity

There is no webhook, stream or "since" filter. Poll the list endpoints and compare, using the
`ETag` to skip unchanged responses:

```bash
curl -i https://velum-api.adasouls.io/api/events                      # note the ETag
curl -i -H 'If-None-Match: W/"…"' https://velum-api.adasouls.io/api/events   # 304 if unchanged
```

For anything real-time, subscribe to the contract on the Midnight indexer instead, as
[the Velum indexer itself does](../02-indexer/README.md#the-subscription).

### Verify that a proof was made

Not possible through this API. Proofs leave no rows. Look the transaction up on the Midnight
indexer and check that it is a successful call to the Velum contract with the expected entry
point and your request id. See
[End-to-end data flow](../00-overview/data-flow.md#case-2-a-holder-proves-attendance-anonymously).

## Run it locally

```bash
docker compose -f devnet.yml up -d
npx tsx scripts/deploy.ts
cd indexer && CONTRACT_ADDRESS=<address printed by deploy> npm start
curl http://localhost:3001/api/events
```

The full procedure is in [Local setup](../04-operations/local-setup.md).

## Changelog

The API is not versioned. Changes so far, newest first, from the commit history of
`indexer/src/api/`:

| Date | Change | Breaking? |
|---|---|---|
| Unreleased | Added `GET /api/credential-requests` (filters `verifierPk`, `recipientPk`, `eventId`) and `GET /api/credential-requests/:requestId`. Tokens gained `replacesTokenId`. Credential update requests gained `reissuedTokenId` and the status `reissued`, also accepted by `?status=` | No new required input. A request closed by a re-issue now reads `reissued`, not `burned` |
| 2026-10-07 | Added `GET /api/credential-update-requests` (filters `issuerPk`, `ownerPk`, `status`) and `GET /api/credential-update-requests/:tokenId` | No |
| 2026-10-04 | Disclosure requests gained `recipientPk`; `GET /api/disclosure-requests` gained the `recipientPk` filter | No |
| 2026-09-09 | Added `GET /api/disclosure-requests` and `GET /api/disclosure-requests/:requestId` | No |
| 2026-09-08 | Events gained `privateAttributesRoot` | No |
| 2026-08-18 | Tokens gained `tokenMetadataURI` and `tokenPrivateMetadataCommit`. `GET /api/tokens/:tokenId/attendance` now answers `410 Gone`: a token belongs to exactly one event (`firstEventId`). | **Yes** (attendance removed) |
| 2026-08-13 | Events and tokens gained `metadataURI` | No |
| 2026-08-11 | CORS allowlist (`CORS_ALLOWED_ORIGINS`); cross-origin browser access is off unless configured | Yes, for browser clients on other origins |
| 2026-08-10 | `GET /api/events` gained the `issuerPk` filter; `includeBurned` added to `GET /api/events/:eventId/tokens` | No |
| 2026-07-22 | First version: `/health`, events and tokens | — |

When you change a route, add a line here and update [`openapi.yaml`](openapi.yaml) in the same
commit.
