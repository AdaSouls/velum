# Smart contract documentation

Velum has one contract: [`contracts/compact/poap.compact`](../../contracts/compact/poap.compact).

| Document | Read it when you want to know |
|---|---|
| [Overview](overview.md) | What the contract is for, who the actors are, how they are authorized |
| [Public and private data](data-privacy.md) | What an outside observer can and cannot learn |
| [Circuits and flows](circuits.md) | What each circuit does and how the use cases chain together |
| [Private state](private-state.md) | What lives only on the user's device |
| [Invariants and cryptography](invariants-and-cryptography.md) | What must always hold, and how the hashes are built |
| [Integration](integration.md) | How to build, deploy and call the contract from TypeScript |
| [Security](security.md) | What can go wrong and what has been tested |
| [Changelog](changelog.md) | What changed and when |

## Toolchain

| | Version | Where it is pinned |
|---|---|---|
| Language | `pragma language_version >= 0.23` (compiles as 0.23.0) | first line of the contract |
| Compiler (`compactc`) | 0.31.1 | `compact compile +0.31.1 …` in [`contracts/package.json`](../../contracts/package.json) |
| `@midnight-ntwrk/compact-runtime` | 0.16.0 | `contracts/package.json`, `scripts/package.json`, `indexer/package.json` |

The compiler records the versions it used in
[`contracts/src/managed/poap/compiler/contract-info.json`](../../contracts/src/managed/poap/compiler/contract-info.json).
Compact changes quickly, so check that file and the pin before trusting anything here against a
newer compiler.

## Comment convention in the contract

Compact has no NatSpec-style standard and no documentation generator, so the contract uses its own
tags. They sit directly above the element they describe, after any free-form rationale.

| Tag | Used on | Meaning |
|---|---|---|
| `@ledger` | `export ledger` fields | What the field stores and which circuits write it. Every ledger field is public. |
| `@witness` | `witness` declarations | What private data the client supplies |
| `@source` | `witness` declarations | Where the client gets it (private state, user input) |
| `@trust` | `witness` declarations | What a malicious witness implementation could do |
| `@circuit` | `export circuit` | What the circuit does and who is meant to call it |
| `@param` | `export circuit` | One per argument |
| `@returns` | `export circuit` | Return value, if any |
| `@auth` | `export circuit` | How the caller is authorized |
| `@asserts` | `export circuit` | What must hold for the transaction to succeed |
| `@writes` | `export circuit` | Ledger fields modified (`none` for a pure check) |
| `@discloses` | `export circuit` | Every value that becomes public, and why that is acceptable |
| `@private` | `export circuit` | What stays inside the proof |

Example:

```compact
// @circuit   Blocks an organizer, permanently.
// @param     issuerPk  The public key to block.
// @auth      Admin.
// @asserts   Not paused; caller is the admin.
// @writes    issuers[issuerPk] = { isActive: false }.
// @discloses issuerPk — it becomes a public ledger key.
export circuit deactivateIssuer(issuerPk: Bytes<32>): [] {
```

When you change a circuit, update its tags in the same commit. The `@discloses` line is the one
reviewers should read first: adding a `disclose()` is a privacy decision.

### Do comment changes require a redeploy?

No. Comments don't change the circuits. This was checked against this contract with compiler
0.31.1: after editing comments, `zkir/` and every prover and verifier key came out byte-identical.
Adding or removing lines only changes the line numbers embedded in the generated
`contract/index.js` and its source map, so recompile and commit those to keep them in sync.
