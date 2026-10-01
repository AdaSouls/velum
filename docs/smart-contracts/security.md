# Security

## Trust assumptions

What has to be true for the contract's guarantees to hold.

| Trusted party | Trusted for | If it fails |
|---|---|---|
| **Admin key** | Honest moderation. The admin can pause the contract, block any issuer, deactivate any event, mint for any event and revoke any token. | Censorship and counterfeit or revoked credentials. The admin cannot read private data or forge an anonymous proof for someone else. `adminPk` cannot be changed. |
| **Maintenance authority key** | Not replacing circuits maliciously. It can remove and insert any circuit's verifier key, which changes what the contract accepts. It is a single key (threshold 1). | Whoever holds it can rewrite the contract's logic at the same address. |
| **Deployment wallet seed** | Both keys above are derived from it. | Losing it loses the admin and upgrade abilities; leaking it gives both away. |
| **The user's proof server** | Confidentiality. It receives every private input, including the secret key. | Full loss of that user's privacy and identity. |
| **Organizer** | Committing true attribute values, and delivering the openings. | A holder can end up with a credential whose attributes are wrong or unprovable. The contract cannot check that a committed value is *true*, only that it was committed. |
| **Compact compiler and proof system** | Soundness. | Out of scope here. |

Nobody needs to be trusted for: the secrecy of a holder's key against chain observers, the
unlinkability of pseudonyms on-chain, or the fact that a revoked credential stops proving.

## Threat model

### A user with manipulated witnesses

Witnesses run in the caller's own code. Assume a caller returns whatever suits them.

| Attempt | Outcome |
|---|---|
| `local_sk` returns someone else's key | Works only if they actually know that key. Knowing the key *is* being that identity. |
| `local_sk` returns a made-up key to pass an admin or organizer check | Fails. The derived public key will not equal the one on the ledger. |
| `local_sk` returns a fresh key for every call | Works, and gives a fresh pseudonym each time. One person can claim the same public event many times, and an organizer can claim their own event with a second key. `maxSupply` caps tokens, not people. Use `mintTo` or an out-of-band gate when one-per-person matters. |
| `store_token` records false data, or does nothing | Only that user's own cache is wrong. The witness returns nothing to the circuit. |
| Passing a Merkle path for a credential the caller does not hold | Fails. The leaf is rebuilt inside the circuit from the caller's key; a path to someone else's leaf will not match. |
| Building a path against a tree the caller invented | Fails. The root must be one the on-chain `credentials` tree has had. |
| Lying about an attribute value | Fails. The value must open a leaf under the committed root. |
| Proving against a set the caller invented | Fails. The set root comes from a published request, not from an argument. |
| Inventing a request id to redeem a single-use proof again | Fails. The request must exist on the ledger. |
| Reusing leaked openings of another holder | Fails for credential attributes: the attribute root is bound to that holder's pseudonym in the credential leaf. |
| Proving with a revoked credential, using a path saved before the burn | Fails. The burn resets the root history. |
| Creating an event under an id another organizer is about to use | Not possible. Ids are derived from the caller's own key. |

Circuit arguments are prover-chosen too. The same reasoning applies to them: an argument means
nothing until an `assert` ties it to ledger state.

### A chain observer

Sees the ledger and every transaction. Covered in detail in
[Public and private data](data-privacy.md).

- **Learns:** all events, organizers, verifiers and requests; which pseudonym holds which token;
  all burns and whether each was a self-burn; that a proof of a given kind answered a given
  request, and when.
- **Does not learn:** secret keys; that two pseudonyms under different organizers are the same
  person; which holder made an anonymous proof; hidden attribute values.
- **Can infer:** identity from small anonymity sets, from timing, and from small verifier sets.

### A curious indexer or API operator

Clients do not talk to the chain directly. They read through services, and those services see
the queries.

