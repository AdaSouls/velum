/**
 * TASK-015: Deploy the POAP contract to Midnight devnet.
 *
 * Rewritten against the SDK generation actually declared in this package's package.json
 * (compact-runtime 0.16.0 / ledger 4.0.0 / midnight-js-* 4.1.1 / zswap 4.0.0 / testkit-js 4.1.1 /
 * wallet-sdk 1.1.0), which matches the "preview" row of Midnight's official compatibility matrix.
 * Uses CompiledContract.make/.pipe, deployContract(providers, options),
 * submitCallTx(providers, options), and MidnightWalletProvider/syncWallet/
 * initializeMidnightProviders from @midnight-ntwrk/testkit-js — verified end-to-end against a
 * running local devnet (devnet.yml: midnight-node 0.22.5 + indexer-standalone 4.2.1 +
 * proof-server 8.1.0), not just typechecked.
 *
 * Prerequisites:
 * - `npm install` at the repo root (contracts/ and scripts/ are npm workspaces sharing one
 *   node_modules — required so WASM-backed classes like ContractMaintenanceAuthority and
 *   StateValue come from a single @midnight-ntwrk/onchain-runtime-v3 instance. Two separate
 *   copies of that package — e.g. one under contracts/node_modules and another under
 *   scripts/node_modules, or a version mismatch forcing a nested copy under some other
 *   package's node_modules — fail `instanceof` checks in the WASM bindings even when the
 *   versions match; the "overrides" pin in the root package.json exists for that reason).
 * - contracts/src/managed/poap/keys/ generated locally via `cd contracts && npm run compact`
 *   (gitignored build output; NodeZkConfigProvider reads prover/verifier keys from there).
 * - devnet.yml running: `docker compose -f devnet.yml up -d` (from the repo root).
 *
 *   npx tsx scripts/deploy.ts
 *
 * Outputs the deployed contract address and saves it to docs/deployment.md and .env.local.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { WebSocket } from 'ws';

// Node 19+ already exposes a native, getter-only globalThis.crypto backed by the same
// node:crypto webcrypto implementation, so assigning over it unconditionally throws
// "Cannot set property crypto of #<Object> which has only a getter" on modern Node.
if (!globalThis.crypto) {
  // @ts-expect-error needed for Scala.js / WASM crypto on Node <19
  globalThis.crypto = webcrypto;
}
// @ts-expect-error needed for Apollo WebSocket (GraphQL subscriptions) in Node.js
globalThis.WebSocket = WebSocket;

import pino from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, submitCallTx, type DeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import {
  MidnightWalletProvider,
  syncWallet,
  initializeMidnightProviders,
  type EnvironmentConfiguration,
} from '@midnight-ntwrk/testkit-js';

import { Contract } from '../contracts/src/managed/poap/contract/index.js';
import { createWitnesses, type PoapPrivateState } from '../contracts/src/witnesses.js';

type PoapCircuits =
  | 'pause'
  | 'unpause'
  | 'registerIssuer'
  | 'deactivateIssuer'
  | 'createEvent'
  | 'deactivateEvent'
  | 'claimOrUpdate'
  | 'mintTo'
  | 'burn';

// ── Config ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(__dirname, '..', 'contracts');
const ZK_CONFIG_PATH = path.join(CONTRACTS_DIR, 'src', 'managed', 'poap');

// Genesis wallet seed — the `dev` chain spec (devnet.yml's CFG_PRESET: 'dev') pre-mints NIGHT
// to the wallet derived from this seed. Local devnet only; never reuse on preprod/preview/mainnet.
const GENESIS_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
const PRIVATE_STATE_ID = 'poapPrivateState';

// Demo event parameters (TASK-016)
const DEMO_EVENT_ID = new Uint8Array(32);
DEMO_EVENT_ID[0] = 0xde;
DEMO_EVENT_ID[1] = 0x01;

// Matches devnet.yml's exposed ports (new-generation SDK devnet: node 0.22.5 /
// indexer-standalone 4.2.1 / proof-server 8.1.0, per the official compatibility matrix
// pairing for compact-runtime 0.16.0 / midnight-js 4.1.1 / testkit-js 4.1.1).
const envConfig: EnvironmentConfiguration = {
  walletNetworkId: 'undeployed',
  networkId: 'undeployed',
  indexer: 'http://127.0.0.1:8088/api/v4/graphql',
  indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
  node: 'http://127.0.0.1:9944',
  nodeWS: 'ws://127.0.0.1:9944',
  proofServer: 'http://127.0.0.1:6300',
  faucet: undefined,
};

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

// ── Compiled contract ─────────────────────────────────────────────────────────

const secretKey = Buffer.from(GENESIS_SEED, 'hex');

const CompiledPoapContract = CompiledContract.make('PoapContract', Contract).pipe(
  CompiledContract.withWitnesses(createWitnesses(secretKey)),
  CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  logger.info('=== AdaSouls POAP Contract Deployment ===');

  setNetworkId(envConfig.networkId);

  logger.info('Building wallet from genesis seed...');
  const wallet = await MidnightWalletProvider.build(logger, envConfig, GENESIS_SEED);
  await wallet.start();

  logger.info('Syncing wallet...');
  await syncWallet(wallet.wallet);
  logger.info(`Wallet coin public key: ${wallet.getCoinPublicKey()}`);

  const providers = initializeMidnightProviders<PoapCircuits, PoapPrivateState>(wallet, envConfig, {
    privateStateStoreName: 'poap-deploy-state',
    zkConfigPath: ZK_CONFIG_PATH,
  });

  const initialPrivateState: PoapPrivateState = { secretKey, tokens: {} };

  logger.info('Deploying POAP contract...');
  const deployed: DeployedContract<Contract> = await deployContract<Contract>(providers, {
    compiledContract: CompiledPoapContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState,
  });

  const contractAddress = deployed.deployTxData.public.contractAddress;
  const deployTxHash = deployed.deployTxData.public.txHash;
  logger.info(`Contract deployed! Address: ${contractAddress}, tx: ${deployTxHash}`);

  logger.info('Creating demo event...');
  const eventTx = await submitCallTx<Contract, 'createEvent'>(providers, {
    compiledContract: CompiledPoapContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    circuitId: 'createEvent',
    args: [DEMO_EVENT_ID, 100n, 0n, true, 'ipfs://bafybeih6xhqqfxfyfqgw2xkjxhcxc4kdemoevent/metadata.json'],
  });
  logger.info(`Event created in block ${eventTx.public.blockHeight}, tx: ${eventTx.public.txHash}`);

  const demoEventHex = Buffer.from(DEMO_EVENT_ID).toString('hex');
  const deploymentMd = `# Deployment Record

## POAP Contract — Midnight Devnet

| Field | Value |
|---|---|
| Contract Address | \`${contractAddress}\` |
| Deploy Tx Hash | \`${deployTxHash}\` |
| Network | Undeployed (local devnet) |
| Deployed | ${new Date().toISOString()} |

## Demo Event

| Field | Value |
|---|---|
| Event ID | \`${demoEventHex}\` |
| Max Supply | 100 |
| Expiration | None |
| Public Mint | Yes |
| Metadata URI | \`ipfs://bafybeih6xhqqfxfyfqgw2xkjxhcxc4kdemoevent/metadata.json\` |
| Create Tx Hash | \`${eventTx.public.txHash}\` |
| Block Height | ${eventTx.public.blockHeight} |
`;

  fs.writeFileSync(path.join(CONTRACTS_DIR, '..', 'docs', 'deployment.md'), deploymentMd);
  logger.info('Saved to docs/deployment.md');

  const envContent = `MIDNIGHT_NODE_URL=${envConfig.nodeWS}
MIDNIGHT_INDEXER_URL=${envConfig.indexer}
MIDNIGHT_INDEXER_WS=${envConfig.indexerWS}
MIDNIGHT_PROOF_SERVER_URL=${envConfig.proofServer}
CONTRACT_ADDRESS=${contractAddress}
DEMO_EVENT_ID=${demoEventHex}
ADMIN_SEED=${GENESIS_SEED}
`;
  fs.writeFileSync(path.join(CONTRACTS_DIR, '..', '.env.local'), envContent);
  logger.info('Saved to .env.local');

  logger.info('=== Deployment complete ===');
  await wallet.stop();
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'Deployment failed');
  process.exit(1);
});
