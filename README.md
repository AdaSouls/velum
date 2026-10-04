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
    ("my tier is in {gold, platinum}") — without revealing the value. The verifier addresses
    this question to one holder, and only that holder can answer it.
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

A request is **open** (any holder of the event can answer) or **addressed** to one holder's
pseudonym (only that holder can answer, so the request can't be handed to someone else who
qualifies). Questions about a credential's private attribute are always addressed.

| Circuit | Proves | Reveals |
|---|---|---|
| `proveTokenOwnership` | "I own token #N of your event" | the token id (and so the holder's pseudonym for that issuer) |
| `proveEventAttendance` | "I own *some* live credential of your event" | only the request, the event and a tree root |
| `proveCredentialAttribute` | "I am the holder you asked, and my credential's private attribute `X` is in your set" | the request (which names the holder), the event and a tree root — not the value |
| `proveAttributeMembership` | an **event-level** private attribute is in your set | the request |
| `proveAttributeMembershipOnce` | same, at most once per holder (nullifier) | the request and a nullifier |

### Privacy model

| Public on-chain | Private |
|---|---|
| Events and their organizers | The holder's secret key |
| Which pseudonym holds which token, of which event | Which pseudonyms belong to the same person across issuers |
| Burns / revocations | Private attribute values (unless the organizer chooses to reveal them) |
| Commitments (metadata, attribute roots, credential leaves) | **Which** holder produced an anonymous proof |
| Disclosure requests (and who they are addressed to) and single-use nullifiers | |

Limits worth knowing:

- **Minting is public.** Anonymity applies when *proving*, not when receiving a credential.
- **The anonymity set is the live credentials of that event.** In a small event it's small.
- **Credentials can be lent.** Someone who shares their secret key can't be stopped
  cryptographically — true of any credential system. An open request can also be answered by any
  other holder of the event; address the request when it matters who answers.
- **Addressed requests aren't anonymous.** The request names the holder's pseudonym on-chain.
- **Set size matters.** Asking "is your value in {X}" with a one-element set is full disclosure.

The full map of what is public, what is private and what can be inferred is in
[Public and private data](docs/01-contract/data-privacy.md); the threat model is in
[Security](docs/01-contract/security.md).

### Revocation and transfer

`burn` can be called by the holder, the issuer, or the admin. It marks the token burned, removes
its leaf from the credential tree and resets the tree's root history, so a revoked credential
can't be proven against any old root either.

There is **no transfer circuit**: no circuit ever changes the owner of an existing token, so
credentials are soulbound by construction.

---

## Documentation

This README is the introduction. The details are in [`docs/`](docs/README.md), in five sections:

| Section | What it covers |
|---|---|
| [00 — Overview](docs/00-overview/README.md) | Architecture diagram, an [end-to-end data flow](docs/00-overview/data-flow.md), the [shared data contract](docs/00-overview/data-contract.md) (ledger → database → API) and a [glossary](docs/00-overview/glossary.md) |
| [01 — Contract](docs/01-contract/README.md) | [Public and private data](docs/01-contract/data-privacy.md), [circuits and flows](docs/01-contract/circuits.md), [private state](docs/01-contract/private-state.md), [invariants and cryptography](docs/01-contract/invariants-and-cryptography.md), [integration](docs/01-contract/integration.md), [security](docs/01-contract/security.md), [changelog](docs/01-contract/changelog.md) |
| [02 — Indexer](docs/02-indexer/README.md) | What it follows and cannot see, [mapping from ledger changes to rows](docs/02-indexer/mapping.md), [data model](docs/02-indexer/data-model.md), [sync and consistency](docs/02-indexer/sync.md), [operation](docs/02-indexer/operations.md) |
| [03 — API](docs/03-api/README.md) | Conventions, security and privacy, the [endpoint reference](docs/03-api/endpoints.md), an [OpenAPI description](docs/03-api/openapi.yaml) and a [quickstart](docs/03-api/quickstart.md) |
| [04 — Operations](docs/04-operations/README.md) | Environments, [local setup](docs/04-operations/local-setup.md), [deploying and upgrading](docs/04-operations/deploy.md), [monitoring and runbooks](docs/04-operations/monitoring-runbooks.md) |

Good entry points:

- New to the project: [Architecture](docs/00-overview/README.md), then
  [Public and private data](docs/01-contract/data-privacy.md).
- Calling the API: [API quickstart](docs/03-api/quickstart.md).
- Running it: [Local setup](docs/04-operations/local-setup.md).

The documentation also records [known issues](docs/README.md#known-issues-found-while-documenting)
found while writing it.

---|---|
| [Overview](docs/01-contract/overview.md) | The privacy problem, the actors, how callers are authorized, tokens and fees |
| [Public and private data](docs/01-contract/data-privacy.md) | Where every piece of data lives and who can see it; every `disclose()`; what leaks indirectly |
| [Circuits and flows](docs/01-contract/circuits.md) | Every circuit, and each use case step by step: what runs locally, what is verified on-chain |
| [Private state](docs/01-contract/private-state.md) | What lives only on the user's device, and what happens if it is lost |
| [Invariants and cryptography](docs/01-contract/invariants-and-cryptography.md) | What must always hold; how commitments, Merkle trees and nullifiers are built |
| [Integration](docs/01-contract/integration.md) | Compiler output, witnesses in TypeScript, providers, deploying, upgrading, versions |
| [Security](docs/01-contract/security.md) | Trust assumptions, threat model, known privacy limits, tests, review history |
| [Changelog](docs/01-contract/changelog.md) | Contract changes and on-chain deployments |

---

## Repository layout

| Path | What |
|---|---|
| [`docs/`](docs/README.md) | Project documentation |
| [`contracts/compact/poap.compact`](contracts/compact/poap.compact) | The contract (Compact) |
| `contracts/src/managed/poap/` | Compiled output (JS bindings, ZKIR). Prover/verifier keys are generated locally, not committed |
| [`contracts/src/test/`](contracts/src/test/) | Contract tests (simulator + Jest) |
| [`contracts/src/witnesses.ts`](contracts/src/witnesses.ts) | Witness implementations (holder secret key, local token cache) |
| [`indexer/`](indexer/) | Follows the contract through Midnight's indexer, stores state in Postgres, and serves the REST API (`/api/events`, `/api/tokens`, `/api/disclosure-requests`) from the same process |
| [`scripts/deploy.ts`](scripts/deploy.ts) | Deploys the contract (local devnet or preprod) |
| [`scripts/upgrade.ts`](scripts/upgrade.ts) | Upgrades the deployed contract's circuits in place (same address) |
| [`deploy/production/`](deploy/production/) | Docker Compose stack + runbook for the API host |
| [`devnet.yml`](devnet.yml) | Local Midnight devnet (node, indexer, proof server) + the indexer's Postgres |

---

## Getting started

The short version is below. The complete procedures are in
[Local setup](docs/04-operations/local-setup.md) and [Deploying](docs/04-operations/deploy.md).

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
