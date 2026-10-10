# Deployment Record

## POAP Contract — Midnight mainnet

| Field | Value |
|---|---|
| Contract Address | `9b253fc7796e247e98481ef7d4e3eca64b62f9493bafeafcb8d06b889866e029` |
| Deploy Tx Hash | `ccf1d147880d12d3419748764cfadc362bc5fceac6144d6bf22f20a7376f9ec6` |
| Network | mainnet |
| Deployed | 2026-10-10T07:29:36Z (block 2949527) |
| Commit | `77e4ed8` (the same contract build as preprod's `5b019fc6…6255`) |
| Circuits | 22, verified against the local build with `scripts/upgrade.ts` (plan only) |

No demo event: the contract was deployed empty (0 events, 0 tokens), with `SKIP_DEMO_EVENT=1`.

Deployed with proof server 8.1.3, through Blockfrost's Midnight mainnet indexer and RPC.

The deploying wallet holds no NIGHT on Midnight; its fees were paid with DUST.

`deploy.ts` deployed the shell and inserted 12 verifier keys, then stopped on a
`Transaction submission error` from the node. The remaining 10 were inserted on the same address
with `scripts/upgrade.ts --apply` (blocks 2949591–2949627).

Deployed to meet the Catalyst change request. Day-to-day testing stays on preprod
(`https://velum.adasouls.io`, see [preprod](preprod.md)).

## API host

Not live yet. Planned: `https://mainnet.velum.adasouls.io` (frontend) and a second indexer on the
existing API host (compose profile `mainnet`, see
[`deploy/production/README.md`](../deploy/production/README.md)).
