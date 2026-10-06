# Circuits and flows

## What happens when a circuit is called

Every call to a proof-requiring circuit goes through the same four stages. The first two happen
on the user's side; only the last one is on-chain.

| Stage | Where | What happens |
|---|---|---|
| 1. Execute | User's device | The compiled contract (`contract/index.js`) runs the circuit in JavaScript against the current ledger state. Witnesses are called here and return private data. The run produces the circuit's result, the list of ledger operations it performed (the **public transcript**) and the private inputs. Any failed `assert` stops here: nothing is sent. |
| 2. Prove | Proof server | The proof server receives the private inputs and builds a zero-knowledge proof that the circuit was executed correctly and produced that transcript. Because it sees the private inputs, it should run on a machine the user trusts. |
| 3. Balance and submit | Wallet | The wallet adds the DUST fee, the user approves, and the transaction is submitted. |
| 4. Verify and apply | Chain | The network verifies the proof against the circuit's verifier key stored in the contract, then applies the transcript's ledger operations. |

So "verified on-chain" below means: the chain checked a proof that the listed `assert`s held. The
chain never sees witness outputs or undisclosed arguments.

## Circuit reference

The contract exports 28 circuits. 20 of them need a proof and a transaction.

### State-changing (proof + transaction)

| Circuit | Caller | Effect |
|---|---|---|
| `pause` / `unpause` | Admin | Sets `isPaused` |
| `registerIssuer(issuerPk)` | Admin | Marks an organizer as verified |
| `deactivateIssuer(issuerPk)` | Admin | Blocks an organizer permanently |
| `createEvent(label, maxSupply, expiration, isPublicMint, metadataURI, privateMetadataCommit, privateAttributesRoot)` | Anyone not blocked | Creates an event; returns its id |
| `deactivateEvent(eventId)` | Admin or organizer | Stops minting for the event |
| `reactivateEvent(eventId)` | Admin | Resumes minting |
| `claim(eventId, isSoulbound)` | Anyone but the organizer | Mints a token of a public event to the caller |
| `mintTo(eventId, recipientPk, tokenMetadataURI, tokenPrivateMetadataCommit, credentialAttributesRoot)` | Admin or organizer | Mints a token to a recipient; re-issues after a revocation |
| `burn(tokenId)` | Owner, issuer or admin | Burns or revokes a token; removes its pending update request |
| `requestCredentialUpdate(tokenId, payloadCommit)` | Token owner | Files or replaces a request to re-issue the credential |
| `dismissCredentialUpdate(tokenId)` | Issuer or admin | Closes a pending update request without re-issuing |
| `revealPrivateMetadata(eventId, value, rand)` | Anyone with the opening | Publishes an event's committed metadata digest |
| `revealPrivateTokenMetadata(tokenId, value, rand)` | Anyone with the opening | Publishes a token's committed metadata digest |
| `publishDisclosureRequest(label, eventId, fieldId, setRoot, recipient)` | Anyone | Pins a verifier's question, open or addressed to one holder; returns its id |
| `proveAttributeMembershipOnce(requestId, value, rand, attributePath, setMembershipPath)` | Anyone with the opening | Proof below, plus a single-use nullifier |

### Proof-only (proof + transaction, no ledger writes)

These signal success by not failing. A verifier looks for a confirmed transaction that called the
circuit with their `requestId`. They also work while the contract is paused.

A request is either **open** (`recipient` all zeros: any holder of the event can answer) or
**addressed** (`recipient` is a holder pseudonym: only that holder can answer). The three holder
proofs enforce the recipient of an addressed request. `proveCredentialAttribute` accepts addressed
requests only.

| Circuit | Proves | Becomes public |
|---|---|---|
| `proveTokenOwnership(requestId, tokenId)` | Caller owns live token N of the request's event, and is the recipient if the request is addressed | request id, token id |
| `proveEventAttendance(requestId, credAttrRoot, credPath)` | Caller owns some live token of the request's event, and is the recipient if the request is addressed | request id, a credentials-tree root |
| `proveCredentialAttribute(requestId, value, rand, attributePath, setMembershipPath, credPath)` | Caller is the request's recipient, owns a live token of its event, and the credential's private attribute is in the request's set | request id, a credentials-tree root; through the request, who answered |
| `proveAttributeMembership(requestId, value, rand, attributePath, setMembershipPath)` | An event-level private attribute is in the request's set | request id |

### Local helpers (no proof, no transaction)

