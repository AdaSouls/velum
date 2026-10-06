# Invariants and cryptography

## Ledger invariants

Properties that hold after every transaction. "Enforced by" says what guarantees each one.

### Identity and roles

| Invariant | Enforced by |
|---|---|
| `adminPk` never changes after deployment. | `sealed`: the compiler rejects writes outside the constructor. |
| An event's organizer never changes. | The event id is `H(organizer, label)`, and every rewrite of an `EventRecord` copies `organizer` forward. |
| An event id can only be created by the organizer whose key is hashed into it. | `createEvent` derives the id from the caller's own key. Nobody can take another organizer's id. |
| A blocked issuer stays blocked. | There is no unblock circuit, and `registerIssuer` refuses a key that already has an entry. |
| A disclosure request never changes once published. | `publishDisclosureRequest` refuses an existing id; no other circuit writes the map. |
| An addressed request can only be answered by its recipient. | `proveTokenOwnership`, `proveEventAttendance` and `proveCredentialAttribute` compare `recipient`, read from `disclosureRequests`, with the holder pseudonym rebuilt from `local_sk()`. Tested in "an addressed request can only be answered by its recipient" and "another holder who genuinely qualifies cannot answer in the recipient's place". |
| A credential's private attribute is only ever proven for an addressed request. | `proveCredentialAttribute` rejects a request whose `recipient` is all zeros. |

### Tokens

