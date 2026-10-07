# Public and private data

This is the reference for what an outside observer can and cannot learn. It has three parts:

1. [Data map](#data-map): where each piece of data lives and who can see it.
2. [`disclose()` analysis](#disclose-analysis): every point where a private value is allowed to
   become public, and why.
3. [Indirect leaks](#indirect-leaks): what can be inferred without any value being disclosed.

## Data map

Data lives in one of four places:

| Place | Visible to |
|---|---|
| **Public ledger** (contract state on-chain) | Everyone, forever |
| **Private state** (the user's device) | The user. Also the proof server they use, while proving. |
| **Proof only** (inputs to a circuit that are not disclosed) | The user and their proof server. Never on-chain. |
| **Off-chain, shared** (handed between parties outside the contract) | Whoever it was shared with |

### Public ledger

| Data | Ledger field | Notes |
|---|---|---|
| Admin public key | `adminPk` | Fixed at deployment |
| Pause flag | `isPaused` | |
| Number of tokens ever minted | `totalSupply` | |
| Event parameters: supply cap, minted count, expiration, active flag, public-mint flag | `events` | |
| Event organizer's public key | `events[…].organizer` | The same key for all of an organizer's events |
| Event metadata URI | `events[…].metadataURI` | The content it points to is public too |
| Commitment to an event's hidden metadata | `events[…].privateMetadataCommit` | Hides the value until revealed |
| Root of an event's hidden attribute tree | `events[…].privateAttributesRoot` | Hides the attributes |
| Verified and blocked issuers | `issuers` | |
| Token owner (holder pseudonym) | `tokenOwner` | One pseudonym per holder per organizer |
| Token's event and issuer | `tokenEvent`, `tokenIssuer` | |
| Token metadata URI | `tokenMetadataURI` | |
| Commitment to a token's hidden metadata | `tokenPrivateMetadataCommit` | |
| Which tokens are burned | `burnedTokens` | |
| (holder, event) → token index | `eventHolderToken` | The key is a hash of two public values |
| Credential tree: leaf hashes and roots | `credentials` | See [below](#the-credentials-tree) |
| Disclosure requests: verifier's public key, event, field id, set root, recipient pseudonym (if addressed) | `disclosureRequests` | Anyone can see what verifiers ask, and of whom when a request is addressed |
| Single-use nullifiers | `usedDisclosures` | Not linkable to a wallet |
| Pending credential update requests: token id, commitment to the off-chain request | `credentialUpdateRequests` | Anyone can see that a token's holder asked its issuer for an update; the content (which document, the new number) is off-chain, encrypted to the issuer |
| Revealed metadata digests | `eventRevealedMetadata`, `tokenRevealedMetadata` | Public once revealed, permanently |

### Private state (user's device)

| Data | Notes |
|---|---|
| `secretKey` (`local_sk`) | The user's identity for this contract. Everything else derives from it. |
| `tokens` cache: event id → `{ tokenId, isSoulbound }` | Convenience only. Filled by `claim`, not by `mintTo`. Not used by any contract check. |

See [Private state](private-state.md).

### Proof only

These are passed to a circuit but never disclosed.

| Data | Circuit | Notes |
|---|---|---|
| Attribute `value` and `rand` | `proveAttributeMembership`, `proveAttributeMembershipOnce`, `proveCredentialAttribute` | |
| Attribute, set and credential Merkle paths | the same, plus `proveEventAttendance` | Only the credential path's *root* is disclosed |
| Token id, holder pseudonym, credential leaf | `proveEventAttendance`, `proveCredentialAttribute` | This is what makes an open attendance proof anonymous. Answering an addressed request shows that its recipient answered, so the pseudonym is known there. |
| The credential's attribute root | `proveEventAttendance`, `mintTo` | In `mintTo` it reaches the chain only hashed inside the credential leaf |
| `isSoulbound` | `claim` | Goes to the `store_token` witness only |

### Off-chain, shared between parties

The contract never sees these. How they are stored and delivered is the application's job.

| Data | Held by | Shared with |
|---|---|---|
| Opening of an event's hidden metadata (`value`, `rand`) | Organizer | Whoever should be able to reveal it |
| Event attribute openings (`fieldId`, `value`, `rand` per field) | Organizer | Whoever should be able to prove about them |
| Credential attribute openings | Organizer, at mint time | The recipient. The organizer knows them too. |
| The accepted values behind a request's `setRoot` | Verifier | Holders, so they can build a membership path |
| Identity document data (country, type, number) and the salt of each identity attribute | Organizer, at mint time; the holder | A verifier checking that document: the holder shows the document and gives them the salt |
| The content of a credential update request (which document, the new data) | Holder | The issuer only, encrypted. The ledger holds a commitment to it. |
| A holder's pseudonym for an organizer | Holder | The organizer, before a push-mint |
| Content behind `metadataURI` | Organizer | Public |

### The credentials tree

`credentials` is a Merkle tree with one leaf per token, at index `tokenId`:

```
leaf = H("adasouls:cred-leaf:v1:", eventId, holderPseudonym, credentialAttributesRoot)
```

The tree's contents are public. What an anonymous proof hides is *which* leaf the prover used: it
reveals only the root.

- For a `claim`ed token the attribute root is zero, so anyone can recompute the leaf from public
  data. That is fine: knowing the leaf does not help to produce a proof, because the circuit
  rebuilds the leaf from the prover's secret key.
- For a token minted with attributes, the leaf hides the attribute root.

## `disclose()` analysis

In Compact, values that come from a witness or a circuit argument are private by default. The
compiler rejects any path that could make them public unless it is wrapped in `disclose()`. So
`disclose()` is a permission, not a publication: the value becomes public only where it is then
stored on the ledger, used as a ledger key, or passed to a ledger check. Both columns are given
below.

For the rows where the answer is not obvious from the code (`claim`, `mintTo`, `burn`, the role
checks and the ownership proofs), the "Actually on-chain?" column was checked by inspecting the
public transcript the compiled contract produces for the call.

### Identities

| Disclosed value | Where | Actually on-chain? | Why it is acceptable |
|---|---|---|---|
| `derive_pk(local_sk())` | constructor | Yes, stored as `adminPk` | The admin is a public role |
| `derive_pk(local_sk())` | `caller_pk()`, used by every admin/organizer check | Only in `createEvent` (stored as organizer) and `publishDisclosureRequest` (stored as verifier). In the checks it is compared inside the proof against a value already on the ledger. | Organizer and verifier are public roles. A `claim` does not put the caller's public key on-chain. |
| `H(sk, issuerId)` holder pseudonym | `holder_pk()` | In `claim`: stored as `tokenOwner`. In `burn`, `mintTo`, `proveTokenOwnership`: compared inside the proof. | Minting is public by design. The pseudonym is per organizer, so it does not link a holder across organizers. |
| `H(sk, requestId)` nullifier | `disclosure_nullifier()` | Yes, added to `usedDisclosures` | Needed to block replays. It reveals neither the key nor the wallet, and differs per request. |

The secret key itself is never disclosed. `holder_secret_pk()` computes the same pseudonym as
`holder_pk()` *without* `disclose()`; it is the version used by the anonymous proofs, so the
compiler would reject any accidental ledger use of it.

### Circuit arguments

| Circuit | Disclosed | Actually on-chain? | Why |
|---|---|---|---|
| `registerIssuer`, `deactivateIssuer` | `issuerPk` | Yes, ledger key | The registry is public |
| `createEvent` | `label`, `maxSupply`, `expiration`, `isPublicMint`, `metadataURI`, `privateMetadataCommit`, `privateAttributesRoot` | Yes, stored in `events`. `label` only as part of the event id hash. | An event is public |
| `deactivateEvent`, `reactivateEvent` | `eventId` | Yes, ledger key | |
| `claim` | `eventId` | Yes | |
| `claim` | `isSoulbound` | **No.** It is only passed to the `store_token` witness; the transcript is identical for `true` and `false`. | See the note below |
| `mintTo` | `eventId`, `recipientPk`, `tokenMetadataURI`, `tokenPrivateMetadataCommit` | Yes, stored | The mint is public |
| `mintTo` | `credentialAttributesRoot` | Only hashed inside the credential leaf | The leaf must be on-chain for later proofs |
| `burn` | `tokenId` | Yes | A burn is public |
| `requestCredentialUpdate` | `tokenId`, `payloadCommit` | Yes, stored in `credentialUpdateRequests` | The issuer has to find the request and check the off-chain envelope against the commitment. The commitment reveals nothing about the content as long as the envelope is encrypted or otherwise unguessable. |
| `dismissCredentialUpdate` | `tokenId` | Yes, the ledger key removed | Closing a request is public. Whether the issuer or the admin closed it is not. |
| `revealPrivateMetadata`, `revealPrivateTokenMetadata` | id, `value`, `rand` | `value` is stored | Revealing is the purpose. Treat `rand` as public too after a reveal. |
| `publishDisclosureRequest` | `label`, `eventId`, `fieldId`, `setRoot`, `recipient`, the derived request id | Yes, stored. `label` only as part of the request id hash. | A request is public, including who it is addressed to |
| `proveAttributeMembership`, `proveAttributeMembershipOnce` | `requestId` | Yes, ledger key | The verifier must be able to find the answer to their request |
| `proveTokenOwnership` | `requestId`, `tokenId` | Yes, ledger keys | This is the public proof; use `proveEventAttendance` to hide the token |
| `proveEventAttendance`, `proveCredentialAttribute` | `requestId`, the credential path's Merkle root | Yes | The chain has to check the root against the tree. The root is the same for every holder using that tree version. |

**Note on `isSoulbound`.** The `disclose()` around it in `claim` is not needed: the contract
compiles without it (checked with compiler 0.31.1), and the value never reaches the ledger.
Removing it would be a cleanup, but it changes the `claim` circuit and so needs a contract
upgrade.

### Local helpers

`computeEventId`, `computePrivateMetadataCommit`, `computeAttributeLeaf`,
`computeCredentialLeaf`, `computeCredentialAttrLeaf` and `computeIdentityValue` wrap their inputs
in `disclose()`. These
circuits run on the caller's machine with no transaction, so nothing reaches the chain. The
`disclose()` is there so the result can leave the circuit.

`getCallerPk` and `getHolderPk` likewise return a disclosed value to the caller only.

## Indirect leaks

Nothing in this section is a bug. It is what the design gives away through metadata.

### What every transaction reveals

- **Which circuit was called.** A transaction calling `proveCredentialAttribute` is visibly
  different from one calling `proveEventAttendance`. Velum's own receipt checker relies on this.
- **When it was called.**
- **The ledger keys it touched.** Every map lookup puts its key in the public transcript. This is
  why the anonymous proofs go through a Merkle tree instead of looking a token up by id.

### Linking holders

- **Within one organizer, a holder's tokens are linked.** The pseudonym is the same for every
  event of that organizer. This is deliberate: it is what makes "one token per holder per event"
  enforceable.
- **Across organizers, they are not linked** by anything in the contract.
- **The organizer knows who is behind a pseudonym** whenever they push-minted to it, because the
  holder had to give it to them.
- **An organizer's events are all linked** through their public key, as are a verifier's requests.

### Anonymous proofs

- **The anonymity set is the event's live credentials.** In an event with five holders, an
  anonymous proof narrows the prover down to one of five.
- **An addressed request has no anonymity set.** The request names one holder pseudonym on the
  ledger and only that holder can answer, so a successful proof shows that pseudonym answered.
  What stays hidden is what the proof was about: the token id and the attribute value.
- **`proveCredentialAttribute` is never anonymous.** It only accepts addressed requests, so every
  proof about a credential's private attribute is tied to a named pseudonym. The value itself
  is not disclosed.
- **Whether a token carries private attributes is visible.** Anyone can recompute the leaf a
  token would have with a zero attribute root and compare it with the tree.
- **Set size.** A request whose accepted set has one member turns "is a member" into "has exactly
  this value". The contract cannot enforce a minimum set size from a root.
- **Timing.** A proof submitted right after a mint, or right after a verifier hands a request to
  one specific person, points at that person regardless of the cryptography.
- **Tree version.** The disclosed root identifies the state of the tree the path was built
  against. Building against the latest root keeps the prover among everyone proving at that
  moment; an old root narrows down when the path was built.
- **Relaying.** A proof for an open request shows that *someone* holding a valid credential
  answered, not that it was the person in front of the verifier. A holder can forward the request
  to another holder. Publish one request per verification session to keep answers fresh, and
  address the request when it matters who answers. An addressed request can only be answered
  with the recipient's secret key; it still cannot stop the recipient from sharing that key.

### Burns

- A self-burn and a revocation produce different transcripts (only a self-burn removes the
  `eventHolderToken` entry), so an observer can tell them apart.
- A revocation by the issuer and one by the admin are not distinguishable from the transcript.
  The same holds for `mintTo` and `deactivateEvent`.

### Single-use proofs

- Each `proveAttributeMembershipOnce` adds one nullifier, so anyone can count how many times a
  request was redeemed.
- Nullifiers for different requests are unlinkable, even from the same key.

### Commitments

- A commitment hides its value only if `rand` is random and used once. Reusing `rand` across
  attribute leaves lets known-value leaves be linked, and for low-entropy fields (country codes,
  tiers) can make the whole tree guessable once one field is known.
- `metadataURI` is public. A per-token URI that points to personalized content identifies the
  holder as well as any on-chain field would.

### Outside the contract

The contract controls what it writes to the ledger. It does not control who paid the transaction
fee, the network connection the transaction came from, or what the services a client talks to
can observe. Those are covered in [Security](security.md#known-privacy-limits).
