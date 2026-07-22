/**
 * TASK-018: Midnight Indexer GraphQL WebSocket client.
 *
 * Uses graphql-ws (graphql-transport-ws protocol) with exponential back-off
 * reconnect: 1 s → 2 s → 4 s → 8 s → 16 s → 30 s (cap).
 */

import { createClient, type Client } from 'graphql-ws';
import { WebSocket } from 'ws';

const BACKOFF_SEQUENCE = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

export function buildClient(wsUrl: string): Client {
  let attempt = 0;

  return createClient({
    url: wsUrl,
    webSocketImpl: WebSocket,
    shouldRetry: () => true,
    retryAttempts: Infinity,
    retryWait: async () => {
      const delay = BACKOFF_SEQUENCE[Math.min(attempt, BACKOFF_SEQUENCE.length - 1)];
      attempt++;
      await new Promise((r) => setTimeout(r, delay));
    },
    on: {
      connected: () => {
        console.log('[gql-ws] connected');
        attempt = 0; // reset backoff on successful connection
      },
      error: (err) => console.warn('[gql-ws] error:', err),
      closed: () => console.warn('[gql-ws] connection closed'),
    },
  });
}