| Circuit | Returns |
|---|---|
| `getCallerPk()` | The caller's public key (uses the `local_sk` witness) |
| `getHolderPk(issuerId)` | The caller's holder pseudonym under an issuer (uses `local_sk`) |
| `computeEventId(organizer, label)` | The id `createEvent` will assign |
| `computePrivateMetadataCommit(value, rand)` | The commitment `reveal…` will check |
| `computeAttributeLeaf(eventId, fieldId, value, rand)` | A leaf of an event's attribute tree |
| `computeCredentialAttrLeaf(fieldId, value, rand)` | A leaf of a credential's attribute tree |
| `computeCredentialLeaf(eventId, holderPk, credAttrRoot)` | A leaf of the `credentials` tree |
| `computeIdentityValue(country, docType, number, salt)` | The attribute value that ties a credential to one identity document |

The last six are exposed as `pureCircuits` in the generated API. `getCallerPk` and `getHolderPk`
need a circuit context because they call a witness, and they are not part of the transaction API
(`callTx`), so the frontend re-derives both values locally instead.

### Internal circuits

Not exported; they exist only inside other circuits: `derive_pk`, `caller_pk`, `holder_pk`,
`holder_secret_pk`, `is_admin`, `event_key`, `holder_event_key`, `credential_leaf`,
`credential_attr_leaf`, `attribute_leaf_hash`, `disclosure_request_key`, `disclosure_nullifier`,
`mintTokenTo`.

---

## Flows

Each flow lists what the client does locally and what the chain verifies.

### 1. Create an event

**Locally**

1. (Optional) Private metadata: pick `value` (a 32-byte digest of the hidden content) and a fresh
   32-byte `rand`; compute `computePrivateMetadataCommit(value, rand)`. Keep both.
2. (Optional) Private attributes: for each field, pick a fresh `rand` and compute
   `computeAttributeLeaf(eventId, fieldId, value, rand)`. Build a depth-8 Merkle tree over the
   leaves (up to 256) and keep its root, plus every `(fieldId, value, rand)`.
   The leaves include the event id, so compute it first with `computeEventId(organizerPk, label)`.
3. Call `createEvent`. The `local_sk` witness supplies the organizer's secret key.

**Verified on-chain**

- The contract is not paused.
- The caller's public key is not blocked in `issuers`.
- No event exists yet with id `H(organizerPk, label)`.

**Result:** `events[eventId]` holds the public parameters, the organizer's public key and the two
commitments. Pass all-zero bytes for a commitment the event doesn't use.

### 2. Claim (self-service)

**Locally**

1. Call `claim(eventId, isSoulbound)`.
2. `local_sk` supplies the secret key. The circuit derives the caller's holder pseudonym for this
   event's organizer.
3. After the mint, the `store_token` witness saves `{ tokenId, isSoulbound }` in the caller's
   private state.

**Verified on-chain**

- Not paused; the event exists and has `isPublicMint`.
- The caller's public key is not the organizer's.
- The event is active, not expired (`expiration == 0` or block time before it) and under
  `maxSupply` (`0` = unlimited).
- The organizer is not blocked.
- This pseudonym has no token for this event yet.
- `tokenId` is below 2^20.

**Result:** a new token whose owner is the pseudonym, inheriting the event's metadata URI and
private-metadata commitment. A credential leaf
`H(eventId, pseudonym, 0)` is inserted in the `credentials` tree at index `tokenId`.

### 3. Push-mint with private attributes

**Locally (organizer)**

1. Get the recipient's holder pseudonym for this organizer (`getHolderPk(organizerPk)` on the
   recipient's side). It must be the pseudonym, not the recipient's public key: a token minted to
   the wrong value can never be proven or burned by its intended owner.
2. (Optional) Build the recipient's attribute tree: one
   `computeCredentialAttrLeaf(fieldId, value, rand)` per field, depth 8. Keep the root.
3. Call `mintTo(eventId, recipientPk, tokenMetadataURI, tokenPrivateMetadataCommit, root)`.
4. Deliver the openings (`fieldId`, `value`, `rand` for each leaf) to the recipient off-chain. The
   recipient needs them to prove anything about the attributes. In the Velum web app they are
   encrypted to the recipient and stored through the API host; the contract is not involved.

**Verified on-chain**

- Not paused; the event exists.
- The caller is the admin or the event's organizer.
- The recipient is not the caller's own pseudonym.
- Same event checks as `claim` (active, not expired, under supply, issuer not blocked). The
  `isPublicMint` flag is not required.
- The recipient has no live token for the event. If their previous one was revoked, the new one
  replaces it.

**Result:** as in `claim`, but the credential leaf is `H(eventId, recipientPk, root)`. The
recipient's private state is not touched; they find the token through the indexer.

### 4. Publish a disclosure request (verifier)

