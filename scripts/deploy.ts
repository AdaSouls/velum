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
import { webcrypto, createHash } from 'node:crypto';
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
import { firstValueFrom } from 'rxjs';
import { filter, timeout } from 'rxjs/operators';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, submitCallTx, type DeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { nativeToken } from '@midnight-ntwrk/ledger-v8';
import {
  MidnightWalletProvider,
  initializeMidnightProviders,
  getTestEnvironment,
  type EnvironmentConfiguration,
} from '@midnight-ntwrk/testkit-js';

import { Contract, pureCircuits } from '../contracts/src/managed/poap/contract/index.js';
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
// The DUST domain's sync progress never reaches "complete" the way shielded/unshielded do for a
// wallet with no prior registration — see main()'s comment. This wallet-state process is
// unpersisted (fresh WalletFacade per run), so every run has to catch up on the full DUST ledger
// history from genesis, same as shielded's ~7min first-sync on preprod on 2026-08-28; give it a
// much longer ceiling than shielded/unshielded needed rather than fail fast on a real network.
const DUST_BALANCE_TIMEOUT_MS = 30 * 60_000;

// Demo event parameters (TASK-016). This is a LABEL now, not the raw
// on-chain eventId — createEvent derives the real id as
// event_key(organizerPk, label) (see poap.compact, the fix for the
// confirmed event-ID-squatting vulnerability). See derivePk usage below
// for how the real id gets computed for documentation.
const DEMO_EVENT_LABEL = new Uint8Array(32);
DEMO_EVENT_LABEL[0] = 0xde;
DEMO_EVENT_LABEL[1] = 0x01;

