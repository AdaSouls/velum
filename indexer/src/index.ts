/**
 * AdaSouls POAP Indexer — main entry point.
 *
 *   npx tsx indexer/src/index.ts
 *
 * Requires a running PostgreSQL instance and the following env vars
 * (or defaults in config.ts apply for local devnet):
 *
 *   CONTRACT_ADDRESS    — deployed contract address
 *   DATABASE_URL        — postgresql://user:pass@host:port/dbname
 *   MIDNIGHT_INDEXER_WS — ws://…/api/v4/graphql/ws  (default: localhost:8088, devnet.yml)
 *   PORT                — REST API port (default: 3001)
 */

import { webcrypto } from 'node:crypto';
import { WebSocket } from 'ws';

// Scala.js / WASM requires webcrypto; Node 22 already exposes it as a non-writable global
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}
// @ts-expect-error Apollo WebSocket shim
globalThis.WebSocket = WebSocket;

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
setNetworkId('undeployed');

import { pool, runMigrations } from './db.js';
import { buildClient } from './client.js';
import { startSubscription } from './subscriptions.js';
import { startApiServer } from './api/index.js';
import { initContractModule } from './parser.js';
import { config } from './config.js';

async function main() {
  console.log('=== AdaSouls POAP Indexer ===');
  console.log(`  contract : ${config.contractAddress}`);
  console.log(`  indexer  : ${config.indexerWs}`);
  console.log(`  db       : ${config.dbUrl.replace(/:\/\/.*@/, '://<hidden>@')}`);
  console.log();

  // Load the compiled contract module (ESM — needed before any parseState() call)
  await initContractModule();

  // Apply DB migrations
  await runMigrations();

  // Start REST API
  startApiServer(pool);

  // Build WS client and begin subscription (reconnects automatically)
  const wsClient = buildClient(config.indexerWs);

  process.on('SIGINT',  () => { console.log('\nshutting down…'); wsClient.dispose(); pool.end(); process.exit(0); });
  process.on('SIGTERM', () => { wsClient.dispose(); pool.end(); process.exit(0); });

  console.log('[main] starting contract subscription…');
  await startSubscription(wsClient, pool, config.contractAddress);
}

main().catch((err) => {
  console.error('[main] fatal:', err);
  process.exit(1);
});