**Locally**

1. For an attribute question, build a depth-16 Merkle tree over the accepted values (up to 65,536)
   and keep its root. For an ownership-only question, use all-zero `fieldId` and `setRoot`.
2. Decide who may answer. To address the request to one person, get their holder pseudonym for
   the event's issuer: they read it with `getHolderPk(issuerId)` and hand it over, and it is the
   `ownerPk` of their token in the API, so it can be checked before publishing. For an open
   request, use an all-zero `recipient`. A question about a credential's private attribute
   (flow 7) must be addressed.
3. Call `publishDisclosureRequest(label, eventId, fieldId, setRoot, recipient)`.
4. Give the returned `requestId` to the holder, together with the list of accepted values so they
   can build a membership path.

**Verified on-chain**

- Not paused; the event exists; no request exists yet with id `H(verifierPk, label)`.
- The recipient is stored as given. It is not checked against `tokenOwner`: a request addressed
  to a pseudonym with no live credential of the event can simply never be answered.

**Why this step exists:** a circuit argument is chosen by the prover. If the prover could pass the
set root directly, they could invent a one-element set containing their own value, and the proof
would mean nothing. Reading the root from the ledger makes it the verifier's choice. It also ties
each proof to one request, so the verifier can tell a fresh answer from an old one. Publish one
request per verification session.

**Why address a request:** an open request can be answered by any holder of the event, so the
person in front of the verifier can pass it to someone else who qualifies. An addressed request
stores the pseudonym on the ledger, and the proof circuits compare it with the pseudonym rebuilt
from the prover's own secret key. The cost is that an addressed request, and so who answered it,
is public. That fits a verifier who already knows the person, such as an admissions office
checking an applicant. Use an open request when the holder should stay anonymous.

### 5. Prove ownership (public)

**Locally:** call `proveTokenOwnership(requestId, tokenId)`.

**Verified on-chain**

- The request exists.
- The token exists, is not burned and belongs to the request's event.
- `holder_pk(tokenIssuer[tokenId])`, derived from the caller's secret key, equals
  `tokenOwner[tokenId]`.
- If the request is addressed, that pseudonym equals the request's `recipient`.

**The verifier learns** which token, and therefore which pseudonym, answered.

### 6. Prove attendance (anonymous)

**Locally**

1. Read the current `credentials` tree from the ledger.
2. Compute your leaf with `computeCredentialLeaf(eventId, holderPk, credAttrRoot)` and get its
   Merkle path at index `tokenId` (`ledger.credentials.pathForLeaf`).
3. Call `proveEventAttendance(requestId, credAttrRoot, credPath)`.

**Verified on-chain**

- The request and its event exist.
- If the request is addressed, the caller's pseudonym, rebuilt from their secret key, equals the
  request's `recipient`.
- The leaf rebuilt *inside the circuit* from the request's event, the caller's secret key and
  `credAttrRoot` equals the path's leaf.
- The path's root is a root the `credentials` tree has had since the last burn.

**The verifier learns** that someone holds a live credential of the event. Not which token, not
which pseudonym. For an addressed request the pseudonym is known, since only the recipient can
answer; the token id still stays out of the transcript. The tree is historic, so a path built before later mints still verifies. A burn
resets the root history: paths built before it stop working and must be rebuilt.

### 7. Prove a private credential attribute (addressed)

**Locally**

1. From the openings received at mint time, rebuild the credential's attribute tree and get the
   depth-8 path of the requested field.
2. Find your value in the verifier's set and get its depth-16 path.
3. Get your credential path as in flow 6.
4. Call `proveCredentialAttribute(requestId, value, rand, attributePath, setMembershipPath, credPath)`.

**Verified on-chain**

- The request and its event exist.
- The request is addressed (an open request is rejected), and the caller's pseudonym, rebuilt
  from their secret key, equals its `recipient`.
- `(fieldId from the request, value, rand)` hashes to the attribute path's leaf.
- The attribute path's root, combined with the event and the caller's pseudonym, gives the
  credential path's leaf. The attribute root is never an input: it is recomputed, so only
  openings the organizer committed for this holder work.
- The credential path's root is known to the `credentials` tree.
- `value` is the set path's leaf and that path's root equals the request's `setRoot`.

**The verifier learns** that some holder of the event has an attribute in the accepted set.

### 8. Prove an event-level attribute

Same idea, about an attribute of the *event* (committed in `privateAttributesRoot`), not of a
credential. The prover is whoever knows the opening, normally the organizer or someone they shared
it with. Holding a token is not required.

