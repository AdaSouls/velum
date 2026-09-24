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
 * Outputs the deployed contract address and saves it to deployments/<network>.md and
 * .env.<network>.local — 'undeployed' keeps the original unsuffixed .env.local filename so the
 * existing local workflow doesn't change.
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
import {
  deployContract,
  submitCallTx,
  submitInsertVerifierKeyTx,
  findDeployedContract,
  type DeployedContract,
} from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { nativeToken } from '@midnight-ntwrk/ledger-v8';
import { signingKeyFromBip340 } from '@midnight-ntwrk/compact-runtime';
import {
  MidnightWalletProvider,
  initializeMidnightProviders,
  getTestEnvironment,
  type EnvironmentConfiguration,
} from '@midnight-ntwrk/testkit-js';

import { Contract, pureCircuits } from '../contracts/src/managed/poap/contract/index.js';
import { Contract as ShellContract } from '../contracts/src/managed/poap-shell/contract/index.js';
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
// "Shell" build: same source, same ledger/constructor, but every `export circuit` (proof-
// requiring) demoted to plain `circuit` via `contracts/package.json`'s `compact:shell` script
// (`sed -E 's/^export circuit /circuit /'`) — 0 exported/provable circuits, so it compiles with
// no verifier keys and its own deploy transaction is ~750 bytes. See STAGED DEPLOYMENT below.
const SHELL_ZK_CONFIG_PATH = path.join(CONTRACTS_DIR, 'src', 'managed', 'poap-shell');
// Every circuit requiring a verifier key (contract-info.json's `proof: true` entries) — must be
// registered one at a time onto the shell contract after deploy. Keep in sync with poap.compact's
// `export circuit` declarations; run `cat contracts/src/managed/poap/compiler/contract-info.json
// | jq '.circuits[] | select(.proof) | .name'` to regenerate this list after adding a circuit.
const PROOF_CIRCUIT_IDS = [
  'pause',
  'unpause',
  'registerIssuer',
  'deactivateIssuer',
  'createEvent',
  'deactivateEvent',
  'reactivateEvent',
  'claim',
  'mintTo',
  'burn',
  'revealPrivateMetadata',
  'revealPrivateTokenMetadata',
  'publishDisclosureRequest',
  'proveAttributeMembership',
  'proveAttributeMembershipOnce',
  'proveTokenOwnership',
  'proveEventAttendance',
  'proveCredentialAttribute',
] as const;

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
// Shortened 2026-09-17: confirmed via the preprod wallet UI that a freshly-registered NIGHT
// UTXO's DUST genuinely reads 0 until its first coin individually matures (each coin shows its
// own countdown, "X READY" vs "Y MATURING" — the UI's "Available Balance" figure is the
// cumulative virtual/accruing amount across MATURING coins, not anything spendable yet). So this
// was never a stale-read bug — the loop below only warns and proceeds either way regardless of
// what it finds, and the real signal is whether the deploy transaction itself succeeds, so there
// is no reason to burn 30 minutes here waiting on a balance that legitimately won't be positive
// until a coin matures.
const DUST_BALANCE_TIMEOUT_MS = 20_000;
// ...but only once the DUST domain has actually caught up. Confirmed 2026-09-24 on preprod: the
// balance reads 0 until the dust wallet has replayed the network's FULL dust-ledger event history
// (~1.56M events at the time, ~240 events/s here → ~1.5-2h), and this process keeps no wallet
// state between runs, so every run replays it from scratch. The 20s window above alone made the
// deploy fail with Wallet.InsufficientFunds against a wallet whose 4 NIGHT UTXOs were all
// registered and generating DUST. So: keep polling while the dust sync is still behind, up to this
// hard ceiling (override with DUST_SYNC_TIMEOUT_MIN).
const DUST_SYNC_TIMEOUT_MS = Number(process.env['DUST_SYNC_TIMEOUT_MIN'] ?? 180) * 60_000;
// A positive balance is NOT enough to start transacting. Confirmed 2026-09-24 on preprod: the
// balance turned positive at dust event ~1,502,900 of ~1,557,300, the deploy went out immediately,
// and the node rejected it with "1010: Invalid Transaction: Custom error: 170"
// (InvalidDustSpendProof) — the fee's dust spend was proven against a dust-tree state that far
// behind the chain tip. So the wallet must also be caught up: within this many events of the
// indexer's latest dust ledger event (dustLedgerHead below).
const DUST_CAUGHT_UP_MAX_GAP = 50n;

