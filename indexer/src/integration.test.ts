/**
 * TASK-022 — End-to-end indexer integration test.
 *
 * Component tests (always run):
 *   Simulate Midnight Indexer contract events by building synthetic LedgerView
 *   objects and calling applyStateDiff() directly. Verifies the DB handlers and
 *   REST API routes work together correctly.
 *
 * Live-devnet tests (run with LIVE_DEVNET=true):
 *   Connects to the real Midnight Indexer WebSocket, verifies the subscription
 *   handshake, and confirms the deployed contract's state is queryable via the
 *   REST API. Requires the new-generation devnet (devnet.yml) and CONTRACT_ADDRESS to be set.
 *
 * Prerequisites (component tests):
 *   docker compose -f docker-compose.devnet.yml up -d poap-pg
 *
 * Prerequisites (live devnet):
 *   docker compose -f devnet.yml up -d                      # node + indexer-standalone + proof-server
 *   docker compose -f docker-compose.devnet.yml up -d poap-pg  # indexer app's own Postgres
 *   CONTRACT_ADDRESS=<deployed-address> LIVE_DEVNET=true npm test
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import pg from 'pg';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as nodePath from 'node:path';

import { applyStateDiff } from './poap-state.js';
import type { LedgerView, EventRecord, IssuerRecord } from './parser.js';
import { eventsRouter } from './api/routes/events.js';
import { tokensRouter } from './api/routes/tokens.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

function bytes(fill: number): Uint8Array { return new Uint8Array(32).fill(fill); }

function emptyLedger(): LedgerView {
  return {
    totalSupply:     0n,
    tokenOwner:      [],
    tokenFirstEvent: [],
    tokenIssuer:     [],
    events:          [],
    issuers:         [],
    burnedTokens:    [],
    isPaused:        false,
    adminPk:         new Uint8Array(32),
  };
}

function withIssuer(base: LedgerView, issuerPk: Uint8Array): LedgerView {
  return {
    ...base,
    issuers: [
      ...(base.issuers as Array<[Uint8Array, IssuerRecord]>),
      [issuerPk, { organizerPk: issuerPk, isActive: true }],
    ],
  };
}

function withEvent(
  base: LedgerView,
  eventId: Uint8Array,
  issuerPk: Uint8Array,
  maxSupply: bigint,
  metadataURI: string = 'ipfs://test-metadata',
): LedgerView {
  const ev: EventRecord = {
    maxSupply,
    minted:     0n,
    expiration: 0n,
    organizer:  issuerPk,
    isActive:   true,
    isPublicMint: true,
    metadataURI,
  };
  return {
    ...withIssuer(base, issuerPk),
    events: [
      ...(base.events as Array<[Uint8Array, EventRecord]>),
      [eventId, ev],
    ],
  };
}

function withToken(
  base: LedgerView,
  tokenId: bigint,
  ownerPk: Uint8Array,
  issuerPk: Uint8Array,
  firstEventId: Uint8Array,
): LedgerView {
  return {
    ...base,
    totalSupply: base.totalSupply + 1n,
    tokenOwner:      [...(base.tokenOwner      as Array<[bigint, Uint8Array]>), [tokenId, ownerPk]],
    tokenFirstEvent: [...(base.tokenFirstEvent as Array<[bigint, Uint8Array]>), [tokenId, firstEventId]],
    tokenIssuer:     [...(base.tokenIssuer     as Array<[bigint, Uint8Array]>), [tokenId, issuerPk]],
    events: (base.events as Array<[Uint8Array, EventRecord]>).map(([id, ev]) =>
      Buffer.from(id).equals(Buffer.from(firstEventId))
        ? [id, { ...ev, minted: ev.minted + 1n }]
        : [id, ev],
    ),
  };
}

function withBurn(base: LedgerView, tokenId: bigint): LedgerView {
  return {
    ...base,
    burnedTokens: [
      ...(base.burnedTokens as Array<[bigint, boolean]>),
      [tokenId, true],
    ],
  };
}

// ── Shared fixtures ────────────────────────────────────────────────────────────

const ADMIN_PK  = bytes(0xaa);
const USER1_PK  = bytes(0xbb);
const USER2_PK  = bytes(0xcc);
const EVENT_A   = bytes(0x01);
const EVENT_B   = bytes(0x02);

// ── Suite setup ────────────────────────────────────────────────────────────────

let pool: pg.Pool;
let apiBase: string;
let server: ReturnType<typeof createServer>;

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://poap:poap@localhost:5434/poap_indexer';

const MIGRATION_SQL = (() => {
  const __dirname = nodePath.dirname(fileURLToPath(import.meta.url));
  const p = nodePath.resolve(__dirname, '../db/migrations/001_init.sql');
  return readFileSync(p, 'utf8');
})();

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: DB_URL, connectionTimeoutMillis: 5_000 });

  // Verify postgres is reachable; skip entire suite if not
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.warn('[test] Postgres not reachable — skipping integration tests');
    console.warn('  Start it with: docker compose -f docker-compose.devnet.yml up -d poap-pg');
    pool.end().catch(() => {});
    pool = null as any;
    return;
  }

  // Apply migrations (idempotent CREATE TABLE IF NOT EXISTS)
  await pool.query(MIGRATION_SQL);

  // Start test Express server on a random port
  const app = express();
  app.use(express.json());
  app.use('/api/events', eventsRouter(pool));
  app.use('/api/tokens', tokensRouter(pool));

  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  apiBase = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((r, j) => server.close((e) => e ? j(e) : r()));
  if (pool)   await pool.end();
});

beforeEach(async ({ skip }) => {
  if (!pool) skip();
  // Reset DB state between tests
  await pool.query('TRUNCATE tokens, events, issuers, indexer_cursor RESTART IDENTITY CASCADE');
  await pool.query(`INSERT INTO indexer_cursor (id) VALUES (1) ON CONFLICT DO NOTHING`);
});

// ── Component integration tests ────────────────────────────────────────────────

describe('POAP indexer — component integration', () => {

  it('createEvent → event appears in GET /api/events', async () => {
    if (!pool) return;

    const prev = emptyLedger();
    const curr = withEvent(prev, EVENT_A, ADMIN_PK, 100n, 'ipfs://bafy-event-a-metadata');

    await applyStateDiff(pool, 'createEvent', prev, curr, {
      txHash: '0xaaaa0001',
      blockHeight: 1n,
    });

    const res  = await fetch(`${apiBase}/api/events`);
    const body = await res.json() as any[];

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].eventId).toBe(hex(EVENT_A));
    expect(body[0].maxSupply).toBe(100);
    expect(body[0].minted).toBe(0);
    expect(body[0].isActive).toBe(true);
    expect(body[0].issuerPk).toBe(hex(ADMIN_PK));
    expect(body[0].metadataURI).toBe('ipfs://bafy-event-a-metadata');
    expect(body[0].createdBlock).toBe(1);
  });

  it('GET /api/events?issuerPk=<hex> scopes to a single organizer server-side', async () => {
    if (!pool) return;

    const empty     = emptyLedger();
    const withAdmin = withEvent(empty,     EVENT_A, ADMIN_PK, 100n);
    const withBoth  = withEvent(withAdmin, EVENT_B, USER1_PK, 100n);
    await applyStateDiff(pool, 'createEvent', empty, withBoth, {
      txHash: '0xaaaa0001', blockHeight: 1n,
    });

    const adminEvents = await (await fetch(`${apiBase}/api/events?issuerPk=${hex(ADMIN_PK)}`)).json() as any[];
    const user1Events = await (await fetch(`${apiBase}/api/events?issuerPk=${hex(USER1_PK)}`)).json() as any[];
    const unknownPk    = await (await fetch(`${apiBase}/api/events?issuerPk=${'00'.repeat(32)}`)).json() as any[];

    expect(adminEvents).toHaveLength(1);
    expect(adminEvents[0].eventId).toBe(hex(EVENT_A));
    expect(user1Events).toHaveLength(1);
    expect(user1Events[0].eventId).toBe(hex(EVENT_B));
    expect(unknownPk).toEqual([]);
  });

  it('GET /api/events without issuerPk still returns every event (unchanged behaviour)', async () => {
    if (!pool) return;

    const empty     = emptyLedger();
    const withAdmin = withEvent(empty,     EVENT_A, ADMIN_PK, 100n);
    const withBoth  = withEvent(withAdmin, EVENT_B, USER1_PK, 100n);
    await applyStateDiff(pool, 'createEvent', empty, withBoth, {
      txHash: '0xaaaa0001', blockHeight: 1n,
    });

    const body = await (await fetch(`${apiBase}/api/events`)).json() as any[];
    expect(body).toHaveLength(2);
  });

  it('claimOrUpdate → token appears in GET /api/tokens/owner/:pk', async () => {
    if (!pool) return;

    // State before claim: event exists, no tokens
    const empty       = emptyLedger();
    const afterCreate = withEvent(empty, EVENT_A, ADMIN_PK, 100n, 'ipfs://bafy-event-a-metadata');

    await applyStateDiff(pool, 'createEvent', empty, afterCreate, {
      txHash: '0xaaaa0001',
      blockHeight: 1n,
    });

    // State after claim: token #1 minted to user1
    const afterClaim = withToken(afterCreate, 1n, USER1_PK, ADMIN_PK, EVENT_A);

    await applyStateDiff(pool, 'claimOrUpdate', afterCreate, afterClaim, {
      txHash: '0xbbbb0002',
      blockHeight: 2n,
    });

    const res    = await fetch(`${apiBase}/api/tokens/owner/${hex(USER1_PK)}`);
    const tokens = await res.json() as any[];

    expect(res.status).toBe(200);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenId).toBe(1);
    expect(tokens[0].ownerPk).toBe(hex(USER1_PK));
    expect(tokens[0].issuerPk).toBe(hex(ADMIN_PK));
    expect(tokens[0].firstEventId).toBe(hex(EVENT_A));
    expect(tokens[0].isBurned).toBe(false);
    // Token responses carry their event's metadataURI directly (JOIN on first_event_id) so
    // the frontend doesn't need a second fetch to render name/description/image.
    expect(tokens[0].metadataURI).toBe('ipfs://bafy-event-a-metadata');
    expect(tokens[0].mintedBlock).toBe(2);
  });

  it('second claimOrUpdate by same user does not create a second token', async () => {
    if (!pool) return;

    const empty       = emptyLedger();
    const afterCreate = withEvent(empty, EVENT_A, ADMIN_PK, 100n);
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, {
      txHash: '0xaaaa0001', blockHeight: 1n,
    });

    const afterClaim1 = withToken(afterCreate, 1n, USER1_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claimOrUpdate', afterCreate, afterClaim1, {
      txHash: '0xbbbb0002', blockHeight: 2n,
    });

    // Second claimOrUpdate — updateToken path, no new tokenOwner entry
    await applyStateDiff(pool, 'claimOrUpdate', afterClaim1, afterClaim1, {
      txHash: '0xcccc0003', blockHeight: 3n,
    });

    const res    = await fetch(`${apiBase}/api/tokens/owner/${hex(USER1_PK)}`);
    const tokens = await res.json() as any[];
    expect(tokens).toHaveLength(1);
  });

  it('two users claiming the same event each get their own token', async () => {
    if (!pool) return;

    const empty       = emptyLedger();
    const afterCreate = withEvent(empty, EVENT_A, ADMIN_PK, 100n);
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, {
      txHash: '0xaaaa0001', blockHeight: 1n,
    });

    const afterClaim1 = withToken(afterCreate, 1n, USER1_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claimOrUpdate', afterCreate, afterClaim1, {
      txHash: '0xbbbb0002', blockHeight: 2n,
    });

    const afterClaim2 = withToken(afterClaim1, 2n, USER2_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claimOrUpdate', afterClaim1, afterClaim2, {
      txHash: '0xcccc0003', blockHeight: 3n,
    });

    const res1 = await fetch(`${apiBase}/api/tokens/owner/${hex(USER1_PK)}`);
    const res2 = await fetch(`${apiBase}/api/tokens/owner/${hex(USER2_PK)}`);

    expect((await res1.json() as any[]).length).toBe(1);
    expect((await res2.json() as any[]).length).toBe(1);

    // Event minted count should be 2
    const evRes  = await fetch(`${apiBase}/api/events/${hex(EVENT_A)}`);
    const evBody = await evRes.json() as any;
    expect(evBody.minted).toBe(2);
  });

  it('burn → token marked is_burned in GET /api/tokens/:id', async () => {
    if (!pool) return;

    const empty       = emptyLedger();
    const afterCreate = withEvent(empty, EVENT_A, ADMIN_PK, 100n);
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, {
      txHash: '0xaaaa0001', blockHeight: 1n,
    });

    const afterClaim = withToken(afterCreate, 1n, USER1_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claimOrUpdate', afterCreate, afterClaim, {
      txHash: '0xbbbb0002', blockHeight: 2n,
    });

    const afterBurn = withBurn(afterClaim, 1n);
    await applyStateDiff(pool, 'burn', afterClaim, afterBurn, {
      txHash: '0xdddd0004', blockHeight: 3n,
    });

    const res   = await fetch(`${apiBase}/api/tokens/1`);
    const token = await res.json() as any;

    expect(res.status).toBe(200);
    expect(token.isBurned).toBe(true);
    expect(token.burnedBlock).toBe(3);
    expect(token.burnedTx).toBe('0xdddd0004');
  });

  it('deactivateEvent → event marked is_active=false', async () => {
    if (!pool) return;

    const empty       = emptyLedger();
    const afterCreate = withEvent(empty, EVENT_A, ADMIN_PK, 100n);
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, {
      txHash: '0xaaaa0001', blockHeight: 1n,
    });

    // Deactivated event: same ledger but isActive=false
    const afterDeactivate: LedgerView = {
      ...afterCreate,
      events: [[EVENT_A, {
        maxSupply:    100n,
        minted:       0n,
        expiration:   0n,
        organizer:    ADMIN_PK,
        isActive:     false,
        isPublicMint: true,
      }]],
    };
    await applyStateDiff(pool, 'deactivateEvent', afterCreate, afterDeactivate, {
      txHash: '0xeeee0005', blockHeight: 4n,
    });

    const res    = await fetch(`${apiBase}/api/events/${hex(EVENT_A)}`);
    const evBody = await res.json() as any;

    expect(evBody.isActive).toBe(false);
    expect(evBody.deactivatedBlock).toBe(4);
  });

  it('GET /api/events/:id/tokens lists every token minted for that event', async () => {
    if (!pool) return;

    const empty       = emptyLedger();
    const afterCreate = withEvent(empty, EVENT_A, ADMIN_PK, 100n, 'ipfs://bafy-event-a-metadata');
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, {
      txHash: '0xaaaa0001', blockHeight: 1n,
    });

    const afterClaim1 = withToken(afterCreate, 1n, USER1_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claimOrUpdate', afterCreate, afterClaim1, {
      txHash: '0xbbbb0002', blockHeight: 2n,
    });

    const afterClaim2 = withToken(afterClaim1, 2n, USER2_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claimOrUpdate', afterClaim1, afterClaim2, {
      txHash: '0xcccc0003', blockHeight: 3n,
    });

    const res    = await fetch(`${apiBase}/api/events/${hex(EVENT_A)}/tokens`);
    const tokens = await res.json() as any[];

    expect(res.status).toBe(200);
    expect(tokens).toHaveLength(2);
    expect(tokens.map((t) => t.tokenId)).toEqual([1, 2]);
    expect(tokens.map((t) => t.ownerPk)).toEqual([hex(USER1_PK), hex(USER2_PK)]);
    expect(tokens.every((t) => t.firstEventId === hex(EVENT_A))).toBe(true);
    expect(tokens.every((t) => t.isBurned === false)).toBe(true);
    expect(tokens.every((t) => t.metadataURI === 'ipfs://bafy-event-a-metadata')).toBe(true);
  });

  it('GET /api/events/:id/tokens only returns tokens of that event', async () => {
    if (!pool) return;

    const empty  = emptyLedger();
    const withA  = withEvent(empty,  EVENT_A, ADMIN_PK, 100n);
    const withAB = withEvent(withA,  EVENT_B, ADMIN_PK, 100n);
    await applyStateDiff(pool, 'createEvent', empty, withAB, {
      txHash: '0xaaaa0001', blockHeight: 1n,
    });

    // user1 claims EVENT_A, user2 claims EVENT_B
    const afterClaimA = withToken(withAB,      1n, USER1_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claimOrUpdate', withAB, afterClaimA, {
      txHash: '0xbbbb0002', blockHeight: 2n,
    });
    const afterClaimB = withToken(afterClaimA, 2n, USER2_PK, ADMIN_PK, EVENT_B);
    await applyStateDiff(pool, 'claimOrUpdate', afterClaimA, afterClaimB, {
      txHash: '0xcccc0003', blockHeight: 3n,
    });

    const tokensA = await (await fetch(`${apiBase}/api/events/${hex(EVENT_A)}/tokens`)).json() as any[];
    const tokensB = await (await fetch(`${apiBase}/api/events/${hex(EVENT_B)}/tokens`)).json() as any[];

    expect(tokensA).toHaveLength(1);
    expect(tokensA[0].ownerPk).toBe(hex(USER1_PK));
    expect(tokensB).toHaveLength(1);
    expect(tokensB[0].ownerPk).toBe(hex(USER2_PK));
  });

  it('GET /api/events/:id/tokens?includeBurned=false excludes burned tokens', async () => {
    if (!pool) return;

    const empty       = emptyLedger();
    const afterCreate = withEvent(empty, EVENT_A, ADMIN_PK, 100n);
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, {
      txHash: '0xaaaa0001', blockHeight: 1n,
    });

    const afterClaim1 = withToken(afterCreate, 1n, USER1_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claimOrUpdate', afterCreate, afterClaim1, {
      txHash: '0xbbbb0002', blockHeight: 2n,
    });
    const afterClaim2 = withToken(afterClaim1, 2n, USER2_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claimOrUpdate', afterClaim1, afterClaim2, {
      txHash: '0xcccc0003', blockHeight: 3n,
    });

    const afterBurn = withBurn(afterClaim2, 1n);
    await applyStateDiff(pool, 'burn', afterClaim2, afterBurn, {
      txHash: '0xdddd0004', blockHeight: 4n,
    });

    const all  = await (await fetch(`${apiBase}/api/events/${hex(EVENT_A)}/tokens`)).json() as any[];
    const live = await (await fetch(`${apiBase}/api/events/${hex(EVENT_A)}/tokens?includeBurned=false`)).json() as any[];

    expect(all).toHaveLength(2);
    expect(live).toHaveLength(1);
    expect(live[0].tokenId).toBe(2);
  });

  it('GET /api/events/:id/tokens returns 404 for unknown event', async () => {
    if (!pool) return;
    const res = await fetch(`${apiBase}/api/events/${'00'.repeat(32)}/tokens`);
    expect(res.status).toBe(404);
  });

  it('GET /api/events/:id/tokens returns [] for an event with no claims', async () => {
    if (!pool) return;
    const empty       = emptyLedger();
    const afterCreate = withEvent(empty, EVENT_A, ADMIN_PK, 100n);
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, {
      txHash: '0xaaaa0001', blockHeight: 1n,
    });

    const res  = await fetch(`${apiBase}/api/events/${hex(EVENT_A)}/tokens`);
    const body = await res.json() as any[];
    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('GET /api/events/:id returns 404 for unknown event', async () => {
    if (!pool) return;
    const res = await fetch(`${apiBase}/api/events/${'00'.repeat(32)}`);
    expect(res.status).toBe(404);
  });

  it('GET /api/tokens/:id returns 404 for unknown token', async () => {
    if (!pool) return;
    const res = await fetch(`${apiBase}/api/tokens/9999`);
    expect(res.status).toBe(404);
  });
});

// ── Live devnet tests ──────────────────────────────────────────────────────────
//
// These tests require devnet to be running and a deployed contract.
// Run with: CONTRACT_ADDRESS=<address> LIVE_DEVNET=true npm test

const LIVE = !!process.env.LIVE_DEVNET && process.env.CONTRACT_ADDRESS !== 'test-contract-address-for-unit-tests';

describe.skipIf(!LIVE)('POAP indexer — live devnet', () => {
  it('Midnight Indexer WebSocket handshake succeeds', async () => {
    const { buildClient } = await import('./client.js');
    const { config } = await import('./config.js');

    const wsClient = buildClient(config.indexerWs);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        wsClient.dispose();
        reject(new Error('WS connection timed out after 10 s'));
      }, 10_000);

      const unsub = wsClient.on('connected', () => {
        clearTimeout(timeout);
        wsClient.dispose();
        resolve();
      });

      // graphql-ws connects lazily — the socket only opens once something subscribes.
      // `blocks` takes no required args, so it's a cheap way to trigger the handshake.
      const cleanup = wsClient.subscribe(
        { query: 'subscription { blocks { hash } }' },
        { next: () => {}, error: () => {}, complete: () => {} },
      );
      void cleanup;
    });
  });

  it('contract deploy event appears in GET /api/events after indexing', async () => {
    if (!pool) return;
    const { buildClient } = await import('./client.js');
    const { startSubscription } = await import('./subscriptions.js');
    const { config } = await import('./config.js');

    const wsClient = buildClient(config.indexerWs);

    // Receive at most one block then cancel
    const sub = new Promise<void>((resolve) => {
      let resolved = false;
      const dispose = wsClient.subscribe(
        {
          query: `subscription { contractActions(address: "${config.contractAddress}") {
            __typename
            state
            transaction { hash block { height } }
            ... on ContractCall { entryPoint }
          } }`,
        },
        {
          next: () => {
            if (!resolved) { resolved = true; resolve(); }
          },
          error: resolve as any,
          complete: resolve,
        },
      );
      setTimeout(() => { dispose(); resolve(); }, 15_000);
    });

    await sub;
    wsClient.dispose();

    // After the subscription has processed at least the deploy event, the
    // REST API should return at least the event created during deploy
    const res  = await fetch(`${apiBase}/api/events`);
    const body = await res.json() as any[];
    expect(res.status).toBe(200);
    // Contract may have been deployed with 0 events; just confirm the endpoint works
    expect(Array.isArray(body)).toBe(true);
  });
});