| Invariant | Enforced by |
|---|---|
| Token ids are sequential: a new token gets `tokenId = totalSupply`, then `totalSupply` increases by one. | `mintTokenTo` |
| `totalSupply` and `events[…].minted` never decrease. | No circuit decrements them. Burns do not free supply. |
| For an event with `maxSupply != 0`, `minted <= maxSupply`. | `assert` in `mintTokenTo` |
| A token's owner, event and issuer never change. | No circuit rewrites `tokenOwner`, `tokenEvent` or `tokenIssuer` for an existing id. There is no transfer. |
| A holder pseudonym has at most one live token per event. | `eventHolderToken` index, checked in `mintTokenTo` |
| After a revocation, the holder cannot `claim` that event again; only the issuer or admin can issue a replacement. | The index entry is kept on revocation, and only `mintTo` passes `reissueRevoked`. |
| After a self-burn, the holder can `claim` again. | `burn` removes the index entry when the caller is the owner. |
| A burned token stays burned. | `burnedTokens` entries are only added. |
| A pending update request belongs to a live token and was filed by its holder. | `requestCredentialUpdate` checks the token is not burned and that the caller's pseudonym is its owner; `burn` removes the request. Only the issuer or the admin can dismiss one. |
| An organizer cannot give themselves a token of their own event with their own key. | `claim` rejects the organizer's key; `mintTo` rejects the caller's own pseudonym. This binds one key only (see [Security](security.md#threat-model)), and the admin can still mint to an organizer. |
| No token is minted for an inactive or expired event, or under a blocked issuer. | `assert`s in `mintTokenTo` |

### Credential tree

| Invariant | Enforced by |
|---|---|
| The leaf at index `tokenId` is the credential leaf of that token, or empty if the token was burned. | `insertIndex` at mint, `insertIndexDefault` at burn |
| At most 2^20 (1,048,576) tokens can ever be minted. | `assert(tokenId < 1048576)`; the tree has depth 20 |
| A burned credential cannot be proven against any root, old or new. | `burn` clears the leaf **and** calls `resetHistory()` |

### Revealed metadata

| Invariant | Enforced by |
|---|---|
| A value in `eventRevealedMetadata` / `tokenRevealedMetadata` opens the corresponding commitment. | The `reveal…` circuits assert `persistentCommit(value, rand) == commitment` |
| An all-zero commitment can never be "revealed". | `assert` against the zero sentinel |

### Pause

While `isPaused` is true, every circuit that writes to the ledger fails, except `unpause` (and
`pause` itself, which has no pause check). The four proof-only circuits keep working.

## Privacy invariants

| Invariant | Enforced by |
|---|---|
| A secret key never appears on-chain. | It only enters circuits through `local_sk()` and is only ever used as a hash input. The compiler would reject a direct disclosure path without `disclose()`, and there is none. |
| The same holder has unlinkable pseudonyms under different organizers. | `holder_pk` hashes the issuer id together with the key. Tested in "per-issuer holder pseudonym". |
| A holder's public key (`derive_pk`) is not published by claiming or by proving. | `claim` compares it in-circuit and stores only the pseudonym. |
| An anonymous proof (open request) does not reveal the token, the pseudonym or the credential leaf. | These proofs use `holder_secret_pk` (no `disclose`) and disclose only the request id and a tree root. Tested in "the public transcript reveals neither the holder pseudonym nor the credential leaf". |
| An attribute proof does not reveal the attribute's value or its randomness. | `value` and `rand` are never wrapped in `disclose()` in the `prove…` circuits. |
| A predicate proof is only meaningful against a verifier-chosen set. | The set root is read from `disclosureRequests`, never taken as an argument. |
| Nullifiers from the same key for different requests are unlinkable. | The request id is hashed into the nullifier. |
| Private credential attributes are bound to one holder and one event. | The attribute root is hashed into the credential leaf together with the event id and the pseudonym. |
| `isSoulbound` is not published. | It is passed to a witness only. |

What is deliberately *not* an invariant: minting is public, a holder's tokens under one organizer
are linked, and organizers know who they push-minted to. See
[Public and private data](data-privacy.md#indirect-leaks).

## Cryptographic constructions

### Primitives

| Primitive | Used for |
|---|---|
| `persistentHash` | Every identifier, leaf and nullifier below. For the byte inputs used here it is SHA-256 over the concatenated inputs (the deploy script reproduces `derive_pk` with plain SHA-256). |
| `persistentCommit(value, rand)` | Hiding commitments to metadata digests and attribute values |
| Merkle trees (`MerkleTreePath`, `merkleTreePathRoot`, `HistoricMerkleTree`) | Attribute trees, verifier sets and the credential tree |

### Domain separation

Every hash starts with a distinct tag, right-padded with zeros to 32 bytes. A value computed for
one purpose can never collide with one computed for another.

| Value | Hash input | Purpose |
|---|---|---|
| Public key | `"adasouls:pk:v1:"`, `sk` | Admin / organizer / verifier identity |
| Holder pseudonym | `"adasouls:holder-pk:v1:"`, `sk`, `issuerId` | Token ownership, per organizer |
| Event id | `"adasouls:event:v1:"`, `organizerPk`, `label` | Squat-proof event ids |
| Request id | `"adasouls:disclosure-req:v1:"`, `verifierPk`, `label` | Squat-proof request ids |
| Holder-event key | `"adasouls:holder-event:v1:"`, `H(holderPk, eventId)` | "Already claimed" index |
| Credential leaf | `"adasouls:cred-leaf:v1:"`, `eventId`, `holderPk`, `credAttrRoot` | Leaf of `credentials` |
| Credential attribute leaf | `"adasouls:cred-attr:v1:"`, `fieldId`, `commit(value, rand)` | Leaf of a credential's attribute tree |
| Event attribute leaf | `"adasouls:attr-leaf:v1:"`, `eventId`, `fieldId`, `commit(value, rand)` | Leaf of an event's attribute tree |
| Nullifier | `"adasouls:disclosure:v2:"`, `sk`, `requestId` | Single-use disclosure |
| Identity value | `"velum:identity:v1:"`, `country`, `docType`, `number`, `salt` | Ties a credential attribute to one identity document |

Changing any of these formulas in an upgrade would orphan the data already stored under the old
values.

### Commitments

Two commit-reveal slots, one per event (`privateMetadataCommit`) and one per token
(`tokenPrivateMetadataCommit`):

```
commitment = persistentCommit(value, rand)
```

- `value` is a 32-byte digest of whatever content is being hidden.
- `rand` is 32 random bytes, generated fresh for each commitment and kept by whoever should be
  able to open it.
- All-zero bytes mean "no commitment".
- Opening is all-or-nothing and public: `reveal…` publishes `value`.

Attribute leaves wrap the same commitment with a field id (and, for event attributes, the event
id), so one opening cannot be replayed under another field or another event.

**`rand` must never be reused.** Derive it per leaf, for example
`rand_i = H(masterRand, eventId, fieldId)`.

### Merkle trees

| Tree | Depth | Capacity | Built by | Root stored in |
|---|---|---|---|---|
| Event attributes | 8 | 256 fields | Organizer, off-chain | `events[…].privateAttributesRoot` |
| Credential attributes | 8 | 256 fields | Organizer, off-chain | Inside the credential leaf |
| Verifier's accepted set | 16 | 65,536 values | Verifier, off-chain | `disclosureRequests[…].setRoot` |
| Credentials | 20 | 1,048,576 tokens | The contract | `credentials` (on-chain, with root history) |

Depths are fixed at compile time. Off-chain trees must use the same hashing as Compact's
`merkleTreePathRoot` or their roots will not match:

```
leaf digest      = degradeToTransient(SHA-256("mdn:lh" ‖ leaf))
node(left,right) = transientHash([left, right])
```

[`contracts/src/test/poap-simulator.ts`](../../contracts/src/test/poap-simulator.ts)
(`buildMerklePath`) is a working reference. `merkleTreePathRoot` returns a field element; the
contract converts it with `upgradeFromTransient` before comparing it with a stored `Bytes<32>`
root.

### Nullifiers and double use

| Risk | Mechanism |
|---|---|
| The same holder claims an event twice | `eventHolderToken[H(holderPk, eventId)]` must be empty. This is a public index, not a nullifier: minting is public anyway. |
| The same key answers a single-use request twice | `proveAttributeMembershipOnce` inserts `H(sk, requestId)` into `usedDisclosures` and rejects a repeat. |
| A prover invents their own request to mint fresh nullifiers | The request id must exist in `disclosureRequests`. |
| A revoked credential keeps proving against an old root | `burn` resets the tree's root history. |
| Someone takes an event or request id before its owner | Ids are derived from the caller's own key. |

The stateless proofs (`proveTokenOwnership`, `proveEventAttendance`, `proveCredentialAttribute`,
`proveAttributeMembership`) have no nullifier by design: answering twice is harmless, and they
leave no ledger footprint.

The "one claim per holder per event" rule binds a *key*, not a person. Someone with two secret
keys has two pseudonyms and can claim twice. `maxSupply` therefore caps the number of tokens, not
the number of people. One-per-person needs an out-of-band channel, such as organizer push-mints
or single-use codes.

### Unlinkability

| Between | Mechanism |
|---|---|
| A holder's tokens under different organizers | Per-organizer pseudonym |
| A holder's identity as organizer/verifier and as holder | Different hash domains (`pk` vs `holder-pk`) |
| Two anonymous proofs by the same holder | Neither reveals anything derived from the key. Does not apply to addressed requests, which name the holder's pseudonym. |
| Two single-use disclosures by the same key | Per-request nullifier |
