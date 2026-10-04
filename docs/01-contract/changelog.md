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
  `5e303d805abf829e3595dca0402f5871490e4bc2336a65f440689c78ecd8b527`. The API host and the
  frontend still point at the previous contract. See
  [`deployments/preprod.md`](../../deployments/preprod.md).
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
