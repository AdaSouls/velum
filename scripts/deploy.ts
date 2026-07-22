/**
 * TASK-015: Deploy the POAP contract to Midnight devnet.
 *
 * Run from the midnight-examples monorepo so all package versions match compactc 0.10.6:
 *
 *   cd /Users/<user>/Projects/midnight-network/midnight-examples-0.1.12
 *   npx tsx /Users/<user>/Projects/poap-midnight/scripts/deploy.ts
 *
 * Outputs the deployed contract address and saves it to docs/deployment.md.
 */

import path from 'node:path';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

// @ts-expect-error needed for Scala.js / WASM crypto
globalThis.crypto = webcrypto;
// @ts-expect-error needed for Apollo WebSocket
globalThis.WebSocket = WebSocket;

import {
  networkId,
  setNetworkId,
  toLedgerNetworkId,
  toRuntimeNetworkId,
  toZswapNetworkId,
} from '@midnight-ntwrk/midnight-js-network-id';
import * as zswap from '@midnight-ntwrk/zswap';
import * as runtime from '@midnight-ntwrk/compact-runtime';
import * as ledger from '@midnight-ntwrk/ledger';
import { nativeToken } from '@midnight-ntwrk/ledger';
import { type CoinInfo, Transaction } from '@midnight-ntwrk/ledger';
import { encodeCoinPublicKey } from '@midnight-ntwrk/compact-runtime';
import { deployContract, withZswapWitnesses } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import {
  type BalancedTransaction,
  createBalancedTx,
  type UnbalancedTransaction,
} from '@midnight-ntwrk/midnight-js-types';
import { type TransactionId } from '@midnight-ntwrk/ledger';
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { Transaction as ZswapTransaction } from '@midnight-ntwrk/zswap';
import * as Rx from 'rxjs';

// ── Contract import ───────────────────────────────────────────────────────────
// Using createRequire because the compiled .cjs is CommonJS
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Contract } = require('/Users/<user>/Projects/poap-midnight/contracts/src/managed/poap/contract/index.cjs');

// ── Config ────────────────────────────────────────────────────────────────────

const POAP_DIR = '/Users/<user>/Projects/poap-midnight';
const ZK_CONFIG_PATH = path.join(POAP_DIR, 'contracts/src/managed/poap');

// Genesis wallet seed — funded in the genesis block of any local devnet
const GENESIS_SEED = '0000000000000000000000000000000000000000000000000000000000000042';

// Demo event parameters (TASK-016)
const DEMO_EVENT_ID = new Uint8Array(32);
DEMO_EVENT_ID[0] = 0xde;
DEMO_EVENT_ID[1] = 0x01;

const INDEXER_HTTP  = 'http://127.0.0.1:8090/api/v1/graphql';
const INDEXER_WS    = 'ws://127.0.0.1:8090/api/v1/graphql/ws';
const NODE_URL      = 'http://127.0.0.1:9944';
const PROOF_SERVER  = 'http://127.0.0.1:6300';

// Set undeployed network (local devnet)
const net = networkId.undeployed;
setNetworkId(net);
zswap.setNetworkId(toZswapNetworkId(net));
runtime.setNetworkId(toRuntimeNetworkId(net));
ledger.setNetworkId(toLedgerNetworkId(net));

// ── Private state ─────────────────────────────────────────────────────────────

type TokenRecord = { tokenId: bigint; attendance: { eventIds: Uint8Array[]; isSoulbound: boolean } };

type PoapPrivateState = {
  secretKey: Uint8Array;
  // issuerId (hex) → token for that issuer
  tokens: Record<string, TokenRecord>;
};

type PrivateStates = { poapPrivateState: PoapPrivateState };

function issuerKey(issuerId: Uint8Array): string {
  return Buffer.from(issuerId).toString('hex');
}

// ── Witnesses ─────────────────────────────────────────────────────────────────

