/**
 * AdaSouls POAP Indexer — main entry point.
 *
 * Run from the midnight-examples monorepo so compact-runtime resolves correctly:
 *
 *   cd /Users/<user>/Projects/midnight-network/midnight-examples-0.1.12
 *   npm install pg express          # once, if not already present
 *   npx tsx /Users/<user>/Projects/poap-midnight/indexer/src/index.ts
 *
 * Requires a running PostgreSQL instance and the following env vars
 * (or defaults in config.ts apply for local devnet):
 *
 *   CONTRACT_ADDRESS   — deployed contract address
 *   DATABASE_URL       — postgresql://user:pass@host:port/dbname
 *   MIDNIGHT_INDEXER_WS — ws://…/api/v1/graphql/ws  (default: localhost:8090)
 *   PORT               — REST API port (default: 3001)
 */

import { webcrypto } from 'node:crypto';
import { WebSocket } from 'ws';

// Scala.js / WASM requires webcrypto; Node 22 already exposes it as a non-writable global
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}
// @ts-expect-error Apollo WebSocket shim
globalThis.WebSocket = WebSocket;

import { setNetworkId, networkId } from '@midnight-ntwrk/midnight-js-network-id';
setNetworkId(networkId.undeployed);

import { pool, runMigrations } from './db.js';
import { buildClient } from './client.js';
import { startSubscription } from './subscriptions.js';
import { startApiServer } from './api/index.js';
import { config } from './config.js';

async function main() {
  console.log('=== AdaSouls POAP Indexer ===');
  console.log(`  contract : ${config.contractAddress}`);
  console.log(`  indexer  : ${config.indexerWs}`);
  console.log(`  db       : ${config.dbUrl.replace(/:\/\/.*@/, '://<hidden>@')}`);
  console.log();

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