- `proveAttributeMembership` writes nothing.
- `proveAttributeMembershipOnce` additionally records a nullifier, so the same secret key cannot
  answer the same request twice. It fails while the contract is paused.

### 9. Reveal committed metadata

**Locally:** call `revealPrivateMetadata(eventId, value, rand)` or
`revealPrivateTokenMetadata(tokenId, value, rand)` with the opening kept from creation.

**Verified on-chain:** not paused; the target exists and has a non-zero commitment;
`persistentCommit(value, rand)` equals it.

**Result:** `value` is written to `eventRevealedMetadata` / `tokenRevealedMetadata` and is public
from then on. There is no caller check: knowing the opening is the authorization. Use this when
the content is meant to become public; use the proofs in flows 7 and 8 when it is not.

### 10. Burn, revoke and re-issue

**Locally:** call `burn(tokenId)`.

**Verified on-chain**

- Not paused; the token exists and is not already burned.
- The caller is the owner (pseudonym matches), the token's issuer, or the admin.

**Result**

| | Self-burn (owner) | Revocation (issuer or admin) |
|---|---|---|
| `burnedTokens[tokenId]` | set | set |
| Credential leaf | cleared, root history reset | cleared, root history reset |
| `eventHolderToken` slot | removed: the holder can `claim` again | kept: the holder cannot `claim` again |
| Replacement | holder claims again | issuer or admin calls `mintTo` for the same recipient |

`totalSupply` and the event's `minted` counter are never decremented, so a burned token still
counts toward `maxSupply`.

### 11. Moderation

| Action | Circuit | Reversible? |
|---|---|---|
| Stop everything | `pause` | Yes, `unpause` |
| Take an event down | `deactivateEvent` (admin or organizer) | Only by the admin, `reactivateEvent` |
| Block an organizer | `deactivateIssuer` | No. A blocked key cannot be registered again |
| Revoke a credential | `burn` | No, but a replacement can be issued |

A blocked organizer cannot create events, and no token can be minted under their existing events.
Tokens already minted are unaffected.

### 12. Tie a credential to identity documents

Answers credential lending: someone hands a verifier the key of a friend who qualifies, and the
friend answers the request. An addressed request only proves "the owner of this key"; an identity
attribute proves the credential belongs to the person whose document the verifier checked.

**Issuer, at mint time (flow 3).** For each document the credential should carry (none, one or
several; all optional):

1. Normalize it: country as ISO 3166-1 alpha-3 (`ARG`), a document type (`national_id`,
   `passport`, …), the number upper-case without spaces or separators. Prefer a number that lasts
   a lifetime (the person's national id number, not the card's serial).
2. Draw a random 32-byte salt and compute `computeIdentityValue(country, docType, number, salt)`,
   each text input right-padded with zeros to 32 bytes.
3. Store it as a credential attribute under its own `fieldId`, like any other attribute. The
   holder receives the salt with the other openings.

**Verifier.** Checks the person's document as usual and asks them for that document's salt. They
compute the same value, publish an addressed request whose set holds only that value, and the
holder answers with `proveCredentialAttribute` (flow 7). Ask the real question (e.g. a grade) in a
second request addressed to the same pseudonym: a holder has one credential per event, so both
proofs are about the same credential.

**What it stops.** The friend's credential holds the friend's document, so the identity proof
fails for the person being checked, even with the friend's salt. What it relies on: the issuer
checked the document before issuing, and the verifier checks the person's.

**Why the salt.** The request's `setRoot` is public. Without a salt, document numbers are few
enough to brute-force from it, linking the pseudonym to the document for anyone watching.

### 13. Request a credential update

When a document behind a credential changes, the credential has to be re-issued: its attributes
are fixed in its credential leaf.

1. **Holder.** Encrypt the request (which document, the new data) to the issuer and send it
   off-chain. Call `requestCredentialUpdate(tokenId, payloadCommit)` with a commitment to that
   envelope (e.g. its hash). Filing again replaces the commitment.
2. **Issuer.** Find pending requests (indexer: `/api/credential-update-requests?issuerPk=…&status=pending`),
   check the envelope against `payloadCommit`, verify the new document, then either:
   - re-issue: `burn(tokenId)`, which also removes the request, then `mintTo` the updated
     credential for the same pseudonym (flow 10); or
   - `dismissCredentialUpdate(tokenId)`.

**Verified on-chain**

- `requestCredentialUpdate`: not paused; the token exists, is not burned, and the caller's
  pseudonym is its owner; the commitment is not all zeros.
- `dismissCredentialUpdate`: not paused; the token has a pending request; the caller is its issuer
  or the admin.

**Public:** that a token's holder asked for an update, and when. The content stays off-chain.