// Latest dust ledger event id known to the indexer — the target the dust wallet's
// progress.appliedIndex has to reach. The wallet's own progress.highestIndex read 0 throughout a
// full preprod sync (and isStrictlyComplete() never turned true), so it can't be used for this.
// Returns undefined on any failure; the caller then keeps waiting.
async function dustLedgerHead(indexerWS: string): Promise<bigint | undefined> {
  return new Promise((resolve) => {
    const ws = new WebSocket(indexerWS, 'graphql-transport-ws');
    const done = (v: bigint | undefined) => {
      clearTimeout(timer);
      ws.removeAllListeners();
      ws.on('error', () => {});
      ws.close();
      resolve(v);
    };
    const timer = setTimeout(() => done(undefined), 15_000);
    ws.on('error', () => done(undefined));
    ws.on('open', () => ws.send(JSON.stringify({ type: 'connection_init' })));
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'connection_ack') {
        ws.send(JSON.stringify({
          id: '1',
          type: 'subscribe',
          payload: { query: 'subscription { dustLedgerEvents(id: 0) { maxId } }' },
        }));
      } else if (msg.type === 'next') {
        const maxId = msg.payload?.data?.dustLedgerEvents?.maxId;
        done(maxId === undefined ? undefined : BigInt(maxId));
      } else if (msg.type === 'error') {
        done(undefined);
      }
    });
  });
}

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

  logger.info(
    `Checking DUST balance (${DUST_BALANCE_TIMEOUT_MS / 1000}s once dust sync is complete, ` +
      `up to ${DUST_SYNC_TIMEOUT_MS / 60_000}min while it is still catching up)...`,
  );
  // Polled in short-lived snapshots (firstValueFrom(wallet.wallet.state()) grabs the current
  // value and completes immediately) rather than one subscription kept open for the full
  // ceiling — confirmed 2026-09-15 that holding filter()+timeout() open against wallet.state()
  // for ~28min grows heap to 3.5GB+ and crashes with "JavaScript heap out of memory" before the
  // 30min timeout ever fires. Root cause not isolated (RxJS operator retention vs. the SDK's own
  // per-emission state accumulation — see midnight-wallet:sdk-regression-check, no version drift
  // found), but bounding each subscription's lifetime to one snapshot sidesteps it either way.
  const DUST_POLL_INTERVAL_MS = 15_000;
  let dustBalance = 0n;
  const dustPollStart = Date.now();
  for (;;) {
    const snapshot = await firstValueFrom(wallet.wallet.state());
    dustBalance = snapshot.dust.balance(new Date());
    const applied = snapshot.dust.progress.appliedIndex;
    const head = await dustLedgerHead(envConfig.indexerWS);
    const dustSynced =
      snapshot.dust.progress.isStrictlyComplete() || (head !== undefined && applied + DUST_CAUGHT_UP_MAX_GAP >= head);
    const rssMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
    logger.info(
      `  poll: dust=${dustBalance} dustSync=${applied}/${head ?? '?'}` +
        `${dustSynced ? ' (complete)' : ''} rss=${rssMb}MB`,
    );
    const elapsed = Date.now() - dustPollStart;
    if (dustBalance > 0n && dustSynced) break;
    if (dustSynced && elapsed >= DUST_BALANCE_TIMEOUT_MS) break;
    if (elapsed >= DUST_SYNC_TIMEOUT_MS) break;
    await new Promise((resolve) => setTimeout(resolve, DUST_POLL_INTERVAL_MS));
  }
  if (dustBalance === 0n) {
    logger.warn(
      `DUST balance still 0 after ${Math.round((Date.now() - dustPollStart) / 60_000)}min — deploy will likely fail with an insufficient-fee error. ` +
        'Retroactive DUST accrues from each NIGHT UTXO\'s creation time at ~0.00083 DUST/sec per ' +
        'NIGHT (docs.midnight.network/concepts/dust-architecture); if this UTXO is very recently ' +
        'funded, wait longer and retry.',
    );
  } else if (Date.now() - dustPollStart >= DUST_SYNC_TIMEOUT_MS) {
    logger.warn(
      'Hit DUST_SYNC_TIMEOUT_MIN with a positive balance but the dust wallet still behind the ' +
        'indexer — transactions will likely be rejected with InvalidDustSpendProof (170).',
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
  const CompiledPoapShellContract = CompiledContract.make('PoapContractShell', ShellContract).pipe(
    CompiledContract.withWitnesses(createWitnesses(secretKey)),
    CompiledContract.withCompiledFileAssets(SHELL_ZK_CONFIG_PATH),
  );

  const providers = initializeMidnightProviders<PoapCircuits, PoapPrivateState>(wallet, envConfig, {
    privateStateStoreName: 'poap-deploy-state',
    zkConfigPath: ZK_CONFIG_PATH,
  });

  const initialPrivateState: PoapPrivateState = { secretKey, tokens: {} };

  // The contract's on-chain maintenance authority (CMA) key — separate from `secretKey` (the
  // contract's own local_sk witness) by domain-separating the hash input, and deliberately
  // deterministic (derived from the deploying wallet's seed) rather than left for deployContract
  // to sample randomly: a sampled key is stored ONLY in the local `poap-deploy-state` LevelDB
  // store, and it IS the authority that can add the remaining 14 circuits in the staging loop
  // below. Losing that store between the shell deploy and finishing staging would permanently
  // freeze the contract at whatever circuits were inserted so far — recoverable here since the
  // same wallet seed always re-derives the same key.
  const maintenanceSigningKey = signingKeyFromBip340(
    createHash('sha256').update(walletSeedBytes).update('poap-maintenance-authority').digest(),
  );

  try {
    // ── STAGED DEPLOYMENT ──────────────────────────────────────────────────────────────────
    // Deploying all 15 proof-requiring circuits' verifier keys in one transaction (the
    // straightforward `deployContract(providers, { compiledContract: CompiledPoapContract, ... })`
    // this used to be) is rejected by the node with "1010: Invalid Transaction: Transaction would
    // exhaust the block limits" — confirmed 2026-09-17 on both midnight-node 0.22.5 and 1.0.2 (the
    // version preprod runs), so it is not a node-version bug. Measured: the extrinsic is only
    // ~36KB (well under the 768KB block-length limit) — this is a WEIGHT rejection, and it scales
    // linearly at ~2,211 bytes of deploy weight per proof-requiring circuit (each verifier key is
    // exactly 2,119 bytes regardless of the circuit's own complexity — a 10MB prover key's
    // verifier key costs the same as a 3KB one). The last version of this contract that deployed
    // successfully in one transaction (2026-08-05, local devnet) had 9 such circuits; the
    // selective-disclosure feature (commits 9f9cf9e/19a0211/cb0ab50) brought it to 15.
    //
    // Fix: deploy a "shell" build of the same contract (same ledger layout and constructor,
    // verified byte-identical — see contracts/package.json's `compact:shell` script — but every
    // circuit un-exported, so 0 verifier keys and a ~750-byte deploy transaction), then register
    // each of the 15 circuits' verifier keys one at a time via submitInsertVerifierKeyTx
    // (~2.4KB per transaction, independently confirmed against a real ledger simulation). This
    // makes deploy weight O(1) forever — the contract can keep growing without ever hitting this
    // limit again, since maintenance-authority inserts are one-per-transaction by construction.
    //
    // Do NOT call findDeployedContract with the full contract until every circuit is inserted:
    // its verifyContractState check throws ContractTypeError while any operation is missing.
    logger.info('Deploying POAP contract shell (0 circuits, staging verifier keys next)...');
    const deployedShell: DeployedContract<ShellContract> = await deployContract<ShellContract>(providers, {
      compiledContract: CompiledPoapShellContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState,
      signingKey: maintenanceSigningKey,
    });

    const contractAddress = deployedShell.deployTxData.public.contractAddress;
    const deployTxHash = deployedShell.deployTxData.public.txHash;
    logger.info(`Shell deployed! Address: ${contractAddress}, tx: ${deployTxHash}`);

    logger.info(`Staging ${PROOF_CIRCUIT_IDS.length} circuits' verifier keys...`);
    for (const circuitId of PROOF_CIRCUIT_IDS) {
      const currentState = await providers.publicDataProvider.queryContractState(contractAddress);
      if (currentState?.operation(circuitId)) {
        logger.info(`  ${circuitId}: already present, skipping (resumed run)`);
        continue;
      }
      const verifierKey = await providers.zkConfigProvider.getVerifierKey(circuitId);
      await submitInsertVerifierKeyTx(providers, CompiledPoapContract, contractAddress, circuitId, verifierKey);
      logger.info(`  ${circuitId}: inserted`);
    }
    logger.info('All circuits staged.');

    // Confirms every inserted verifier key matches what the full compiled contract expects
    // (verifyContractState) and re-persists maintenanceSigningKey against the full contract's
    // handle, in case more circuits need staging in a future run.
    await findDeployedContract<Contract>(providers, {
      compiledContract: CompiledPoapContract,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState,
      signingKey: maintenanceSigningKey,
    });

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

    // 'undeployed' keeps the original unsuffixed .env filename so the existing local workflow and
    // anything a developer has already scripted around it don't change.
    const deploymentMdName = `${targetNetwork}.md`;
    const envFileName = targetNetwork === 'undeployed' ? '.env.local' : `.env.${targetNetwork}.local`;

    const deploymentsDir = path.join(CONTRACTS_DIR, '..', 'deployments');
    fs.mkdirSync(deploymentsDir, { recursive: true });
    fs.writeFileSync(path.join(deploymentsDir, deploymentMdName), deploymentMd);
    logger.info(`Saved to deployments/${deploymentMdName}`);

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