| Service | What it can observe |
|---|---|
| **Midnight indexer** (public data provider) | Which contract a client reads and watches, and when, from which network address. |
| **Velum indexer API** (`indexer/`) | It only serves public ledger data. But `GET /api/tokens/owner/:ownerPk` is queried with the holder's pseudonym, and the web app looks up the user's pseudonym for *every* organizer in one burst. The operator of the API can therefore link one client's pseudonyms across organizers, which is exactly what the on-chain design hides. |
| **API host** (credential delivery, backups, disclosure sets) | Receives encrypted envelopes and backups. It sees ciphertext sizes, timing and lookup identifiers, not contents. |
| **Metadata hosts** (IPFS gateways) | Which metadata URIs a client fetches. |

Mitigations available today: run your own indexer, or query through a network path that does not
identify you. Neither is built into the web app.

### A malicious organizer

- Can mint tokens for their event to any pseudonym, up to `maxSupply`, and revoke any of them.
- Knows the openings of every private attribute they issued and can reveal them off-chain.
- Cannot prove as a holder: the credential leaf is bound to the holder's key.
- Cannot mint under another organizer's event.

### A malicious verifier

- Can publish a request with a tiny accepted set, so that answering it reveals the value. Holders'
  clients should show the set and its size before proving.
- Can correlate an anonymous proof with the person they just handed the request to.
- Cannot learn more than membership from the proof itself.

## Known privacy limits

Metadata that leaks by design or that the contract cannot prevent.

1. **Minting is public.** Anonymity applies to proving, not to receiving a credential.
2. **A holder's tokens under one organizer are linked** by the shared pseudonym.
3. **The organizer knows who they push-minted to.**
4. **The anonymity set is the event's live credentials**, and smaller still for attribute proofs.
5. **Which circuit a transaction called is visible**, and so is the tree root an anonymous proof
   used.
6. **Whether a credential carries private attributes is visible.**
7. **Self-burn versus revocation is visible.**
8. **Small accepted sets disclose the value.** The contract cannot enforce a minimum set size.
9. **Credentials can be lent or relayed.** Someone who shares their key, or proves on another
   person's behalf, cannot be stopped cryptographically.
10. **The fee payer is outside the contract's control.** Transactions are paid for by a wallet.
    Whether fee payment links a user's transactions to each other or to their wallet has not
    been analysed in this repository; do not assume it does not.
