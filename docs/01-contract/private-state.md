# Private state

Private state is the data a user keeps on their own device and feeds to circuits through
witnesses. It never goes on-chain.

## Structure

Defined in [`contracts/src/witnesses.ts`](../../contracts/src/witnesses.ts):

```ts
export type TokenRecord = {
  tokenId: bigint;
  isSoulbound: boolean;
};

export type PoapPrivateState = {
  secretKey: Uint8Array;
  // eventId (hex) → the token claimed for that event
  tokens: Record<string, TokenRecord>;
};
```

| Field | Purpose | Load-bearing? |
|---|---|---|
| `secretKey` | The 32-byte `local_sk`. The user's public key, every holder pseudonym and every nullifier are hashes of it. | **Yes.** It is the user's identity for this contract. |
| `tokens` | A cache of tokens obtained through `claim`, written by the `store_token` witness. | No. The contract decides everything from public ledger state. Tokens received through `mintTo` never appear here; clients find those through the indexer by holder pseudonym. |

The `isSoulbound` flag exists only here. It is not written to the ledger and not enforced: all
tokens are non-transferable because there is no transfer circuit.

## Where it is stored

The contract does not care how private state is stored. Each client chooses a private state
provider.

### Deployment scripts

[`scripts/deploy.ts`](../../scripts/deploy.ts) and [`scripts/upgrade.ts`](../../scripts/upgrade.ts)
use the SDK's LevelDB private state provider, with store names `poap-deploy-state` and
`poap-upgrade-state`, under the private state id `poapPrivateState`.

The secret key is not generated: it is derived from the deploying wallet's seed on every run
(`contractSecretKey` in [`scripts/lib/network.ts`](../../scripts/lib/network.ts)).

- A 32-byte seed is used as the secret key unchanged.
- A 64-byte seed (from a BIP-39 mnemonic) is hashed to 32 bytes with SHA-256.

So for scripts the local store is disposable. **The wallet seed is the backup**, for both the
admin identity and the contract's maintenance key.

### Web app

As implemented in the `poap-frontend` repository at the time of writing:

- **Key generation.** On a wallet's first connection, the app generates 32 random bytes with
  `crypto.getRandomValues` as that wallet's secret key. It is not derived from the wallet, so
  the wallet extension cannot regenerate it.
- **Storage.** The SDK's LevelDB private state provider, in the browser, scoped to the wallet's
  shielded address and encrypted with a password.
- **Password.** A recovery code generated automatically for each wallet and kept in the same
  browser, so connecting does not prompt for it. The code is shown to the user once to save.
  Accepted trade-off: anyone with access to that browser profile can read the key.
- **Other local data.** The openings of private credential attributes received from organizers
  (including the salt of each identity attribute), proof history and sharing preferences are kept
  in the browser's local storage.

## Backup and recovery (web app)

- The app builds an encrypted backup of the private state and the local data listed above. The
  key is derived from the recovery code (PBKDF2-SHA-256, 600,000 iterations) and the payload is
  encrypted with AES-GCM in the browser, before it leaves the device.
- The backup can be saved as a file or uploaded through the API host. The host only ever stores
  ciphertext.
- Restoring in another browser needs the recovery code, plus either the file or the wallet (to
  locate the cloud copy).

## What happens if it is lost

There is no recovery circuit in the contract. Nothing on-chain can re-bind an identity to a new
secret key.

| Who lost their key | Consequence | What can still be done |
|---|---|---|
| **Holder** | Cannot prove ownership or attendance and cannot burn their own tokens. The tokens stay on-chain, owned by pseudonyms no one controls. | Start over with a new key (new pseudonyms). Claim public events again, or ask the organizer to `mintTo` the new pseudonym. The issuer or admin can revoke the orphaned token. A re-claim counts toward `maxSupply`. |
| **Holder** (attribute openings only) | Cannot produce `proveCredentialAttribute` proofs. Plain attendance proofs still work if they know the credential's attribute root. | Ask the organizer to deliver the openings again. This includes identity attributes: without the salt, the holder cannot answer a verifier's identity check. |
| **Organizer** | Cannot mint, deactivate or revoke for their events. | The admin can still `mintTo`, `deactivateEvent` and `burn` for any event. The organizer's identity cannot be moved to a new key. |
| **Organizer** (openings only) | Hidden metadata can never be revealed, and event-level attributes can never be proven. | Nothing. The commitments stay on-chain unopened. |
| **Admin** | No more `pause`, issuer moderation, event reactivation or admin revocations. `adminPk` is sealed and cannot be changed. | Keep the deployment wallet seed safe: the admin key is derived from it. |

The reverse case matters as much: **a leaked secret key cannot be rotated.** Whoever has it can
act as that user, and for a holder, prove ownership of every credential the key holds.

## What a client must back up

| Item | Why |
|---|---|
| The secret key | Identity. Without it, credentials are unusable. |
| Credential attribute openings (`fieldId`, `value`, `rand`, in tree order) and the attribute root | Needed to rebuild Merkle paths for attribute proofs |
| The salt of each identity attribute | It is the attribute's opening material: the holder hands it to a verifier, who rebuilds the value from the document they checked |
| For organizers: metadata and attribute openings for each event | Needed to reveal or prove later |
| For verifiers: the members of each published set | Holders need them to build membership paths |

The `tokens` cache does not need a backup; it can be rebuilt from the indexer.

A credential update request needs nothing in private state. The holder keeps the off-chain
request they sent the issuer only until it is answered; its commitment is on the ledger.
