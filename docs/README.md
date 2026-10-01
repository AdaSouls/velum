# Velum documentation

The top-level [README](../README.md) is the introduction. These documents go deeper.

```
docs/
├── 00-overview/     architecture, end-to-end data flow, shared data contract, glossary
├── 01-contract/     the Compact contract: public vs private data, circuits, security
├── 02-indexer/      how the chain is followed and turned into database rows
├── 03-api/          the REST API: endpoints, conventions, quickstart
└── 04-operations/   environments, local setup, deploying, monitoring, runbooks
```

## Where to start

| If you want to… | Read |
|---|---|
| Understand how the pieces fit | [Architecture](00-overview/README.md) |
| Follow one call from click to API response | [End-to-end data flow](00-overview/data-flow.md) |
| Know what is public and what is private | [Public and private data](01-contract/data-privacy.md) |
| Call the API | [API quickstart](03-api/quickstart.md) |
| Run everything locally | [Local setup](04-operations/local-setup.md) |
| Deploy or upgrade | [Deploying](04-operations/deploy.md) |
| Handle an incident | [Monitoring and runbooks](04-operations/monitoring-runbooks.md) |
| Look up a term | [Glossary](00-overview/glossary.md) |

## 00 — Overview

| Document | What it covers |
|---|---|
| [Architecture](00-overview/README.md) | The components and who talks to whom |
| [End-to-end data flow](00-overview/data-flow.md) | A claim and an anonymous proof, followed through every component |
| [Shared data contract](00-overview/data-contract.md) | Ledger field → database column → API field |
| [Glossary](00-overview/glossary.md) | Ledger, circuit, disclose, commitment, nullifier, finality, reorg |

## 01 — Contract

[`contracts/compact/poap.compact`](../contracts/compact/poap.compact)

| Document | What it covers |
|---|---|
| [Index and comment convention](01-contract/README.md) | Toolchain versions; the tags used inside the contract |
| [Overview](01-contract/overview.md) | The privacy problem, roles and authorization, tokens and fees |
| [Public and private data](01-contract/data-privacy.md) | Where every piece of data lives; every `disclose()`; indirect leaks |
| [Circuits and flows](01-contract/circuits.md) | Each use case: what runs locally, what is verified on-chain |
| [Private state](01-contract/private-state.md) | What the client stores, and what happens if it is lost |
| [Invariants and cryptography](01-contract/invariants-and-cryptography.md) | Invariants; commitments, Merkle trees, nullifiers |
| [Integration](01-contract/integration.md) | Compiler output, witnesses in TypeScript, providers, deploying |
| [Security](01-contract/security.md) | Threat model, known privacy limits, tests, review history |
| [Changelog](01-contract/changelog.md) | Contract changes and on-chain deployments |

## 02 — Indexer

[`indexer/`](../indexer/)

| Document | What it covers |
|---|---|
| [Purpose, scope and data source](02-indexer/README.md) | What it follows, what it cannot see, where it reads from |
| [Mapping and parsing](02-indexer/mapping.md) | Per circuit: ledger change → database row. Type rules. Known gaps and bugs. |
| [Data model](02-indexer/data-model.md) | Schema diagram, every column and its ledger origin, the cursor |
| [Sync and consistency](02-indexer/sync.md) | Backfill, reorgs, idempotency, errors, reindexing, contract upgrades |
| [Operation](02-indexer/operations.md) | Configuration, metrics, alerts, runbook |

## 03 — API

[`indexer/src/api/`](../indexer/src/api/)

| Document | What it covers |
|---|---|
| [Overview and conventions](03-api/README.md) | Consistency, formats, errors, versioning, security, privacy, performance |
| [Endpoint reference](03-api/endpoints.md) | Parameters, responses, errors, examples, field origins |
| [`openapi.yaml`](03-api/openapi.yaml) | OpenAPI 3.0 description |
| [For integrators](03-api/quickstart.md) | Quickstart, use cases, changelog |

## 04 — Operations

| Document | What it covers |
|---|---|
| [Environments](04-operations/README.md) | Local and preprod: networks, contracts, endpoints, secrets |
| [Local setup](04-operations/local-setup.md) | Devnet, proof server, contract, indexer, database, API |
| [Deploying](04-operations/deploy.md) | Order of deployment, upgrades, new deployments, rollback |
| [Monitoring and runbooks](04-operations/monitoring-runbooks.md) | Checks and incident procedures across the stack |

## Known issues found while documenting

These are described where they belong; this list is so they are not lost.

| Area | Issue | Details |
|---|---|---|
| Indexer | No reorg handling | [Sync](02-indexer/sync.md#finality-and-reorgs) |
| Indexer | Some public ledger fields are not indexed; self-burns and revocations are not told apart | [Mapping, open gaps](02-indexer/mapping.md#open) |
| API | No freshness indicator, pagination, rate limit or versioning | [API overview](03-api/README.md) |
| API | The operator can link a user's pseudonyms across organizers | [API privacy](03-api/README.md#privacy) |
| Contract | The admin's secret key is the deployer wallet's seed | [Security](01-contract/security.md#known-issues-and-open-items) |
| Operations | No monitoring; `/health` stays `ok` while indexing is stalled | [Monitoring](04-operations/monitoring-runbooks.md) |

Four indexer bugs were also found and fixed in the same change (reactivated events, issuer
status, out-of-range `Uint<64>` values, out-of-order backfill): see
[Mapping, fixed](02-indexer/mapping.md#fixed). A database filled by an older indexer needs one
reindex to pick the fixes up.
