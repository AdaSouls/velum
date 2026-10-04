# Deployment Record

## POAP Contract — Midnight preprod

| Field | Value |
|---|---|
| Contract Address | `5e303d805abf829e3595dca0402f5871490e4bc2336a65f440689c78ecd8b527` |
| Deploy Tx Hash | `46d6d92a51e8fb717a822dceddc25900a2d6417b844689f34bdd82eb7a87649a` |
| Network | preprod |
| Deployed | 2026-10-04T05:13:48Z |
| Circuits | 18, verified against the local build with `scripts/upgrade.ts` (plan only) |

No demo event: the contract was deployed empty (0 events, 0 tokens).

Deployed with proof server 8.1.3. With 8.1.0 the node rejected the deploy transaction on four
attempts (`Custom error: 170`, invalid DUST spend proof), including with the wallet fully synced.

## API host

| Field | Value |
|---|---|
| API | `https://velum-api.adasouls.io` (Caddy + indexer + Postgres, `deploy/production/`) |
| Frontend | `https://velum.adasouls.io` (Vercel, `poap-frontend` branch `feature/production`) |
| Deployed commit | `40834d2` |
| Live since | 2026-09-25 |

The API host and the frontend still serve the **previous** contract (below) until the indexer is
pointed at the new address with a reset database and the frontend ships the new artifacts.

## Previous deployment (replaced 2026-10-04)

Replaced because addressed disclosure requests changed the ledger layout
(see [changelog](../docs/01-contract/changelog.md)). Still on-chain, no longer maintained.

| Field | Value |
|---|---|
| Contract Address | `3ce0a48228880fa377d22d364a1ad19fee5cb6e26a8ed80de11d7ab07433ceef` |
| Deploy Tx Hash | `79cff4cdb4df8a71b7c94ee79a46bdc83e89377e9d6afb5a16fec348d63ecd59` |
| Network | preprod |
| Deployed | 2026-09-24T07:07:51.992Z |

### Upgrades (same address)

| Date | Circuits swapped | Blocks | Commit |
|---|---|---|---|
| 2026-10-01 | `deactivateIssuer`, `createEvent`, `reactivateEvent`, `claim`, `mintTo` | 2786573–2786609 | `d11d114` + fee overhead fix |

## Unused deployment (2026-10-04)

`e690c69e9d30ed025b0463e615a0bcfed040650c13a25e2771ccc63ad616c498` is the same contract build, deployed a few minutes earlier
with the demo event (which has no image). Superseded by the empty contract above; nothing points
at it.
