# Velum documentation

The top-level [README](../README.md) is the introduction. These documents go deeper.

## Smart contracts

Everything about the Compact contract in [`contracts/compact/poap.compact`](../contracts/compact/poap.compact).

| Document | What it covers |
|---|---|
| [Overview](smart-contracts/overview.md) | The privacy problem Velum solves, roles and authorization, tokens and fees |
| [Public and private data](smart-contracts/data-privacy.md) | Where every piece of data lives and who can see it; every `disclose()`; what can be inferred indirectly |
| [Circuits and flows](smart-contracts/circuits.md) | Each use case step by step: what runs locally, what is verified on-chain |
| [Private state](smart-contracts/private-state.md) | What the client stores, how, and what happens if it is lost |
| [Invariants and cryptography](smart-contracts/invariants-and-cryptography.md) | Ledger and privacy invariants; how commitments, Merkle trees and nullifiers are built |
| [Integration](smart-contracts/integration.md) | Compiler output, witnesses in TypeScript, providers, deploying and connecting, tool versions |
| [Security](smart-contracts/security.md) | Threat model, known privacy limits, tests, audit history |
| [Changelog](smart-contracts/changelog.md) | Contract changes and on-chain deployments |

The conventions used for comments inside the contract are described in
[smart-contracts/README.md](smart-contracts/README.md).
