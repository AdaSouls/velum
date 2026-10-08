# Deployment Record

## POAP Contract — Midnight preprod

| Field | Value |
|---|---|
| Contract Address | `5b019fc6e613a9a591ec84ac3f937674d3c4ceadc8fcd80d7dbe59cbb8ad6255` |
| Deploy Tx Hash | `75e908a2655473a8ece5040b756becb32fc33f679e0c4d686944b42308f090f1` |
| Network | preprod |
| Deployed | 2026-10-08T05:26:35Z |
| Commit | `77e4ed8` |
| Circuits | 22, verified against the local build with `scripts/upgrade.ts` (plan only) |

No demo event: the contract was deployed empty (0 events, 0 tokens), with `SKIP_DEMO_EVENT=1`.

Deployed with proof server 8.1.3. The first attempt was rejected with `Custom error: 170` while
the wallet was still catching up; the retry, with the wallet at the head, went through.

Adds multi-condition credential requests and atomic re-issue
(see [changelog](../docs/01-contract/changelog.md)).

**Not live yet.** The API host and the frontend still follow the contract below. Switching them
is a coordinated step, see [Deploying](../docs/04-operations/deploy.md): the frontend needs a
build for this contract first (its request, proof and re-issue calls changed).

## API host

| Field | Value |
|---|---|
| API | `https://velum-api.adasouls.io` (Caddy + indexer + Postgres, `deploy/production/`) |
| Frontend | `https://velum.adasouls.io` (Vercel, `poap-frontend` branch `feature/production`) |
| Deployed commit | `8d628bc` (`4ac002a` plus the Caddyfile route for credential update requests) |
| Live since | 2026-09-25 |
| Serving | The **previous** contract, `fadfffae…152a`, since 2026-10-07 |

To move the host to the contract above: check out the matching commit, set the new
`CONTRACT_ADDRESS`, reset the database, and publish the 22 circuits' ZK artifacts at
`/zk/poap/` (`deploy/production/sync-zk.sh`, then `rsync`).

## Previous deployment (still served by the API host and the frontend)

Being replaced because multi-condition credential requests and atomic re-issue added a ledger
field and changed the circuits (see [changelog](../docs/01-contract/changelog.md)).

| Field | Value |
|---|---|
| Contract Address | `fadfffaec26bf23b09de98e9fc3486f5d09589c5de5602af148338f4aead152a` |
| Deploy Tx Hash | `5c466d3ebce943c0e50203c5ee7191ab4a6e3d3dfc50164d3a114c7d3be541df` |
| Network | preprod |
| Deployed | 2026-10-06T22:32:00Z |
| Commit | `4ac002a` |
| Circuits | 20, verified against the local build with `scripts/upgrade.ts` (plan only) |

No demo event: the contract was deployed empty (0 events, 0 tokens), with `SKIP_DEMO_EVENT=1`.

Deployed with proof server 8.1.3.

## Earlier deployment (replaced 2026-10-07)

Replaced because identity documents and credential update requests added a ledger field and two
circuits (see [changelog](../docs/01-contract/changelog.md)). Still on-chain, no longer maintained.

| Field | Value |
|---|---|
| Contract Address | `5e303d805abf829e3595dca0402f5871490e4bc2336a65f440689c78ecd8b527` |
| Deploy Tx Hash | `46d6d92a51e8fb717a822dceddc25900a2d6417b844689f34bdd82eb7a87649a` |
| Network | preprod |
| Deployed | 2026-10-04T05:13:48Z |
| Commit | `f6f6114` |

Deployed with proof server 8.1.3. With 8.1.0 the node rejected the deploy transaction on four
attempts (`Custom error: 170`, invalid DUST spend proof), including with the wallet fully synced.

## First deployment (replaced 2026-10-04)

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
with the demo event (which has no image). Superseded by the empty `5e303d80…` contract above; nothing
points at it.