11. **The Velum API operator can link a client's pseudonyms** (see above).
12. **The proof server sees everything private.** On the public site this is an open decision,
    see [`deploy/production/README.md`](../../deploy/production/README.md#proof-server-open-decision):
    hosting a shared proof server would hand it every user's key.

## Known issues and open items

| Item | Detail |
|---|---|
| Admin secret key equals the wallet seed | For a 32-byte seed, `contractSecretKey` uses the seed bytes as `local_sk` unchanged. The deployment wallet's seed is therefore sent to the proof server as a private input on every admin call. Keep that proof server local. |
| Admin seed on disk | `deploy.ts` writes `ADMIN_SEED` to `.env.<network>.local`. The file is gitignored; treat it as a private key. |
| No key rotation | Neither a user's secret key nor `adminPk` can be changed. |
| Single-key maintenance authority | Upgrades need one signature. There is no timelock or multi-signature. |
| No unblock for issuers | `deactivateIssuer` is permanent. |
| Unneeded `disclose(isSoulbound)` in `claim` | Harmless (the value never reaches the ledger) but misleading. Removing it changes the circuit. |
| Burned tokens count toward `maxSupply` | Counters only increase. |
| Pause does not stop proofs | The four proof-only circuits have no pause check. |

## Tests

```bash
cd contracts
npm run compact     # the tests run against the compiled output
npm test            # 120 tests, about 15 seconds
```

The suite is [`contracts/src/test/poap.test.ts`](../../contracts/src/test/poap.test.ts), driven
by the simulator in [`poap-simulator.ts`](../../contracts/src/test/poap-simulator.ts). It
executes the compiled circuits in memory with `compact-runtime`. Each test user has its own
secret key and private state against one shared ledger, which is how "a different, possibly
hostile caller" is modelled.

| Area | What is covered |
|---|---|
| Events | Permissionless creation, id derivation matches `computeEventId`, same label from two organizers does not collide, duplicates rejected, blocked issuer rejected |
| Organizer self-dealing | Organizer cannot claim or push-mint to themselves; others and the admin can |
| Moderation | Organizer cannot undo a takedown; blocking unregistered issuers; blocked key cannot register; only admin can block |
| Pause | Only admin; `claim` blocked while paused |
| Claim | New token per claim, double claim rejected, inactive / expired / sold-out rejected, reactivation, soulbound flag stays in private state |
| Push-mint | Organizer and admin allowed, others rejected; same event checks; per-token metadata |
| Pseudonyms | Different per issuer, stable per (wallet, issuer) |
| Commit-reveal | Event and token level: correct opening accepted, wrong value rejected, zero commitment rejected, reveal is permissionless |
| Burn and re-issue | Owner, issuer and admin can burn; third party cannot; self-burn frees the slot, revocation does not; re-issue only by issuer or admin |
| Disclosure requests | Unknown event rejected, duplicate label rejected, labels do not collide across verifiers |
| Attribute proofs | Valid proof accepted; rejected for: unpublished request, mismatched set root, wrong opening, tampered path, value outside the set, event without attributes; no ledger writes |
| Single-use proofs | Nullifier recorded, replay rejected, invented request rejected, different request allowed |
| Ownership proof | Owner accepted; non-owner, unknown token, wrong event, burned or revoked token rejected |
| Anonymous proofs | Fresh and historic paths accepted; another holder's path, a self-built tree, a different event and a burned credential rejected; root history reset on burn; **the public transcript contains neither the pseudonym nor the leaf** |
| Credential attributes | Valid proof accepted; false value, value outside the set, leaked openings used by another holder, holder without the attribute and revoked credential rejected |

Tests that reject invalid private inputs are the ones to keep when refactoring: they are what
shows an `assert` actually constrains something. Two are regression tests for exploits that
worked against an earlier version (marked `C-1` and `H-1` in the test names).

What the suite does not do:

- It does not generate or verify real proofs. It checks circuit logic, not the proof system.
- There is no end-to-end test against a devnet in this repository for the contract itself.
  [`indexer/src/integration.test.ts`](../../indexer/src/integration.test.ts) covers the indexer.
- Only `claim` is tested under pause; the other circuits' pause checks are not.
- The pure helper `computeCredentialAttrLeaf` and off-chain tree building are exercised only
  through the proofs that use them.

## Audits

No independent third-party audit report is published in this repository.

The contract went through a security review in September 2026 that ran exploits against the
compiled contract. Its findings and fixes, from the commit history:

| Finding | Severity | Problem | Fix | Commit |
|---|---|---|---|---|
| C-1 | Critical | `proveAttributeMembership` took the set root as an argument, so a prover could invent a one-element set and "prove" any value. | Verifiers publish the request on-chain first; the circuit reads the root from the ledger. | `7ca2570` |
| H-1 | High | The single-use nullifier could be bypassed by varying a free-form request id. | The nullifier is bound to a published request id. | `7ca2570` |
| — | not rated | The attribute leaf hash had no domain tag and omitted the event id, so a root could be replayed across events. | Tag and event id added. | `7ca2570` |
| H-3 | High | Event ids were caller-chosen: whoever called `createEvent` first for an id owned it. | Ids are derived from the organizer's key and a label. | `f671ab1` |
| — | Medium | Expiration was stored but never enforced. | Checked in `mintTokenTo`. | `f671ab1` |
| — | Medium | Deactivating an issuer had no effect on minting. | Checked in `mintTokenTo`. | `f671ab1` |
| — | Medium | Burn semantics did not separate self-burn from revocation. | Only a self-burn frees the claim slot. | `f671ab1` |
| — | Medium | All-zero commitments relied on hash preimage resistance to be un-revealable. | Rejected explicitly. | `f671ab1` |
| — | Medium | `maxSupply` could be read as a per-person cap. | Documented as a total-mint cap; no on-chain fix exists. | `f671ab1` |
| — | Low | `adminPk` was writable in principle. | Declared `sealed`. | `f671ab1` |

The review report itself is not in this repository. The circuits added afterwards
(`proveTokenOwnership`, `proveEventAttendance`, `proveCredentialAttribute`, the moderation
changes and re-issue after revocation) have not been covered by a recorded review.

## Changelog

See [changelog.md](changelog.md).
