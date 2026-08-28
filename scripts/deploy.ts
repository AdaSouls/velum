/**
 * TASK-015: Deploy the POAP contract to a Midnight network.
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
 * Network selection (2026-08-28): driven by testkit-js's own `MN_TEST_ENVIRONMENT` env var —
 * this is the SDK's built-in mechanism, not a hand-rolled config map, so it stays correct as
 * Midnight adds/changes networks:
 *   - unset / 'undeployed' (default): local devnet.yml, unchanged from the original version of
 *     this script. Uses the genesis wallet — devnet.yml's `dev` chain spec pre-mints NIGHT to it.
 *   - 'preprod' | 'preview' | 'qanet': testkit-js's built-in `RemoteTestEnvironment` subclasses.
 *     `getTestEnvironment().getEnvironmentConfiguration()` returns the network's canonical
 *     node/indexer/faucet URLs — no URLs are hardcoded here. We deliberately do NOT call this
 *     class's `.start()`: it health-checks node/indexer/faucet with a hardcoded 1000ms axios
 *     timeout per endpoint (testkit-js's NodeClient/IndexerClient/FaucetClient.health()), which is
 *     tighter than preprod's real round-trip latency from here (~1.0-1.1s measured directly
 *     against rpc.preprod/indexer.preprod.midnight.network on 2026-08-28) and fails spuriously
 *     even though the endpoints are healthy — confirmed by curling them directly. The proof
 *     server is local for every network regardless (it handles your private data — see
 *     docs.midnight.network/guides/networks-and-environments), so we override it with an
 *     already-running instance on :6300 (`docker compose -f devnet.yml up -d proof-server`)
 *     rather than the one `.start()` would otherwise have resolved. Requires
 *     `MN_TEST_WALLET_SEED` (a 32-byte hex secret key) for a wallet that's already been funded
 *     via that network's faucet — see `scripts/wallet-info.ts` to derive the address to fund
 *     before running this. There is no genesis wallet outside 'undeployed'.
 *   - 'env-var-remote': any other/future network (including mainnet once it's live) — set
 *     MN_TEST_NODE, MN_TEST_INDEXER, MN_TEST_INDEXER_WS, MN_TEST_NETWORK_ID (and optionally
 *     MN_TEST_FAUCET) directly; testkit-js reads those without needing a new named case here.
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
 *   (gitignored build output; NodeZkConfigProvider reads prover/verifier keys from there). These
 *   artifacts are network-agnostic (the proof server itself is always local, for every network —
 *   see docs.midnight.network/guides/networks-and-environments), so nothing to recompile per network.
 * - For 'undeployed': devnet.yml running (`docker compose -f devnet.yml up -d` from the repo root).
 * - For 'preprod'/'preview'/'qanet': just the proof server from devnet.yml running
 *   (`docker compose -f devnet.yml up -d proof-server` — it has no dependency on node/indexer/
 *   poap-pg, so this starts only that one container) and a funded wallet seed in
 *   MN_TEST_WALLET_SEED.
 *
 *   npx tsx scripts/deploy.ts                                              # local devnet
 *   MN_TEST_ENVIRONMENT=preprod MN_TEST_WALLET_SEED=<hex> npx tsx scripts/deploy.ts   # preprod
 *
 * Outputs the deployed contract address and saves it to docs/deployment.<network>.md and
 * .env.<network>.local — 'undeployed' keeps the original unsuffixed docs/deployment.md and
 * .env.local filenames so the existing local workflow (docs/environment.md) doesn't change.
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
  waitForFunds,
  initializeMidnightProviders,
  getTestEnvironment,
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
  | 'claim'
  | 'mintTo'
  | 'burn'
  | 'getCallerPk'
  | 'getHolderPk'
  | 'revealPrivateMetadata'
  | 'revealPrivateTokenMetadata';

// ── Config ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(__dirname, '..', 'contracts');
const ZK_CONFIG_PATH = path.join(CONTRACTS_DIR, 'src', 'managed', 'poap');

// Genesis wallet seed — the `dev` chain spec (devnet.yml's CFG_PRESET: 'dev') pre-mints NIGHT
// to the wallet derived from this seed. Only valid on 'undeployed' (local devnet); every other
// network requires a real funded seed via MN_TEST_WALLET_SEED — see module doc comment above.
const GENESIS_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
const PRIVATE_STATE_ID = 'poapPrivateState';
// A first shielded/dust sync against a real network's full history can take a while — see the
// comment where this is used, in main(). Local devnet finishes almost instantly regardless.
const WALLET_SYNC_TIMEOUT_MS = 10 * 60_000;

// Demo event parameters (TASK-016)
const DEMO_EVENT_ID = new Uint8Array(32);
DEMO_EVENT_ID[0] = 0xde;
DEMO_EVENT_ID[1] = 0x01;

// Matches devnet.yml's exposed ports (new-generation SDK devnet: node 0.22.5 /
// indexer-standalone 4.2.1 / proof-server 8.1.0, per the official compatibility matrix
// pairing for compact-runtime 0.16.0 / midnight-js 4.1.1 / testkit-js 4.1.1). Used only for the
// default 'undeployed' network — every other network's config comes from testkit-js itself.
const LOCAL_ENV_CONFIG: EnvironmentConfiguration = {
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const targetNetwork = (process.env.MN_TEST_ENVIRONMENT || 'undeployed').toLowerCase();
  logger.info(`=== AdaSouls POAP Contract Deployment (network: ${targetNetwork}) ===`);

  let envConfig: EnvironmentConfiguration;
  let seedHex: string;

  if (targetNetwork === 'undeployed') {
    envConfig = LOCAL_ENV_CONFIG;
    seedHex = GENESIS_SEED;
    setNetworkId(envConfig.networkId);
  } else {
    seedHex = process.env.MN_TEST_WALLET_SEED ?? '';
    if (!seedHex) {
      throw new Error(
        `MN_TEST_WALLET_SEED is required when MN_TEST_ENVIRONMENT=${targetNetwork} — there is no ` +
          `pre-funded genesis wallet outside 'undeployed'. Run scripts/wallet-info.ts to generate ` +
          `a seed and get the address to fund via that network's faucet, then re-run with ` +
          `MN_TEST_WALLET_SEED set to it.`,
      );
    }

    // getTestEnvironment() reads MN_TEST_ENVIRONMENT itself, picks the matching
    // RemoteTestEnvironment subclass, and calls setNetworkId() as a side effect. We read its
    // getEnvironmentConfiguration() directly rather than calling .start() — see the module doc
    // comment above for why (.start()'s health check has a too-tight hardcoded timeout for this
    // network's real latency). The proof server is local for every network regardless, so we
    // point at an already-running one (`docker compose -f devnet.yml up -d proof-server`) instead
    // of the URL .start() would otherwise have filled in from its own managed container.
    const testEnv = getTestEnvironment(logger);
    envConfig = { ...testEnv.getEnvironmentConfiguration(), proofServer: 'http://localhost:6300' };
    logger.info(`Network config: ${JSON.stringify(envConfig)}`);
  }

  logger.info('Building wallet...');
  const wallet = await MidnightWalletProvider.build(logger, envConfig, seedHex);

  // Not using MidnightWalletProvider.start() here: it calls testkit-js's waitForFunds(), which
  // syncs with a hardcoded 90s timeout (syncWallet()'s default). That's fine on local devnet
  // (near-instant, tiny chain) but a first shielded/dust sync against a real network's full
  // history can take much longer — confirmed 2026-08-28 against preprod, where unshielded synced
  // in seconds but shielded/dust were still incomplete at 90s. So we start the wallet and sync it
  // ourselves with a generous timeout, then call waitForFunds() (still handles the faucet request
  // and dust-UTXO registration) — by then wallet.wallet.state() is already caught up, so its
  // internal 90s-limited syncWallet() call resolves immediately instead of re-scanning.
  await wallet.wallet.start(wallet.zswapSecretKeys, wallet.dustSecretKey);
  logger.info(`Waiting for wallet to sync (up to ${WALLET_SYNC_TIMEOUT_MS / 1000}s)...`);
  await syncWallet(wallet.wallet, 2_000, WALLET_SYNC_TIMEOUT_MS);
  const balance = await waitForFunds(wallet.wallet, envConfig, true, wallet.unshieldedKeystore);
  logger.info(`Wallet NIGHT balance: ${balance}`);
  logger.info(`Wallet coin public key: ${wallet.getCoinPublicKey()}`);

  // Witnesses must bind the *actual* deploying wallet's secret key — building this from
  // GENESIS_SEED unconditionally (as the original version of this script did) would silently
  // make every deployment's on-chain adminPk/organizer identity derive from the local devnet
  // seed even when deploying with a different funded wallet.
  const secretKey = Buffer.from(seedHex, 'hex');
  const CompiledPoapContract = CompiledContract.make('PoapContract', Contract).pipe(
    CompiledContract.withWitnesses(createWitnesses(secretKey)),
    CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
  );

  const providers = initializeMidnightProviders<PoapCircuits, PoapPrivateState>(wallet, envConfig, {
    privateStateStoreName: 'poap-deploy-state',
    zkConfigPath: ZK_CONFIG_PATH,
  });

  const initialPrivateState: PoapPrivateState = { secretKey, tokens: {} };

  try {
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
      // Fully public demo event — all-zero privateMetadataCommit means "no private part".
      args: [
        DEMO_EVENT_ID,
        100n,
        0n,
        true,
        'ipfs://bafybeih6xhqqfxfyfqgw2xkjxhcxc4kdemoevent/metadata.json',
        new Uint8Array(32),
      ],
    });
    logger.info(`Event created in block ${eventTx.public.blockHeight}, tx: ${eventTx.public.txHash}`);

    const demoEventHex = Buffer.from(DEMO_EVENT_ID).toString('hex');
    const deploymentMd = `# Deployment Record

## POAP Contract — Midnight ${targetNetwork}

| Field | Value |
|---|---|
| Contract Address | \`${contractAddress}\` |
| Deploy Tx Hash | \`${deployTxHash}\` |
| Network | ${targetNetwork} |
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

    // 'undeployed' keeps the original unsuffixed filenames so the existing local workflow
    // (docs/environment.md) and anything a developer has already scripted around it don't change.
    const deploymentMdName = targetNetwork === 'undeployed' ? 'deployment.md' : `deployment.${targetNetwork}.md`;
    const envFileName = targetNetwork === 'undeployed' ? '.env.local' : `.env.${targetNetwork}.local`;

    fs.writeFileSync(path.join(CONTRACTS_DIR, '..', 'docs', deploymentMdName), deploymentMd);
    logger.info(`Saved to docs/${deploymentMdName}`);

    const envContent = `MIDNIGHT_NETWORK_ID=${targetNetwork}
MIDNIGHT_NODE_URL=${envConfig.nodeWS}
MIDNIGHT_INDEXER_URL=${envConfig.indexer}
MIDNIGHT_INDEXER_WS=${envConfig.indexerWS}
MIDNIGHT_PROOF_SERVER_URL=${envConfig.proofServer}
CONTRACT_ADDRESS=${contractAddress}
DEMO_EVENT_ID=${demoEventHex}
ADMIN_SEED=${seedHex}
`;
    fs.writeFileSync(path.join(CONTRACTS_DIR, '..', envFileName), envContent);
    logger.info(`Saved to ${envFileName}`);

    logger.info('=== Deployment complete ===');
  } finally {
    await wallet.stop();
  }
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'Deployment failed');
  process.exit(1);
});
