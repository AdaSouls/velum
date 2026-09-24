# AdaSouls Velum

**Privacy-first credentials on [Midnight](https://midnight.network).**

Velum started as a POAP — a "proof of attendance" badge — and grew into a protocol for issuing
soulbound credentials that holders can prove things about **without revealing themselves**:

- An organizer issues a credential: an attendance badge, a membership, a certificate, optionally
  carrying **private attributes** unique to that holder (a tier, a role, a score).
- The holder can later prove, in zero knowledge:
  - that they own a specific credential (**public** proof), or
  - that they hold **some** valid credential of an event, without revealing which one
    (**anonymous** proof), or
  - that a private attribute of their credential belongs to a set a verifier asked about
    ("my tier is in {gold, platinum}") — without revealing the value, or who they are.
- Issuers can revoke. Credentials are non-transferable by construction.

This repository contains the Compact smart contract, the indexer that serves its state over a
REST API, deployment tooling, and the production setup for the API host. The web app lives in a
separate repository (`AdaSouls/POAP-Frontend`).

> **Status:** running on Midnight **preprod**. Current deployment records are in
> [`deployments/`](deployments/).

---

## How it works

### Credentials

Anyone can create an event (`createEvent`); its id is derived from the organizer's key and a
label, so ids can't be squatted. Credentials are minted either self-service (`claim`, for public
events) or pushed by the organizer (`mintTo`, which can attach a holder-specific private
attribute root).

Holders never appear on-chain under a global identity. Each holder is represented by a
**per-issuer pseudonym** — `hash(domain, secretKey, issuerId)` — so an observer can't link the
same person across different organizers.

Every mint also writes a commitment to an on-chain **credential Merkle tree**:

```
leaf = H("cred-leaf", eventId, holderPseudonym, privateAttributesRoot)
```

That tree is what makes anonymous proofs possible: proving membership of a leaf reveals only the
tree root, never which leaf.

### Proofs

Every proof answers a **disclosure request** a verifier published on-chain first
(`publishDisclosureRequest`). Pinning the question on-chain is what makes the answer meaningful:
the prover can't pick their own "set" to prove against, and the verifier can tell a fresh proof
for *their* request apart from any other.

| Circuit | Proves | Reveals |
|---|---|---|
| `proveTokenOwnership` | "I own token #N of your event" | the token id (and so the holder's pseudonym for that issuer) |
| `proveEventAttendance` | "I own *some* live credential of your event" | only the request, the event and a tree root |
| `proveCredentialAttribute` | …and its private attribute `X` is in your set | only the request, the event and a tree root |
| `proveAttributeMembership` | an **event-level** private attribute is in your set | the request |
| `proveAttributeMembershipOnce` | same, at most once per holder (nullifier) | the request and a nullifier |

### Privacy model

| Public on-chain | Private |
|---|---|
| Events and their organizers | The holder's secret key |
| Which pseudonym holds which token, of which event | Which pseudonyms belong to the same person across issuers |
| Burns / revocations | Private attribute values (unless the organizer chooses to reveal them) |
| Commitments (metadata, attribute roots, credential leaves) | **Which** holder produced an anonymous proof |
| Disclosure requests and single-use nullifiers | |

Limits worth knowing:

- **Minting is public.** Anonymity applies when *proving*, not when receiving a credential.
- **The anonymity set is the live credentials of that event.** In a small event it's small.
- **Credentials can be lent.** Someone who shares their secret key, or proves on someone else's
  behalf, can't be stopped cryptographically — true of any credential system.
- **Set size matters.** Asking "is your value in {X}" with a one-element set is full disclosure.

### Revocation and transfer

`burn` can be called by the holder, the issuer, or the admin. It marks the token burned, removes
its leaf from the credential tree and resets the tree's root history, so a revoked credential
can't be proven against any old root either.

There is **no transfer circuit**: no circuit ever changes the owner of an existing token, so
credentials are soulbound by construction.

---

## Repository layout

| Path | What |
|---|---|
| [`contracts/compact/poap.compact`](contracts/compact/poap.compact) | The contract (Compact) |
| `contracts/src/managed/poap/` | Compiled output (JS bindings, ZKIR). Prover/verifier keys are generated locally, not committed |
| [`contracts/src/test/`](contracts/src/test/) | Contract tests (simulator + Jest) |
| [`contracts/src/witnesses.ts`](contracts/src/witnesses.ts) | Witness implementations (holder secret key, local token cache) |
| [`indexer/`](indexer/) | Follows the contract through Midnight's indexer, stores state in Postgres, serves `/api/events`, `/api/tokens`, `/api/disclosure-requests` |
| [`scripts/deploy.ts`](scripts/deploy.ts) | Deploys the contract (local devnet or preprod) |
| [`deploy/production/`](deploy/production/) | Docker Compose stack + runbook for the API host |
| [`devnet.yml`](devnet.yml) | Local Midnight devnet (node, indexer, proof server) + the indexer's Postgres |

---

## Getting started

### Prerequisites

- Node.js 22+
- The [Compact toolchain](https://docs.midnight.network) with compiler **0.31.1**
  (`compact update 0.31.1`)
- Docker or Podman (for the local devnet and the proof server)

### Build and test the contract

```bash
npm install                 # installs all workspaces (contracts, indexer, scripts)
cd contracts
npm run compact             # compile + generate prover/verifier keys (a few minutes)
npm test                    # contract tests
```

### Run locally

```bash
docker compose -f devnet.yml up -d        # node, indexer, proof server, Postgres
npx tsx scripts/deploy.ts                 # deploys with the devnet's pre-funded genesis wallet
```

The deploy script writes the contract address to `deployments/undeployed.md` and `.env.local`.
Then start the indexer:

```bash
cd indexer
CONTRACT_ADDRESS=<address> npm start      # API on http://localhost:3001
```

### Deploy to preprod

```bash
npm run compact:shell --workspace contracts   # the "shell" build used for staged deployment
docker compose -f devnet.yml up -d proof-server
MN_TEST_ENVIRONMENT=preprod MN_TEST_WALLET_SEED=<hex seed of a funded wallet> \
  npx tsx scripts/deploy.ts
```

Two things to expect:

- **Staged deployment.** The contract has more circuits than fit in one deploy transaction's
  weight limit, so the script deploys a circuit-less "shell" and then registers each circuit's
  verifier key in its own transaction.
- **A long first wait.** Fees are paid in DUST, and the wallet must replay the network's whole
  DUST history (1.5M+ events on preprod, 1.5–2 hours) before it can pay them. The script waits
  for that automatically.

### Production

See [`deploy/production/README.md`](deploy/production/README.md): Caddy (automatic TLS),
the indexer and Postgres on an Ubuntu host, serving the ZK artifacts the frontend needs.

---

## License

[MIT](LICENSE) © AdaSouls
