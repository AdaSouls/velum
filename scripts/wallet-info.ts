/**
 * Derive (or generate) a deployer wallet for a given Midnight network, so it can be funded via
 * that network's faucet *before* running scripts/deploy.ts — and, since 2026-08-28, so it can
 * also be imported into a wallet extension (Lace) via a standard 24-word BIP-39 phrase, not just
 * a raw hex seed.
 *
 * Uses the same testkit-js network selection as deploy.ts (MN_TEST_ENVIRONMENT) and the same
 * getEnvironmentConfiguration()-without-start() approach — see deploy.ts's module doc comment for
 * why (.start()'s built-in health check has a hardcoded 1000ms-per-endpoint timeout that's
 * tighter than preprod's real latency and fails even when the endpoints are healthy). Deriving a
 * wallet address from a seed/mnemonic is a local, offline operation — no proof server or network
 * reachability is required to run this script. It never submits a transaction.
 *
 * The mnemonic → master-seed derivation here (@scure/bip39's mnemonicToSeedSync) is the same call
 * testkit-js's own WalletSeeds.fromMnemonic() makes internally, and the shielded/unshielded/dust
 * key derivation from that master seed goes through @midnight-ntwrk/wallet-sdk's Roles-based
 * deriveKeyForRole() — the same production wallet-sdk package, not a testkit-only helper. That's
 * why a mnemonic generated here should also work if imported into Lace: both are expected to sit
 * on the same wallet-sdk derivation. Not independently verified against an actual Lace import as
 * of this writing — confirm by importing and checking the address matches before trusting it for
 * anything beyond this deployer role.
 *
 *   MN_TEST_ENVIRONMENT=preprod npx tsx scripts/wallet-info.ts
 *     → generates a random 24-word mnemonic, prints it plus the derived hex seed and the address
 *       to fund. Save the mnemonic (import it into Lace if you want to see/manage it there) — pass
 *       the hex seed as MN_TEST_WALLET_SEED to deploy.ts (or re-run this script with
 *       MN_TEST_WALLET_MNEMONIC set to confirm the same address after funding).
 *
 *   MN_TEST_ENVIRONMENT=preprod MN_TEST_WALLET_MNEMONIC="word1 word2 ... word24" npx tsx scripts/wallet-info.ts
 *     → re-derives the address (and the hex seed to use as MN_TEST_WALLET_SEED) from an existing
 *       24-word phrase — e.g. one already imported into Lace — instead of generating a new one.
 *
 *   MN_TEST_ENVIRONMENT=preprod MN_TEST_WALLET_SEED=<hex> npx tsx scripts/wallet-info.ts
 *     → reuses an existing raw hex seed (no mnemonic) and prints its address again. This is what
 *       deploy.ts itself takes; a wallet built this way has no associated 24-word phrase — it was
 *       never derived from one — so it isn't importable into a wallet extension by phrase.
 *
 * 'undeployed' isn't supported here — its genesis wallet is already funded and its seed is the
 * GENESIS_SEED constant documented in deploy.ts, nothing to derive.
 */

import { webcrypto } from 'node:crypto';
import { WebSocket } from 'ws';

if (!globalThis.crypto) {
  // @ts-expect-error needed for Scala.js / WASM crypto on Node <19
  globalThis.crypto = webcrypto;
}
// @ts-expect-error needed for Apollo WebSocket (GraphQL subscriptions) in Node.js
globalThis.WebSocket = WebSocket;

import pino from 'pino';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { MidnightWalletProvider, getTestEnvironment } from '@midnight-ntwrk/testkit-js';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

async function main() {
  const targetNetwork = (process.env.MN_TEST_ENVIRONMENT || 'undeployed').toLowerCase();
  if (targetNetwork === 'undeployed') {
    throw new Error(
      "wallet-info.ts is for remote networks (preprod/preview/qanet/env-var-remote). " +
        "'undeployed' already has a funded genesis wallet — see GENESIS_SEED in deploy.ts.",
    );
  }

  // getTestEnvironment() reads MN_TEST_ENVIRONMENT, picks the matching RemoteTestEnvironment
  // subclass, and calls setNetworkId() as a side effect. The proofServer override doesn't
  // actually matter for this script (build() below never contacts it), but keeps envConfig
  // consistent with what deploy.ts would use for the same network.
  const testEnv = getTestEnvironment(logger);
  const envConfig = { ...testEnv.getEnvironmentConfiguration(), proofServer: 'http://localhost:6300' };

  let seedHex = process.env.MN_TEST_WALLET_SEED;
  let mnemonic = process.env.MN_TEST_WALLET_MNEMONIC;

  if (!seedHex) {
    // No raw seed given — derive (or generate) from a 24-word BIP-39 mnemonic instead, so the
    // result is importable into a wallet extension, not just usable as MN_TEST_WALLET_SEED here.
    if (!mnemonic) {
      mnemonic = generateMnemonic(wordlist, 256); // 256 bits of entropy -> 24 words
      logger.info('Generated a new 24-word mnemonic (write this down, it is a secret):');
      logger.info(mnemonic);
    }
    seedHex = Buffer.from(mnemonicToSeedSync(mnemonic)).toString('hex');
  }

  const wallet = await MidnightWalletProvider.build(logger, envConfig, seedHex);

  const unshieldedAddress = wallet.unshieldedKeystore.getBech32Address().asString();
  logger.info(`Network: ${targetNetwork}`);
  if (mnemonic) {
    logger.info(`Derived hex seed (pass this as MN_TEST_WALLET_SEED to deploy.ts): ${seedHex}`);
  }
  logger.info(`Coin public key (shielded): ${wallet.getCoinPublicKey()}`);
  logger.info(`Unshielded address (fund this one — NIGHT/DUST are unshielded): ${unshieldedAddress}`);
  logger.info(
    envConfig.faucet
      ? `Faucet: ${envConfig.faucet} (or use the network's browser faucet UI if this API needs a captcha)`
      : `No faucet URL known for '${targetNetwork}' — check https://docs.midnight.network/guides/networks-and-environments`,
  );
  logger.info(
    'Once funded, re-run scripts/deploy.ts with the same MN_TEST_ENVIRONMENT and ' +
      'MN_TEST_WALLET_SEED (the hex seed printed above) to deploy against this wallet.',
  );

  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'Failed to derive wallet info');
  process.exit(1);
});
