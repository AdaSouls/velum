import { WebSocket } from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from 'graphql-ws';

// Midnight's public preprod indexer was decommissioned on 2026-10-09; Blockfrost serves it now.
const projectId = process.env.BLOCKFROST_PROJECT_ID ?? '';
if (!projectId.startsWith('nightpreprod')) {
  console.error('Set BLOCKFROST_PROJECT_ID to a Midnight Preprod project id from blockfrost.io (starts with "nightpreprod").');
  process.exit(1);
}

const client = createClient({
  url: `wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=${projectId}`,
  shouldRetry: () => false,
  keepAlive: 15_000,
  on: {
    connected: () => console.log(new Date().toISOString(), 'CONNECTED'),
    closed: (event) => console.log(new Date().toISOString(), 'CLOSED', event?.code, event?.reason),
    error: (err) => console.log(new Date().toISOString(), 'ERROR', err?.message ?? err),
  },
});

const dispose = client.subscribe(
  { query: 'subscription { blocks { hash height timestamp } }' },
  {
    next: (data) => console.log(new Date().toISOString(), 'DATA', JSON.stringify(data).slice(0, 200)),
    error: (err) => console.log(new Date().toISOString(), 'SUB ERROR', err),
    complete: () => console.log(new Date().toISOString(), 'SUB COMPLETE'),
  },
);

setTimeout(() => {
  console.log(new Date().toISOString(), 'timeout reached, exiting');
  process.exit(0);
}, 120_000);
