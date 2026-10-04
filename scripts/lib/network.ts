/**
 * Network, wallet and key setup shared by deploy.ts and upgrade.ts.
 *
 * Moved out of deploy.ts — see its module doc comment for the network-selection rules
 * (MN_TEST_ENVIRONMENT / MN_TEST_WALLET_SEED) and prerequisites, which apply to both scripts.
 *
 * Wallet sync progress is saved to .wallet-state/ (gitignored, 0600 — it's wallet data) while
 * syncing and restored on the next run, so only the first run pays for a full sync (~1.5-2h of
 * DUST history on preprod); later runs only catch up on what's new. Delete the file to force a
 * full sync.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
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

import type { Logger } from 'pino';
import { firstValueFrom } from 'rxjs';
import { filter, timeout } from 'rxjs/operators';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { nativeToken } from '@midnight-ntwrk/ledger-v8';
import { signingKeyFromBip340 } from '@midnight-ntwrk/compact-runtime';
import {
  MidnightWalletProvider,
  FluentWalletBuilder,
  WalletSeeds,
  DEFAULT_DUST_OPTIONS,
  getTestEnvironment,
  type EnvironmentConfiguration,
} from '@midnight-ntwrk/testkit-js';
import {
  ShieldedWallet,
  UnshieldedWallet,
  DustWallet,
  WalletFacade,
  InMemoryTransactionHistoryStorage,
  WalletEntrySchema,
  mergeWalletEntries,
  createKeystore,
} from '@midnight-ntwrk/wallet-sdk';
import { ZswapSecretKeys, DustSecretKey } from '@midnight-ntwrk/midnight-js-protocol/ledger';

// Genesis wallet seed — the `dev` chain spec (devnet.yml's CFG_PRESET: 'dev') pre-mints NIGHT
// to the wallet derived from this seed. Only valid on 'undeployed' (local devnet); every other
// network requires a real funded seed via MN_TEST_WALLET_SEED — see module doc comment above.
const GENESIS_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
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

// Matches devnet.yml's exposed ports (new-generation SDK devnet: node 0.22.5 /
// indexer-standalone 4.2.1 / proof-server 8.1.0, since bumped — see devnet.yml — per the official compatibility matrix
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

export function resolveNetwork(
  targetNetwork: string,
  logger: Logger,
): { envConfig: EnvironmentConfiguration; seedHex: string } {
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
  return { envConfig, seedHex };
}

// Builds the wallet for seedHex, registers its NIGHT for DUST if needed and waits until it can pay
// fees. The caller owns the returned wallet and must stop() it.
const WALLET_STATE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.wallet-state');
const WALLET_STATE_SAVE_INTERVAL_MS = 5 * 60_000;

type SavedWalletState = { v: 1; shielded: string; unshielded: string; dust: string };

// testkit's default overhead is 0, which leaves a transaction whose computed fee is 0 with no DUST
// spend at all — the node rejects that as NotNormalized ("1010: Invalid Transaction: Custom
// error: 117"). Seen on preprod 2026-10-01 on a maintenance remove-verifier-key transaction.
// A small fixed overhead (0.3 DUST, the value the official templates use) always pays something.
const DUST_OPTIONS = { ...DEFAULT_DUST_OPTIONS, additionalFeeOverhead: 300_000_000_000_000n };

// One file per network and seed; the name carries a hash of the seed, never the seed itself.
function walletStatePath(envConfig: EnvironmentConfiguration, seedHex: string): string {
  const seedId = createHash('sha256').update(seedHex).digest('hex').slice(0, 16);
  return path.join(WALLET_STATE_DIR, `${envConfig.networkId}-${seedId}.json.gz`);
}

// Best effort: a failed save is logged and the sync carries on — losing a checkpoint is cheaper
// than losing the run.
async function saveWalletState(logger: Logger, wallet: MidnightWalletProvider, file: string): Promise<void> {
  try {
    const [shielded, unshielded, dust] = await Promise.all([
      wallet.wallet.shielded.serializeState(),
      wallet.wallet.unshielded.serializeState(),
      wallet.wallet.dust.serializeState(),
    ]);
    const state: SavedWalletState = { v: 1, shielded, unshielded, dust };
    fs.mkdirSync(WALLET_STATE_DIR, { recursive: true, mode: 0o700 });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, gzipSync(JSON.stringify(state)), { mode: 0o600 });
    fs.renameSync(tmp, file);
    const mb = (fs.statSync(file).size / (1024 * 1024)).toFixed(1);
    logger.info(`Saved wallet sync state to ${path.relative(process.cwd(), file)} (${mb}MB)`);
  } catch (err) {
    logger.warn(`Couldn't save wallet sync state (${(err as Error).message}) — continuing without it.`);
  }
}

// Same wallet buildWallet's fresh path creates (testkit's FluentWalletBuilder/WalletFactory), but
// each sub-wallet restored from its saved state instead of started from scratch.
async function restoreWallet(
  logger: Logger,
  envConfig: EnvironmentConfiguration,
  seedHex: string,
  saved: SavedWalletState,
): Promise<MidnightWalletProvider> {
  // testkit doesn't export its env → wallet-config mapping; the builder holds the result.
  const config = (FluentWalletBuilder.forEnvironment(envConfig) as unknown as { config: any }).config;
  const seeds = WalletSeeds.fromMasterSeed(seedHex);
  const keystore = createKeystore(seeds.unshielded, envConfig.walletNetworkId as any);
  const dustConfig = {
    ...config,
    costParameters: {
      ledgerParams: DUST_OPTIONS.ledgerParams,
      additionalFeeOverhead: DUST_OPTIONS.additionalFeeOverhead,
      feeBlocksMargin: DUST_OPTIONS.feeBlocksMargin,
    },
  };
  const facade = await WalletFacade.init({
    configuration: config,
    shielded: () => ShieldedWallet(config).restore(saved.shielded),
    unshielded: () =>
      UnshieldedWallet({
        ...config,
        txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
      }).restore(saved.unshielded),
    dust: () => DustWallet(dustConfig).restore(saved.dust),
  });
  return MidnightWalletProvider.withWallet(
    logger,
    envConfig,
    facade,
    ZswapSecretKeys.fromSeed(seeds.shielded),
    DustSecretKey.fromSeed(seeds.dust),
    keystore,
  );
}

async function buildWallet(
  logger: Logger,
  envConfig: EnvironmentConfiguration,
  seedHex: string,
  stateFile: string,
): Promise<MidnightWalletProvider> {
  if (fs.existsSync(stateFile)) {
    try {
      const saved = JSON.parse(gunzipSync(fs.readFileSync(stateFile)).toString('utf8')) as SavedWalletState;
      if (saved.v !== 1) throw new Error(`unknown state version ${saved.v}`);
      const wallet = await restoreWallet(logger, envConfig, seedHex, saved);
      logger.info(`Restored wallet sync state from ${path.relative(process.cwd(), stateFile)}`);
      return wallet;
    } catch (err) {
      logger.warn(`Couldn't restore ${stateFile} (${(err as Error).message}) — doing a full sync instead.`);
    }
  }
  // Not MidnightWalletProvider.build: it takes no dust options, and it logs the seed.
  const { wallet, seeds, keystore } = await FluentWalletBuilder.forEnvironment(envConfig)
    .withSeed(seedHex)
    .withDustOptions(DUST_OPTIONS)
    .buildWithoutStarting();
  return MidnightWalletProvider.withWallet(
    logger,
    envConfig,
    wallet,
    ZswapSecretKeys.fromSeed(seeds.shielded),
    DustSecretKey.fromSeed(seeds.dust),
    keystore,
  );
}

export async function startFundedWallet(
  logger: Logger,
  envConfig: EnvironmentConfiguration,
  seedHex: string,
): Promise<MidnightWalletProvider> {
  logger.info('Building wallet...');
  const stateFile = walletStatePath(envConfig, seedHex);
  const wallet = await buildWallet(logger, envConfig, seedHex, stateFile);

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
  let lastSave = Date.now();
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
    // Saved as it goes, so a crashed or interrupted sync isn't lost either.
    if (Date.now() - lastSave >= WALLET_STATE_SAVE_INTERVAL_MS) {
      await saveWalletState(logger, wallet, stateFile);
      lastSave = Date.now();
    }
    await new Promise((resolve) => setTimeout(resolve, DUST_POLL_INTERVAL_MS));
  }
  await saveWalletState(logger, wallet, stateFile);
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
  return wallet;
}

export function contractSecretKey(seedHex: string): Buffer {
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
  return secretKey;
}

export function deriveMaintenanceSigningKey(seedHex: string) {
  const walletSeedBytes = Buffer.from(seedHex, 'hex');
  // The contract's on-chain maintenance authority (CMA) key — separate from `secretKey` (the
  // contract's own local_sk witness) by domain-separating the hash input, and deliberately
  // deterministic (derived from the deploying wallet's seed) rather than left for deployContract
  // to sample randomly: a sampled key is stored ONLY in the local `poap-deploy-state` LevelDB
  // store, and it IS the authority that stages deploy.ts's circuits and signs every later
  // upgrade.ts swap. Losing that store between the shell deploy and finishing staging would permanently
  // freeze the contract at whatever circuits were inserted so far — recoverable here since the
  // same wallet seed always re-derives the same key.
  return signingKeyFromBip340(
    createHash('sha256').update(walletSeedBytes).update('poap-maintenance-authority').digest(),
  );
}