function makeWitnesses(secretKey: Uint8Array) {
  return {
    local_sk: (ctx: any) => [ctx.privateState, secretKey],

    get_my_token_for_issuer: (ctx: any, issuerId: Uint8Array) => {
      const token = (ctx.privateState as PoapPrivateState).tokens[issuerKey(issuerId)];
      return [ctx.privateState, token ? { is_some: true, value: token.tokenId } : { is_some: false, value: 0n }];
    },

    store_token: (ctx: any, tokenId: bigint, issuerId: Uint8Array, eventId: Uint8Array, isSoulbound: boolean) => {
      const key = issuerKey(issuerId);
      const next: PoapPrivateState = {
        ...ctx.privateState,
        tokens: {
          ...(ctx.privateState as PoapPrivateState).tokens,
          [key]: { tokenId, attendance: { eventIds: [eventId], isSoulbound } },
        },
      };
      return [next, undefined];
    },

    store_attendance: (ctx: any, _tokenId: bigint, issuerId: Uint8Array, eventId: Uint8Array) => {
      const key = issuerKey(issuerId);
      const ps = ctx.privateState as PoapPrivateState;
      const existing = ps.tokens[key];
      if (!existing) return [ps, undefined];
      const next: PoapPrivateState = {
        ...ps,
        tokens: {
          ...ps.tokens,
          [key]: {
            ...existing,
            attendance: { ...existing.attendance, eventIds: [...existing.attendance.eventIds, eventId] },
          },
        },
      };
      return [next, undefined];
    },

    has_attended: (ctx: any, issuerId: Uint8Array, eventId: Uint8Array) => {
      const key = issuerKey(issuerId);
      const ps = ctx.privateState as PoapPrivateState;
      const token = ps.tokens[key];
      if (!token) return [ps, false];
      const attended = token.attendance.eventIds.some(
        (id: Uint8Array) => id.length === eventId.length && id.every((b: number, i: number) => b === eventId[i]),
      );
      return [ps, attended];
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== AdaSouls POAP Contract Deployment ===\n');

  // 1. Build wallet from genesis seed
  console.log('Building wallet from genesis seed...');
  const wallet = await WalletBuilder.buildFromSeed(
    INDEXER_HTTP,
    INDEXER_WS,
    PROOF_SERVER,
    NODE_URL,
    GENESIS_SEED,
    'warn',
  );
  wallet.start();

  const state0 = await Rx.firstValueFrom(wallet.state());
  console.log(`Wallet address: ${state0.address}`);

  // Wait for sync and funded balance
  console.log('Waiting for wallet sync and funds...');
  const balance = await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.tap((s) => {
        const synced = s.syncProgress?.synced ?? 0n;
        const total  = s.syncProgress?.total ?? 1n;
        process.stdout.write(`  Synced ${synced}/${total} blocks, balance=${s.balances[nativeToken()] ?? 0n}\r`);
      }),
      Rx.filter((s) => {
        const synced = s.syncProgress?.synced ?? 0n;
        const total  = s.syncProgress?.total ?? 1_000n;
        return total - synced < 100n;
      }),
      Rx.map((s) => s.balances[nativeToken()] ?? 0n),
      Rx.filter((b) => b > 0n),
    ),
  );
  console.log(`\nBalance: ${balance} tDUST`);

  // 2. Set up providers
  const walletState = await Rx.firstValueFrom(wallet.state());
  const walletAndProvider = {
    coinPublicKey: walletState.coinPublicKey,
    balanceTx(tx: UnbalancedTransaction, newCoins: CoinInfo[]): Promise<BalancedTransaction> {
      return wallet
        .balanceTransaction(ZswapTransaction.deserialize(tx.tx.serialize()), newCoins)
        .then((tx) => wallet.proveTransaction(tx))
        .then((zswapTx) => Transaction.deserialize(zswapTx.serialize()))
        .then(createBalancedTx);
    },
    submitTx(tx: BalancedTransaction): Promise<TransactionId> {
      return wallet.submitTransaction(tx.tx);
    },
  };

  const providers = {
    privateStateProvider: levelPrivateStateProvider<PrivateStates>({
      privateStateStoreName: 'poap-deploy-state',
    }),
    publicDataProvider: indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS),
    zkConfigProvider: new NodeZkConfigProvider<
      'pause' | 'unpause' | 'registerIssuer' | 'deactivateIssuer' |
      'createEvent' | 'deactivateEvent' | 'claimOrUpdate' | 'burn' | 'getCallerPk'
    >(ZK_CONFIG_PATH),
    proofProvider: httpClientProofProvider(PROOF_SERVER),
    walletProvider: walletAndProvider,
    midnightProvider: walletAndProvider,
  };

  // 3. Deploy contract
  console.log('\nDeploying POAP contract...');
  const privateState: PoapPrivateState = { secretKey: Buffer.from(GENESIS_SEED, 'hex'), tokens: {} };
  const contractInstance = new Contract(
    withZswapWitnesses(makeWitnesses(privateState.secretKey))(
      encodeCoinPublicKey(walletState.coinPublicKey),
    ),
  );

  const deployed = await deployContract(
    providers,
    'poapPrivateState',
    privateState,
    contractInstance,
  );

  const contractAddress = deployed.finalizedDeployTxData.contractAddress;
  const deployTxHash = deployed.finalizedDeployTxData.txHash;
  console.log(`\nContract deployed!`);
  console.log(`  Address:  ${contractAddress}`);
  console.log(`  Tx hash:  ${deployTxHash}`);

  // 4. Create demo event (TASK-016)
  console.log('\nCreating demo event...');
  const { txHash: eventTxHash, blockHeight } = await deployed.contractCircuitsInterface.createEvent(
    DEMO_EVENT_ID,
    100n,        // maxSupply
    0n,          // expiration (0 = no expiration)
    true,        // isPublicMint
  );
  console.log(`  Event created in block ${blockHeight}, tx: ${eventTxHash}`);

  // 5. Save deployment info
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
| Create Tx Hash | \`${eventTxHash}\` |
| Block Height | ${blockHeight} |
`;

  fs.writeFileSync(path.join(POAP_DIR, 'docs/deployment.md'), deploymentMd);
  console.log('\nSaved to docs/deployment.md');

  const envContent = `MIDNIGHT_NODE_URL=ws://localhost:9944
MIDNIGHT_INDEXER_URL=http://localhost:8090/api/v1/graphql
MIDNIGHT_INDEXER_WS=ws://localhost:8090/api/v1/graphql/ws
MIDNIGHT_PROOF_SERVER_URL=http://localhost:6300
CONTRACT_ADDRESS=${contractAddress}
DEMO_EVENT_ID=${demoEventHex}
ADMIN_SEED=${GENESIS_SEED}
`;
  fs.writeFileSync(path.join(POAP_DIR, '.env.local'), envContent);
  console.log('Saved to .env.local');

  console.log('\n=== Deployment complete ===');
  wallet.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
