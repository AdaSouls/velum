# Overview

## The problem

A conventional on-chain credential (a POAP, a membership NFT, a certificate) is tied to a wallet
address. To prove you hold it, you show that address, and with it everything else that address
has ever done. Proving "I attended this conference" also reveals every other event you attended,
and lets any two verifiers compare notes.

Velum separates **holding** a credential from **proving** something about it:

- An organizer issues a credential to a holder. This step is public, but the holder appears
  under a pseudonym that is different for every organizer.
- Later, the holder answers a verifier's question with a zero-knowledge proof. Depending on the
  circuit, the proof shows one of:
  - "I own token N of your event" (public proof),
  - "I own *some* valid token of your event" (anonymous proof),
  - "…and a private attribute of my credential is one of the values you accept" (anonymous proof
    over a hidden value).
- Organizers can attach private data to an event or to an individual credential, and either
  reveal it later or let it be proven about without ever revealing it.

What the anonymous proofs hide is which credential, which holder and which attribute value were
involved. What they do not hide is listed in [Public and private data](data-privacy.md).

## Actors

| Actor | What they do | Circuits |
|---|---|---|
| **Admin** | Deploys the contract. Moderates: pauses, verifies or blocks issuers, takes events down, revokes tokens. | `pause`, `unpause`, `registerIssuer`, `deactivateIssuer`, `deactivateEvent`, `reactivateEvent`, `mintTo`, `burn` |
| **Organizer** (issuer) | Creates events and issues credentials for them. Can revoke the ones they issued. | `createEvent`, `deactivateEvent`, `mintTo`, `burn` |
| **Holder** | Claims or receives credentials, proves things about them, can burn their own. | `claim`, `burn`, `proveTokenOwnership`, `proveEventAttendance`, `proveCredentialAttribute` |
| **Verifier** | Publishes a question, then checks that a successful proof transaction answered it. | `publishDisclosureRequest` |
| **Anyone who knows an opening** | Reveals committed metadata, or proves a predicate about an event-level attribute. | `revealPrivateMetadata`, `revealPrivateTokenMetadata`, `proveAttributeMembership`, `proveAttributeMembershipOnce` |

Creating events is permissionless. The issuer registry is an optional "verified" badge plus a
blocklist, not a gate.

One more role exists outside the contract's own code: the **maintenance authority**, the key that
can replace the contract's circuits in place. See [Security](security.md#trust-assumptions).

## Authorization without `msg.sender`

A Compact circuit has no built-in notion of "who is calling". Velum's circuits identify the
caller by a secret they know:

1. Each user has a 32-byte secret key, `local_sk`. It lives in their private state and is handed
   to the circuit by a witness. It never appears on-chain.
2. The circuit hashes it into a public identifier and compares that with ledger state.

Two identifiers are derived from the same secret:

| Identifier | Formula | Used for |
|---|---|---|
| **Public key** (`derive_pk`, `getCallerPk`) | `H("adasouls:pk:v1:", sk)` | Admin, organizer and verifier identity. The same value everywhere. |
| **Holder pseudonym** (`holder_pk`, `getHolderPk`) | `H("adasouls:holder-pk:v1:", sk, issuerId)` | Owning tokens. A different, unlinkable value per organizer. |

`H` is Compact's `persistentHash`; the string is right-padded with zeros to 32 bytes.

Each authorization check is an `assert` inside the circuit:

| Check | How it is proven |
|---|---|
| Caller is the admin | `derive_pk(local_sk()) == adminPk` |
| Caller is the event's organizer | `derive_pk(local_sk()) == events[eventId].organizer` |
| Caller owns token N (public) | `holder_pk(tokenIssuer[N]) == tokenOwner[N]` |
| Caller owns some token of the event (anonymous) | The credential leaf rebuilt from `local_sk` is in the `credentials` Merkle tree |
| Caller may reveal committed metadata | They supply a `(value, rand)` pair that opens the on-chain commitment. No identity check. |

The proof convinces the chain that the prover *knows* a secret key that hashes to the stored
value. It does not prove the witness code is honest, so the contract assumes the caller may
supply any key they like. The consequences are in [Security](security.md#threat-model).

`adminPk` is declared `sealed`: the compiler rejects any write to it outside the constructor, so
the admin identity cannot change after deployment.

## Tokens and fees

The contract does not hold, mint or move any Midnight tokens. It has no shielded or unshielded
coin operations.

- A Velum "token" is a set of rows in the contract's own ledger (`tokenOwner`, `tokenEvent`, …)
  keyed by a sequential `tokenId`. It is not a Zswap coin and not a native token.
- There is no transfer circuit. No circuit changes `tokenOwner` for an existing token, so every
  credential is non-transferable by construction. The `isSoulbound` flag passed to `claim` is
  client-side bookkeeping only.
- Transaction fees are paid in **DUST** by the wallet that submits the transaction. DUST is
  generated by NIGHT that has been registered for DUST generation.
  - In the browser, the wallet extension balances the transaction and pays the fee.
  - In the deployment scripts, [`scripts/lib/network.ts`](../../scripts/lib/network.ts) registers
    the wallet's NIGHT for DUST generation and waits until the wallet can pay.

The contract's notion of identity (`local_sk`) is separate from the wallet that pays the fee. Who
paid for a transaction is wallet-level metadata that the contract does not control; see
[known limits](security.md#known-privacy-limits).
