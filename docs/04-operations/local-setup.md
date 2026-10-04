# Local setup

Everything on one machine: a Midnight devnet, a proof server, the contract, the Velum indexer
with its database, and the API.

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 22+ |
| Compact compiler | 0.31.1 (`compact update 0.31.1`) |
| Docker or Podman, with Compose | any recent |

`bash scripts/verify-env.sh` checks the basics.

## 1. Install

From the repository root. `contracts`, `scripts` and `indexer` are npm workspaces and must be
installed together.

```bash
npm install
```

## 2. Build the contract

```bash
cd contracts
npm run compact          # full build with keys, a few minutes
npm run compact:shell    # the circuit-less build used by the deploy script
npm test                 # 125 contract tests, no network needed
cd ..
```

The keys (`contracts/src/managed/poap/keys/`, about 100 MB) are not in git, so this step is
needed on every fresh clone.

## 3. Start the devnet

```bash
docker compose -f devnet.yml up -d
docker compose -f devnet.yml ps
```

| Service | Container | Port | What it is |
|---|---|---|---|
| `node` | `midnight-node` | 9944 | A single-node Midnight chain (`dev` preset) |
| `indexer` | `midnight-indexer` | 8088 | Midnight's indexer, GraphQL |
| `proof-server` | `midnight-proof-server` | 6300 | Builds proofs |
| `poap-pg` | `poap-indexer-pg` | 5434 | Postgres for the Velum indexer |

Use `127.0.0.1`, not `localhost`, when pointing tools at these ports: with rootless Podman the
IPv6 lookup of `localhost` can fail.

## 4. Deploy the contract

```bash
npx tsx scripts/deploy.ts
```

On the devnet this uses the pre-funded genesis wallet, so no seed is needed, and it finishes in
a few minutes. It deploys the shell, inserts the 18 verifier keys one by one, and creates a demo
event. It writes:

- `deployments/undeployed.md`: the address and the demo event id
- `.env.local`: the same, plus the endpoints and the admin seed

## 5. Start the indexer and the API

They are one process.

```bash
cd indexer
CONTRACT_ADDRESS=<address from step 4> npm start
```

Expected output:

```
[db] applied 001_init.sql
[api] listening on http://localhost:3001
[sub] resuming from block 0
[gql-ws] connected
  [+] event …  created
[state] createEvent @ block …
```

The other settings default to the devnet's ports. To keep the address between runs, put it in
`indexer/.env`:

```
CONTRACT_ADDRESS=<address>
```

`npm run dev` restarts on file changes.

## 6. Check it

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/events      # the demo event
```

## 7. The web app (optional)

The web app is in the separate `poap-frontend` repository. It needs the contract address, the
network id `undeployed`, the API URL `http://localhost:3001` and a copy of the compiled contract
and ZK artifacts. Add its origin to `CORS_ALLOWED_ORIGINS` when starting the indexer, or the
browser will block its API calls:

```bash
CONTRACT_ADDRESS=<address> CORS_ALLOWED_ORIGINS=http://localhost:3000 npm start
```

See that repository for its own setup.

## Tests

| Suite | Command | Needs |
|---|---|---|
| Contract | `cd contracts && npm test` | The compiled contract |
| Indexer, component | `cd indexer && npm test` | `poap-pg` running. Skipped if Postgres is unreachable. **Truncates the indexer tables.** |
| Indexer, live | `cd indexer && CONTRACT_ADDRESS=<addr> LIVE_DEVNET=true npm test` | The whole devnet and a deployed contract |

Do not run the indexer tests against a database you want to keep.

## Resetting

| To reset | Command |
|---|---|
| Everything (chain, Midnight indexer, Velum database) | `docker compose -f devnet.yml down -v`, then start again from step 3 |
| Only the Velum database | Truncate the tables; see [Reindexing](../02-indexer/sync.md#reindexing-from-scratch) |
| The contract | Run `scripts/deploy.ts` again. It deploys a **new** address: reset the Velum database and restart the indexer with the new address. |

After the devnet is wiped, old contract addresses no longer exist. An indexer still pointed at
one will connect and receive nothing.

## Common problems

| Symptom | Cause |
|---|---|
| `Missing required env var: CONTRACT_ADDRESS` | Step 5 needs the address |
| `expected instance of ChargedState` | Two copies of the Midnight runtime are loaded. Run `npm install` at the root, not inside a workspace; do not set `CONTRACT_MODULE_PATH` with different letter casing. |
| Deploy fails with "would exhaust the block limits" | The full contract was deployed in one transaction. Use `scripts/deploy.ts`, which stages it. |
| Deploy cannot find `poap-shell` | Run `npm run compact:shell` (step 2) |
| Connection reset on port 6300 | Use `127.0.0.1` instead of `localhost` |
| The API returns `[]` | The indexer is pointed at an old address, or has not connected yet |
| Browser calls fail with a CORS error | Set `CORS_ALLOWED_ORIGINS` |
