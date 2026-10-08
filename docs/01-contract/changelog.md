# Changelog

Changes to [`contracts/compact/poap.compact`](../../contracts/compact/poap.compact), newest
first, and what was done on-chain. Add an entry whenever the contract changes, and say whether
it needs an upgrade, a new deployment, or nothing.

| Needs | Meaning |
|---|---|
| **Nothing** | Keys unchanged (comments, formatting) |
| **Upgrade** | Circuit logic changed; ledger layout and circuit signatures unchanged. Applied with `scripts/upgrade.ts`. |
| **New deployment** | Ledger layout or a circuit signature changed. New address; indexer database reset. |

## Unreleased

- **Multi-condition credential requests and atomic re-issue.** A verifier can ask several
  things about one holder's credential as one question that can only be answered whole, and an
  issuer can replace a credential in one transaction.
  - New struct `CredentialCondition { fieldId, setRoot }` and
    `CredentialRequest { verifier, eventId, recipient, conditions: Vector<4, CredentialCondition> }`.
    Unused condition slots are all-zero; the first slot must be used. A credential request is
    always addressed.
  - New ledger field `credentialRequests: Map<Bytes<32>, CredentialRequest>`. Request ids are
    derived as for disclosure requests (hash of the verifier's key and a label) but live in
    their own map.
  - New circuit `publishCredentialRequest(label, eventId, recipient, conditions)`: a verifier
    pins a question of up to four conditions for one holder; returns the request id.
  - New circuit `proveCredentialAttributes(requestId, values, rands, attributePaths,
    setMembershipPaths, credPath)`: one proof, one transaction, answers every used condition of
    the request against one credential. All or nothing: there is no proof of a subset. Writes
    nothing; works while paused.
    Why: with one request per condition, someone who borrowed a friend's key could have the
    friend answer the grade request alone and show only that proof, skipping the identity
    request. Now identity and grade are one request.
  - **Breaking:** `proveCredentialAttribute` is removed. Requests published with
    `publishDisclosureRequest` can no longer be used for a credential's private attributes; they
    still serve `proveTokenOwnership`, `proveEventAttendance`, `proveAttributeMembership` and
    `proveAttributeMembershipOnce`. The frontend must use `publishCredentialRequest` and
    `proveCredentialAttributes`.
  - New circuit `reissueCredential(tokenId, newMetadataURI, newPrivateMetadataCommit,
    newCredentialAttributesRoot)`: the token's issuer or the admin replaces a live credential in
    one transaction. The old token is burned, a new one is minted to the same holder pseudonym
    and event, the pending update request on the old token is removed and the holder's
    `eventHolderToken` slot moves to the new token. It does not increment the event's `minted`
    counter and does not check `maxSupply`; `totalSupply` still grows. The event must be active
    and not expired, and its issuer not blocked. Every check runs before any write, so a failed
    re-issue leaves the old credential untouched.
  - **Breaking:** re-issuing is `reissueCredential`, not `burn` + `mintTo`. As two transactions,
    a mint that failed after the burn left the holder with no credential. `burn` is unchanged,
    and `mintTo` after a revocation still works (that path does use up supply).
  - Indexer (migration `005`): new table `credential_requests`; new column
    `tokens.replaces_token_id`; new column `credential_update_requests.reissued_token_id` and
    new status `reissued`. `burned` now only means a revocation or a self-burn.
  - API: new `/api/credential-requests` (filters `?verifierPk=`, `?recipientPk=`, `?eventId=`)
    and `/api/credential-requests/{requestId}`; new field `replacesTokenId` on tokens; new field
    `reissuedTokenId` and status `reissued` on credential update requests, also accepted by
    `?status=`.
  - `scripts/deploy.ts`: `PROOF_CIRCUIT_IDS` updated (`proveCredentialAttribute` out;
    `reissueCredential`, `publishCredentialRequest` and `proveCredentialAttributes` in).

  **Needs: new deployment.** New ledger field, one circuit removed and three added. Every
  circuit's keys change. New address, indexer database reset, and a frontend build with the new
  contract artifacts, zkir and keys (all 22 circuits).

  **On-chain (preprod):** not deployed yet. Preprod still runs the previous contract, at
  `fadfffaec26bf23b09de98e9fc3486f5d09589c5de5602af148338f4aead152a`.

- **Identity documents and credential update requests.** Lets a verifier make sure a credential
  belongs to the person they checked, not to a friend who lent their key, and lets a holder ask
  for a credential to be re-issued when one of its documents changes.
  - New pure helper `computeIdentityValue(country, docType, number, salt)`: the attribute value
    that ties a credential to one identity document (`H("velum:identity:v1:", …)`). Stored as an
    ordinary credential attribute, one per document, each under its own `fieldId`; all optional.
    A verifier proves it with the existing `proveCredentialAttribute`, against an addressed
    request whose set is the one value rebuilt from the document they checked. Rejects an
    all-zero salt.
  - New ledger field `credentialUpdateRequests: Map<Uint<64>, Bytes<32>>` (tokenId → commitment
    to the off-chain request).
  - New circuit `requestCredentialUpdate(tokenId, payloadCommit)`: the token's holder files or
    replaces a request.
  - New circuit `dismissCredentialUpdate(tokenId)`: the token's issuer or the admin closes it
    without re-issuing.
  - `burn` also removes the token's pending request. Re-issuing is `burn` + `mintTo`, as before.
  - Indexer: new table `credential_update_requests` (migration `004`); API: new
    `/api/credential-update-requests` with `?issuerPk=`, `?ownerPk=`, `?status=` filters.
  - `scripts/deploy.ts`: the two new circuits added to `PROOF_CIRCUIT_IDS`; new
    `SKIP_DEMO_EVENT=1` option to deploy the contract empty.

  **Needs: new deployment.** New ledger field and two new circuits. Every circuit's keys change:
  the compiler lays the ledger out again when a field is added, whatever its position. New
  address, indexer database reset, and a frontend build with the new contract artifacts, zkir
  and keys (all 20 circuits).

  **On-chain (preprod):** deployed 2026-10-07 (2026-10-06 22:32 UTC), address
  `fadfffaec26bf23b09de98e9fc3486f5d09589c5de5602af148338f4aead152a`. Deployed empty (no demo
  event). The API host follows it since the same day; the frontend needs a build with the new
  address and artifacts. See [`deployments/preprod.md`](../../deployments/preprod.md).

- **Addressed disclosure requests.** `DisclosureRequest` gains a `recipient` field and
  `publishDisclosureRequest` a `recipient` argument: the holder pseudonym (`getHolderPk`) that
  must answer, or all zeros for an open request.
  - `proveTokenOwnership` and `proveEventAttendance` enforce the recipient when the request has
    one. Open requests behave as before.
  - **Breaking:** `proveCredentialAttribute` rejects open requests. A credential's private
    attribute can only be proven by the holder the request is addressed to; before, any holder
    of the event with a qualifying attribute could answer.
  - `proveAttributeMembership` and `proveAttributeMembershipOnce` (event-level attributes)
    ignore the recipient.
  - Indexer: new column `disclosure_requests.recipient_pk` (migration `003`); API: new field
    `recipientPk` and filter `?recipientPk=` on `/api/disclosure-requests`.

  **Needs: new deployment.** The ledger layout (`DisclosureRequest`) and a circuit signature
  (`publishDisclosureRequest`) changed. New address, indexer database reset, and a frontend build
  with the new contract artifacts.

  **On-chain (preprod):** deployed 2026-10-04, address
  `5e303d805abf829e3595dca0402f5871490e4bc2336a65f440689c78ecd8b527`. Replaced on 2026-10-07 by
  the deployment above.
- Structured documentation tags added to the contract (`@ledger`, `@witness`, `@circuit`, …) and
  the `docs/` folder created. **Needs: nothing.** Prover and verifier keys are byte-identical to
  the previous build; only line numbers in the generated `contract/index.js` changed.

## 2026-10-01 — moderation, re-issue, organizer restrictions

Commits `d47ca63`, `6033d4f`, `29879df`.

- `deactivateIssuer` works on any key, registered or not, and is permanent. A blocked issuer
  cannot create events.
- `reactivateEvent` is now admin-only. An organizer can no longer undo a takedown.
- `mintTo` can re-issue a credential to a holder whose token was revoked.
- An organizer can no longer `claim` their own event or `mintTo` their own pseudonym.
- In-place upgrade tooling added (`scripts/upgrade.ts`).

**On-chain (preprod):** upgraded in place on 2026-10-01, blocks 2786573–2786609. Circuits
swapped: `deactivateIssuer`, `createEvent`, `reactivateEvent`, `claim`, `mintTo`. Same address.

## 2026-09-24 — ownership proofs and per-credential attributes

Commit `7be09c6`.

- New ledger field `credentials` (historic Merkle tree, depth 20), written at every mint.
- New circuits: `proveTokenOwnership`, `proveEventAttendance`, `proveCredentialAttribute`.
- New pure helpers: `computeCredentialLeaf`, `computeCredentialAttrLeaf`.
- `mintTo` takes a `credentialAttributesRoot`.
- `burn` clears the credential leaf and resets the tree's root history.

**On-chain (preprod):** first deployment of the current contract, 2026-09-24, address
`3ce0a48228880fa377d22d364a1ad19fee5cb6e26a8ed80de11d7ab07433ceef`. Deployed in stages (shell,
then one verifier key per transaction). See [`deployments/preprod.md`](../../deployments/preprod.md).

## 2026-09-09 — remaining security review findings

Commit `f671ab1`.

- **Breaking:** `createEvent` takes a `label` and returns a derived event id, instead of
  accepting a caller-chosen id (event-id squatting, H-3). New pure helper `computeEventId`.
- Event expiration is enforced at mint time.
- A deactivated issuer's events can no longer mint.
- Only a self-burn frees the holder's claim slot; a revocation does not.
- All-zero commitments and roots are rejected explicitly.
- `adminPk` is `sealed`.
- New circuit `reactivateEvent`.

## 2026-09-08 — selective disclosure, and its critical fix

Commits `bcfaf28`, `7ca2570`.

- Event-level private attributes: `privateAttributesRoot`, `computeAttributeLeaf`,
  `proveAttributeMembership`, `proveAttributeMembershipOnce`, `usedDisclosures`.
- **Critical fix (C-1, H-1):** the set being proven against must be published on-chain first.
  New `publishDisclosureRequest` and `disclosureRequests`; the proof circuits take a `requestId`
  instead of a set root.
- The attribute leaf hash gained a domain tag and the event id.

## 2026-08-18 — one token per claim, per-token metadata, revocation

Commit `b3ee3c4`.

- Every claim mints a new token; a token belongs to exactly one event.
- Per-token metadata URI and private-metadata commitment, with `revealPrivateTokenMetadata`.
- The issuer and the admin can burn (revoke) tokens.

## 2026-08-14 — permissionless events and holder pseudonyms

Commit `ae21022`.

- Anyone can create an event; the issuer registry becomes optional.
- Holders are identified by a per-issuer pseudonym (`holder_pk`) instead of one global key.
- Event-level private metadata: `privateMetadataCommit` and `revealPrivateMetadata`.

## 2026-08-13 — event metadata

Commit `000a45c`.

- Events carry a `metadataURI`.

## 2026-07-22 and earlier — first versions

Commits `0706a73`, `8f46c2a`.

- Initial contract (2026-06-13): events and claiming.
- 2026-07-22: issuer registry, pause, burn and organizer push-mint (`mintTo`).
