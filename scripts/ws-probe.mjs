import { WebSocket } from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from 'graphql-ws';

const client = createClient({
  url: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
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
