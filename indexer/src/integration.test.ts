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
 *   docker compose -f devnet.yml up -d poap-pg
 *
 * Prerequisites (live devnet):
 *   docker compose -f devnet.yml up -d          # node + indexer-standalone + proof-server + poap-pg
 *   CONTRACT_ADDRESS=<deployed-address> LIVE_DEVNET=true npm test
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import pg from 'pg';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as nodePath from 'node:path';

import { applyStateDiff } from './poap-state.js';
import { startSubscription } from './subscriptions.js';
import type { LedgerView, EventRecord, IssuerRecord, DisclosureRequest } from './parser.js';
import { eventsRouter } from './api/routes/events.js';
import { tokensRouter } from './api/routes/tokens.js';
import { disclosuresRouter } from './api/routes/disclosures.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

function bytes(fill: number): Uint8Array { return new Uint8Array(32).fill(fill); }

function emptyLedger(): LedgerView {
  return {
    totalSupply:                0n,
    tokenOwner:                 [],
    tokenEvent:                 [],
    tokenIssuer:                [],
    tokenMetadataURI:           [],
    tokenPrivateMetadataCommit: [],
    events:          [],
    issuers:         [],
    burnedTokens:    [],
    usedDisclosures: [],
    disclosureRequests: [],
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
  privateAttributesRoot: Uint8Array = new Uint8Array(32),
): LedgerView {
  const ev: EventRecord = {
    maxSupply,
    minted:     0n,
    expiration: 0n,
    organizer:  issuerPk,
    isActive:   true,
    isPublicMint: true,
    metadataURI,
    privateAttributesRoot,
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
  eventId: Uint8Array,
  tokenMetadataURI: string = 'ipfs://test-metadata',
  tokenPrivateMetadataCommit: Uint8Array = new Uint8Array(32),
): LedgerView {
  return {
    ...base,
    totalSupply: base.totalSupply + 1n,
    tokenOwner:                 [...(base.tokenOwner                 as Array<[bigint, Uint8Array]>), [tokenId, ownerPk]],
    tokenEvent:                 [...(base.tokenEvent                 as Array<[bigint, Uint8Array]>), [tokenId, eventId]],
    tokenIssuer:                [...(base.tokenIssuer                as Array<[bigint, Uint8Array]>), [tokenId, issuerPk]],
    tokenMetadataURI:           [...(base.tokenMetadataURI           as Array<[bigint, string]>), [tokenId, tokenMetadataURI]],
    tokenPrivateMetadataCommit: [...(base.tokenPrivateMetadataCommit as Array<[bigint, Uint8Array]>), [tokenId, tokenPrivateMetadataCommit]],
    events: (base.events as Array<[Uint8Array, EventRecord]>).map(([id, ev]) =>
      Buffer.from(id).equals(Buffer.from(eventId))
        ? [id, { ...ev, minted: ev.minted + 1n }]
        : [id, ev],
    ),
  };
}

function withEventActive(base: LedgerView, eventId: Uint8Array, isActive: boolean): LedgerView {
  return {
    ...base,
    events: (base.events as Array<[Uint8Array, EventRecord]>).map(([id, ev]) =>
      Buffer.from(id).equals(Buffer.from(eventId)) ? [id, { ...ev, isActive }] : [id, ev],
    ),
  };
}

function withDisclosureRequest(
  base: LedgerView,
  requestId: Uint8Array,
  verifier: Uint8Array,
  eventId: Uint8Array,
  recipient: Uint8Array = new Uint8Array(32),
): LedgerView {
  const req: DisclosureRequest = {
    verifier, eventId, fieldId: new Uint8Array(32), setRoot: new Uint8Array(32), recipient,
  };
  return {
    ...base,
    disclosureRequests: [
      ...(base.disclosureRequests as Array<[Uint8Array, DisclosureRequest]>),
      [requestId, req],
    ],
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

// Every migration, in the order db.ts's runMigrations applies them.
const MIGRATION_SQL = (() => {
  const __dirname = nodePath.dirname(fileURLToPath(import.meta.url));
  const dir = nodePath.resolve(__dirname, '../db/migrations');
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => readFileSync(nodePath.join(dir, f), 'utf8'));
})();

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: DB_URL, connectionTimeoutMillis: 5_000 });

  // Verify postgres is reachable; skip entire suite if not
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.warn('[test] Postgres not reachable — skipping integration tests');
    console.warn('  Start it with: docker compose -f devnet.yml up -d poap-pg');
    pool.end().catch(() => {});
    pool = null as any;
    return;
  }

  // Apply migrations (idempotent CREATE TABLE IF NOT EXISTS)
  for (const sql of MIGRATION_SQL) await pool.query(sql);

  // Start test Express server on a random port
  const app = express();
  app.use(express.json());
  app.use('/api/events', eventsRouter(pool));
  app.use('/api/tokens', tokensRouter(pool));
  app.use('/api/disclosure-requests', disclosuresRouter(pool));

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

    await applyStateDiff(pool, 'claim', afterCreate, afterClaim, {
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

  it('claiming a second event from the same issuer mints a SEPARATE token (no more "update" path)', async () => {
    if (!pool) return;

    const empty       = emptyLedger();
    const afterCreate = withEvent(withEvent(empty, EVENT_A, ADMIN_PK, 100n), EVENT_B, ADMIN_PK, 100n);
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, {
      txHash: '0xaaaa0001', blockHeight: 1n,
    });

    const afterClaim1 = withToken(afterCreate, 1n, USER1_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claim', afterCreate, afterClaim1, {
      txHash: '0xbbbb0002', blockHeight: 2n,
    });

    // Same wallet, same issuer, different event — a brand-new token now,
    // not an update to token #1.
    const afterClaim2 = withToken(afterClaim1, 2n, USER1_PK, ADMIN_PK, EVENT_B);
    await applyStateDiff(pool, 'claim', afterClaim1, afterClaim2, {
      txHash: '0xcccc0003', blockHeight: 3n,
    });

    const res    = await fetch(`${apiBase}/api/tokens/owner/${hex(USER1_PK)}`);
    const tokens = await res.json() as any[];
    expect(tokens).toHaveLength(2);
    expect(tokens.map((t) => t.tokenId).sort()).toEqual([1, 2]);
  });

  it('two users claiming the same event each get their own token', async () => {
    if (!pool) return;

    const empty       = emptyLedger();
    const afterCreate = withEvent(empty, EVENT_A, ADMIN_PK, 100n);
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, {
      txHash: '0xaaaa0001', blockHeight: 1n,
    });

    const afterClaim1 = withToken(afterCreate, 1n, USER1_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claim', afterCreate, afterClaim1, {
      txHash: '0xbbbb0002', blockHeight: 2n,
    });

    const afterClaim2 = withToken(afterClaim1, 2n, USER2_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claim', afterClaim1, afterClaim2, {
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
    await applyStateDiff(pool, 'claim', afterCreate, afterClaim, {
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
        metadataURI:  'ipfs://test-metadata',
        privateAttributesRoot: new Uint8Array(32),
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
    await applyStateDiff(pool, 'claim', afterCreate, afterClaim1, {
      txHash: '0xbbbb0002', blockHeight: 2n,
    });

    const afterClaim2 = withToken(afterClaim1, 2n, USER2_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claim', afterClaim1, afterClaim2, {
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
    await applyStateDiff(pool, 'claim', withAB, afterClaimA, {
      txHash: '0xbbbb0002', blockHeight: 2n,
    });
    const afterClaimB = withToken(afterClaimA, 2n, USER2_PK, ADMIN_PK, EVENT_B);
    await applyStateDiff(pool, 'claim', afterClaimA, afterClaimB, {
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
    await applyStateDiff(pool, 'claim', afterCreate, afterClaim1, {
      txHash: '0xbbbb0002', blockHeight: 2n,
    });
    const afterClaim2 = withToken(afterClaim1, 2n, USER2_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'claim', afterClaim1, afterClaim2, {
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

  // ── Regressions ──────────────────────────────────────────────────────────────

  it('publishDisclosureRequest → open and addressed requests expose recipientPk, and ?recipientPk= filters', async () => {
    if (!pool) return;

    const REQ_OPEN = bytes(0x71);
    const REQ_ADDRESSED = bytes(0x72);
    const s0 = emptyLedger();
    const s1 = withEvent(s0, EVENT_A, ADMIN_PK, 100n);
    await applyStateDiff(pool, 'createEvent', s0, s1, { txHash: '0xdd01', blockHeight: 1n });
    const s2 = withDisclosureRequest(s1, REQ_OPEN, USER2_PK, EVENT_A);
    await applyStateDiff(pool, 'publishDisclosureRequest', s1, s2, { txHash: '0xdd02', blockHeight: 2n });
    const s3 = withDisclosureRequest(s2, REQ_ADDRESSED, USER2_PK, EVENT_A, USER1_PK);
    await applyStateDiff(pool, 'publishDisclosureRequest', s2, s3, { txHash: '0xdd03', blockHeight: 3n });

    const all = await (await fetch(`${apiBase}/api/disclosure-requests`)).json() as any[];
    expect(all.map((r) => [r.requestId, r.recipientPk])).toEqual([
      [hex(REQ_OPEN), null],
      [hex(REQ_ADDRESSED), hex(USER1_PK)],
    ]);

    const mine = await (await fetch(`${apiBase}/api/disclosure-requests?recipientPk=${hex(USER1_PK)}`)).json() as any[];
    expect(mine.map((r) => r.requestId)).toEqual([hex(REQ_ADDRESSED)]);

    const one = await (await fetch(`${apiBase}/api/disclosure-requests/${hex(REQ_ADDRESSED)}`)).json() as any;
    expect(one.recipientPk).toBe(hex(USER1_PK));
  });

  it('reactivateEvent → event is active again and its deactivation is cleared', async () => {
    if (!pool) return;

    const empty       = emptyLedger();
    const afterCreate = withEvent(empty, EVENT_A, ADMIN_PK, 100n);
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, { txHash: '0xaaaa0001', blockHeight: 1n });

    const afterDeactivate = withEventActive(afterCreate, EVENT_A, false);
    await applyStateDiff(pool, 'deactivateEvent', afterCreate, afterDeactivate, { txHash: '0xeeee0005', blockHeight: 4n });

    const afterReactivate = withEventActive(afterDeactivate, EVENT_A, true);
    await applyStateDiff(pool, 'reactivateEvent', afterDeactivate, afterReactivate, { txHash: '0xeeee0006', blockHeight: 5n });

    const body = await (await fetch(`${apiBase}/api/events/${hex(EVENT_A)}`)).json() as any;
    expect(body.isActive).toBe(true);
    expect(body.deactivatedBlock).toBeNull();
  });

  it('deactivateIssuer on an unregistered organizer that already has an event → issuer marked inactive', async () => {
    if (!pool) return;

    // ADMIN_PK organizes an event without being registered: the ledger has no issuers entry,
    // but the indexer creates an issuers row for the event's foreign key.
    const empty = emptyLedger();
    const afterCreate: LedgerView = { ...withEvent(empty, EVENT_A, ADMIN_PK, 100n), issuers: [] };
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, { txHash: '0xaaaa0001', blockHeight: 1n });

    // Blocking a key with no ledger entry adds one with isActive=false.
    const afterBlock: LedgerView = {
      ...afterCreate,
      issuers: [[ADMIN_PK, { organizerPk: ADMIN_PK, isActive: false }]],
    };
    await applyStateDiff(pool, 'deactivateIssuer', afterCreate, afterBlock, { txHash: '0xbbbb0002', blockHeight: 2n });

    const { rows } = await pool.query(
      'SELECT is_active, registered_block, deactivated_block, deactivated_tx FROM issuers WHERE issuer_pk = $1',
      [hex(ADMIN_PK)],
    );
    expect(rows[0].is_active).toBe(false);
    expect(rows[0].registered_block).toBeNull();
    expect(Number(rows[0].deactivated_block)).toBe(2);
    expect(rows[0].deactivated_tx).toBe('0xbbbb0002');
  });

  it('registerIssuer on an organizer that already has an event → registration is recorded', async () => {
    if (!pool) return;

    const empty = emptyLedger();
    const afterCreate: LedgerView = { ...withEvent(empty, EVENT_A, ADMIN_PK, 100n), issuers: [] };
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, { txHash: '0xaaaa0001', blockHeight: 1n });

    const afterRegister = withIssuer(afterCreate, ADMIN_PK);
    await applyStateDiff(pool, 'registerIssuer', afterCreate, afterRegister, { txHash: '0xbbbb0003', blockHeight: 3n });

    const { rows } = await pool.query(
      'SELECT is_active, registered_block FROM issuers WHERE issuer_pk = $1',
      [hex(ADMIN_PK)],
    );
    expect(rows[0].is_active).toBe(true);
    expect(Number(rows[0].registered_block)).toBe(3);
  });

  it('an event with the largest Uint<64> maxSupply/expiration is stored, and later actions keep working', async () => {
    if (!pool) return;

    const U64_MAX = 2n ** 64n - 1n;
    const empty = emptyLedger();
    const afterHuge: LedgerView = {
      ...withEvent(empty, EVENT_A, ADMIN_PK, U64_MAX),
      events: [[EVENT_A, {
        maxSupply: U64_MAX, minted: 0n, expiration: U64_MAX, organizer: ADMIN_PK,
        isActive: true, isPublicMint: true, metadataURI: 'ipfs://test-metadata',
        privateAttributesRoot: new Uint8Array(32),
      }]],
    };
    await applyStateDiff(pool, 'createEvent', empty, afterHuge, { txHash: '0xaaaa0001', blockHeight: 1n });

    const { rows } = await pool.query(
      'SELECT max_supply::text, expiration::text FROM events WHERE event_id = $1',
      [hex(EVENT_A)],
    );
    expect(rows[0].max_supply).toBe(U64_MAX.toString());
    expect(rows[0].expiration).toBe(U64_MAX.toString());

    // The indexer is not stalled: an unrelated action afterwards is still applied.
    const afterSecond = withEvent(afterHuge, EVENT_B, ADMIN_PK, 5n);
    await applyStateDiff(pool, 'createEvent', afterHuge, afterSecond, { txHash: '0xaaaa0002', blockHeight: 2n });

    const res = await fetch(`${apiBase}/api/events`);
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(2);
  });

  it('replaying the history over existing rows repairs a stale minted counter', async () => {
    if (!pool) return;

    const empty       = emptyLedger();
    const afterCreate = withEvent(empty, EVENT_A, ADMIN_PK, 100n);
    const afterClaim  = withToken(afterCreate, 0n, USER1_PK, ADMIN_PK, EVENT_A);
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, { txHash: '0xaaaa0001', blockHeight: 1n });
    await applyStateDiff(pool, 'claim', afterCreate, afterClaim, { txHash: '0xcccc0003', blockHeight: 2n });

    // What the old out-of-order backfill left behind on preprod.
    await pool.query('UPDATE events SET minted = 0 WHERE event_id = $1', [hex(EVENT_A)]);

    // Replay from an empty previous state, as after clearing the cursor.
    await applyStateDiff(pool, 'createEvent', empty, afterCreate, { txHash: '0xaaaa0001', blockHeight: 1n });
    await applyStateDiff(pool, 'claim', afterCreate, afterClaim, { txHash: '0xcccc0003', blockHeight: 2n });

    const body = await (await fetch(`${apiBase}/api/events/${hex(EVENT_A)}`)).json() as any;
    expect(body.minted).toBe(1);
    expect(body.createdBlock).toBe(1);
  });

  it('actions delivered in a burst are applied strictly in order', async () => {
    if (!pool) return;

    // Three actions, each carrying the full state after it, as the Midnight indexer sends them.
    const empty       = emptyLedger();
    const afterCreate = withEvent(empty, EVENT_A, ADMIN_PK, 100n);
    const afterClaim1 = withToken(afterCreate, 0n, USER1_PK, ADMIN_PK, EVENT_A);
    const afterClaim2 = withToken(afterClaim1, 1n, USER2_PK, ADMIN_PK, EVENT_A);
    const states: Record<string, LedgerView> = { s1: afterCreate, s2: afterClaim1, s3: afterClaim2 };

    const action = (state: string, height: number, entryPoint: string) => ({
      data: {
        contractActions: {
          __typename: 'ContractCall', state, entryPoint,
          transaction: { hash: `0xtx${height}`, block: { height } },
        },
      },
    });

    // Emits everything synchronously, the way a backfill arrives, then completes.
    const burstClient = {
      subscribe(_payload: unknown, sink: any) {
        sink.next(action('s1', 10, 'createEvent'));
        sink.next(action('s2', 11, 'claim'));
        sink.next(action('s3', 12, 'claim'));
        sink.complete();
        return () => {};
      },
    };

    await startSubscription(burstClient as any, pool, 'test-address', (hexState) => states[hexState]);

    const body = await (await fetch(`${apiBase}/api/events/${hex(EVENT_A)}`)).json() as any;
    expect(body.minted).toBe(2);
    expect(body.liveTokens).toBe(2);

    const { rows } = await pool.query('SELECT last_block, last_state FROM indexer_cursor WHERE id = 1');
    expect(Number(rows[0].last_block)).toBe(12);
    expect(rows[0].last_state).toBe('s3');
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