// Replicates the contract's derive_pk circuit off-chain:
//   derive_pk(sk) = persistentHash<Vector<2,Bytes<32>>>([pad(32,"adasouls:pk:v1:"), sk])
// persistentHash is plain SHA-256 over the raw concatenated bytes (struct/vector
// fields are concatenated verbatim, no separators — confirmed via direct
// inspection of the ledger source during a security audit of this contract),
// and pad(32, "literal") right-pads the UTF-8 string with zero bytes to 32.
// Needed here (rather than an extra on-chain getCallerPk() call) purely to
// compute the demo event's real eventId for the deployment record below —
// this script has no live devnet/proof-server in the environment that wrote
// it to verify submitCallTx's return-value field name against, so deriving
// it independently from a formula already confirmed correct is the safer
// choice than guessing at an SDK response shape.
function derivePk(secretKey: Uint8Array): Uint8Array {
  const tag = Buffer.alloc(32);
  Buffer.from('adasouls:pk:v1:', 'utf8').copy(tag);
  return new Uint8Array(createHash('sha256').update(Buffer.concat([tag, Buffer.from(secretKey)])).digest());
}

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
    // 127.0.0.1, not localhost: on a host where localhost resolves to ::1 before 127.0.0.1 and the
    // container only publishes the IPv4 mapping (podman rootless slirp4netns/pasta networking,
    // confirmed 2026-09-10 — curl to localhost:6300 got "Recv failure: Connection reset by peer"
    // while 127.0.0.1:6300 worked), the IPv6 attempt fails the connection outright instead of
    // falling back.
    envConfig = { ...testEnv.getEnvironmentConfiguration(), proofServer: 'http://127.0.0.1:6300' };
    logger.info(`Network config: ${JSON.stringify(envConfig)}`);
  }

  logger.info('Building wallet...');
  const wallet = await MidnightWalletProvider.build(logger, envConfig, seedHex);

  // Not using MidnightWalletProvider.start()/testkit-js's waitForFunds() here: both gate on
  // syncWallet()'s requirement that shielded AND unshielded AND dust all reach
  // isStrictlyComplete() before resolving. Confirmed against preprod on 2026-08-28: unshielded
  // completed in ~2s, shielded in ~7min (a real first historical scan), but dust's sync progress
  // never reached complete even after the full 10-minute ceiling, for a wallet that had never
  // registered any NIGHT for DUST generation. Following the verified pattern from
  // midnight-wallet:managing-test-wallets' examples/register-dust.ts instead: sync only far
  // enough to read available NIGHT UTXOs, register any unregistered ones directly (this is
  // self-funding — the fee is paid from the DUST those UTXOs generate, not from a pre-existing
  // DUST balance, so it works even before any DUST exists — see
  // docs.midnight.network/concepts/dust-architecture on retroactive accrual), then poll the DUST
  // *balance* afterward with a tolerant timeout instead of waiting on the dust domain's
  // sync-progress flag, which may simply never complete for a wallet that's never registered.
  await wallet.wallet.start(wallet.zswapSecretKeys, wallet.dustSecretKey);
  logger.info('Waiting for unshielded sync (to read NIGHT UTXOs)...');
  const syncedState = await firstValueFrom(
    wallet.wallet.state().pipe(
      filter((s) => s.unshielded.progress.isStrictlyComplete()),
      timeout(WALLET_SYNC_TIMEOUT_MS),
    ),
  );

  const NIGHT_TOKEN_TYPE = nativeToken().raw;
  const nightBalance = syncedState.unshielded.balances[NIGHT_TOKEN_TYPE] ?? 0n;
  logger.info(`Wallet NIGHT balance: ${nightBalance}`);
  if (nightBalance === 0n) {
    throw new Error(
      `Wallet has no NIGHT — fund it via ${envConfig.faucet ?? "the network's faucet"} and retry.`,
    );
  }

  const unregisteredNight = syncedState.unshielded.availableCoins.filter(
    (coin) => coin.utxo.type === NIGHT_TOKEN_TYPE && coin.meta.registeredForDustGeneration === false,
  );
  if (unregisteredNight.length > 0) {
    logger.info(`Registering ${unregisteredNight.length} NIGHT UTXO(s) for DUST generation...`);
    const recipe = await wallet.wallet.registerNightUtxosForDustGeneration(
      unregisteredNight,
      wallet.unshieldedKeystore.getPublicKey(),
      (payload) => wallet.unshieldedKeystore.signData(payload),
    );
    const finalized = await wallet.wallet.finalizeRecipe(recipe);
    const regTxId = await wallet.wallet.submitTransaction(finalized);
    logger.info(`DUST registration tx submitted: ${regTxId}`);
  } else {
    logger.info('All NIGHT UTXOs already registered for DUST generation.');
  }

  logger.info(`Checking DUST balance (up to ${DUST_BALANCE_TIMEOUT_MS / 60_000}min)...`);
  let dustBalance = 0n;
  try {
    const dustState = await firstValueFrom(
      wallet.wallet.state().pipe(
        filter((s) => s.dust.balance(new Date()) > 0n),
        timeout(DUST_BALANCE_TIMEOUT_MS),
      ),
    );
    dustBalance = dustState.dust.balance(new Date());
  } catch {
    logger.warn(
      `DUST balance still 0 after ${DUST_BALANCE_TIMEOUT_MS / 60_000}min — deploy will likely fail with an insufficient-fee error. ` +
        'Retroactive DUST accrues from each NIGHT UTXO\'s creation time at ~0.00083 DUST/sec per ' +
        'NIGHT (docs.midnight.network/concepts/dust-architecture); if this UTXO is very recently ' +
        'funded, wait longer and retry.',
    );
  }
  logger.info(`DUST balance: ${dustBalance}`);
  logger.info(`Wallet coin public key: ${wallet.getCoinPublicKey()}`);

  // Witnesses must bind the *actual* deploying wallet's secret key — building this from
  // GENESIS_SEED unconditionally (as the original version of this script did) would silently
  // make every deployment's on-chain adminPk/organizer identity derive from the local devnet
  // seed even when deploying with a different funded wallet.
  //
  // The contract's local_sk witness requires exactly Bytes<32> (poap.compact:92) — this is a
  // value private to the contract's own caller_pk()/holder_pk() derivation, unrelated to (and
  // independent of) the wallet-sdk's own key derivation from seedHex. A raw hex seed (GENESIS_SEED,
  // or one generated directly by scripts/wallet-info.ts without a mnemonic) is already 32 bytes,
  // used as-is to keep on-chain identity stable for existing deployments. A BIP-39
  // mnemonic-derived seed (also valid MN_TEST_WALLET_SEED input — see wallet-info.ts) is 64 bytes
  // per the BIP-39 spec (confirmed 2026-08-28: passing one straight through failed with "local_sk
  // return value ... expected value of type Bytes<32> but received <Buffer ...64 bytes...>") — hash
  // it down to 32 bytes instead of erroring.
  const walletSeedBytes = Buffer.from(seedHex, 'hex');
  const secretKey =
    walletSeedBytes.length === 32 ? walletSeedBytes : createHash('sha256').update(walletSeedBytes).digest();
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
      // Fully public demo event — all-zero privateMetadataCommit/privateAttributesRoot
      // means "no private part" / "no attributes committed".
      args: [
        DEMO_EVENT_LABEL,
        100n,
        0n,
        true,
        'ipfs://bafybeih6xhqqfxfyfqgw2xkjxhcxc4kdemoevent/metadata.json',
        new Uint8Array(32),
        new Uint8Array(32),
      ],
    });
    logger.info(`Event created in block ${eventTx.public.blockHeight}, tx: ${eventTx.public.txHash}`);

    // The real on-chain key — NOT DEMO_EVENT_LABEL — see derivePk/comment above.
    const demoEventId = pureCircuits.computeEventId(derivePk(secretKey), DEMO_EVENT_LABEL);
    const demoEventHex = Buffer.from(demoEventId).toString('hex');
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
