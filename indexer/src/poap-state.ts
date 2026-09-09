/**
 * TASK-020: POAP state handlers.
 *
 * Each handler receives a diff between the previous and current ledger state and
 * writes the relevant rows to PostgreSQL.  All operations are idempotent (ON CONFLICT).
 */

import type { Pool, PoolClient } from 'pg';
import {
  type LedgerView,
  type EventRecord,
  type IssuerRecord,
  type DisclosureRequest,
  snapshotMap,
  diffMap,
  diffSet,
  toHex,
  bigintKey,
  issuerEquals,
  eventEquals,
  disclosureRequestEquals,
} from './parser.js';

export type TxMeta = { txHash: string; blockHeight: bigint };

export async function applyStateDiff(
  db: Pool,
  operation: string,
  prev: LedgerView,
  curr: LedgerView,
  meta: TxMeta,
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await handleIssuers(client, prev, curr, meta);
    await handleEvents(client, prev, curr, meta);
    await handleTokens(client, prev, curr, meta);
    await handleDisclosures(client, prev, curr, meta);
    await handleDisclosureRequests(client, prev, curr, meta);
    await client.query('COMMIT');
    console.log(`[state] ${operation} @ block ${meta.blockHeight} tx ${meta.txHash.slice(0, 16)}…`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Issuers ────────────────────────────────────────────────────────────────────

async function handleIssuers(
  client: PoolClient,
  prev: LedgerView,
  curr: LedgerView,
  meta: TxMeta,
): Promise<void> {
  const prevSnap = snapshotMap(prev.issuers, (bytes) => toHex(bytes));
  const currSnap = snapshotMap(curr.issuers, (bytes) => toHex(bytes));
  const diff = diffMap(prevSnap, currSnap, issuerEquals);

  for (const { k, v } of diff.added) {
    await client.query(
      `INSERT INTO issuers (issuer_pk, is_active, registered_block, registered_tx)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (issuer_pk) DO NOTHING`,
      [toHex(k), v.isActive, meta.blockHeight.toString(), meta.txHash],
    );
    console.log(`  [+] issuer ${toHex(k).slice(0, 16)}… registered`);
  }

  for (const { k, curr: v } of diff.updated) {
    if (!v.isActive) {
      await client.query(
        `UPDATE issuers SET is_active = FALSE, deactivated_block = $1, deactivated_tx = $2
         WHERE issuer_pk = $3`,
        [meta.blockHeight.toString(), meta.txHash, toHex(k)],
      );
      console.log(`  [-] issuer ${toHex(k).slice(0, 16)}… deactivated`);
    } else {
      await client.query(
        `UPDATE issuers SET is_active = TRUE WHERE issuer_pk = $1`,
        [toHex(k)],
      );
    }
  }
}

// ── Events ─────────────────────────────────────────────────────────────────────

async function handleEvents(
  client: PoolClient,
  prev: LedgerView,
  curr: LedgerView,
  meta: TxMeta,
): Promise<void> {
  const prevSnap = snapshotMap(prev.events, (bytes) => toHex(bytes));
  const currSnap = snapshotMap(curr.events, (bytes) => toHex(bytes));
  const diff = diffMap(prevSnap, currSnap, eventEquals);

  for (const { k, v } of diff.added) {
    const issuerHex = toHex(v.organizer);
    // Ensure issuer row exists (admin events use adminPk as organizer)
    await client.query(
      `INSERT INTO issuers (issuer_pk, is_active) VALUES ($1, TRUE) ON CONFLICT DO NOTHING`,
      [issuerHex],
    );
    await client.query(
      `INSERT INTO events
         (event_id, issuer_pk, max_supply, expiration, is_active, is_public_mint, metadata_uri, minted,
          private_attributes_root, created_block, created_tx)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        toHex(k),
        issuerHex,
        v.maxSupply.toString(),
        v.expiration.toString(),
        v.isActive,
        v.isPublicMint,
        v.metadataURI,
        v.minted.toString(),
        toHex(v.privateAttributesRoot),
        meta.blockHeight.toString(),
        meta.txHash,
      ],
    );
    console.log(`  [+] event ${toHex(k).slice(0, 16)}… created`);
  }

  for (const { k, curr: v } of diff.updated) {
    if (!v.isActive) {
      await client.query(
        `UPDATE events SET minted = $1, is_active = FALSE, deactivated_block = $2, deactivated_tx = $3
         WHERE event_id = $4`,
        [v.minted.toString(), meta.blockHeight.toString(), meta.txHash, toHex(k)],
      );
      console.log(`  [-] event ${toHex(k).slice(0, 16)}… deactivated`);
    } else {
      await client.query(
        `UPDATE events SET minted = $1 WHERE event_id = $2`,
        [v.minted.toString(), toHex(k)],
      );
    }
  }
}

// ── Tokens ─────────────────────────────────────────────────────────────────────

async function handleTokens(
  client: PoolClient,
  prev: LedgerView,
  curr: LedgerView,
  meta: TxMeta,
): Promise<void> {
  // Detect mints: new entries in tokenOwner
  const prevOwners = snapshotMap(prev.tokenOwner, (id) => bigintKey(id));
  const currOwners = snapshotMap(curr.tokenOwner, (id) => bigintKey(id));

  for (const { k: tokenId, v: ownerPk } of
    diffMap(prevOwners, currOwners, (a, b) => toHex(a) === toHex(b)).added) {
    const issuerPk = toHex(getFromIter(curr.tokenIssuer, tokenId));
    const eventId = toHex(getFromIter(curr.tokenEvent, tokenId));
    const tokenMetadataURI = getFromIter(curr.tokenMetadataURI, tokenId);
    const tokenPrivateMetadataCommit = toHex(getFromIter(curr.tokenPrivateMetadataCommit, tokenId));

    // Ensure issuer + event rows exist (may lag in same block)
    await client.query(
      `INSERT INTO issuers (issuer_pk, is_active) VALUES ($1, TRUE) ON CONFLICT DO NOTHING`,
      [issuerPk],
    );
    await client.query(
      `INSERT INTO events (event_id, issuer_pk, max_supply, expiration, is_active, is_public_mint, minted)
       VALUES ($1, $2, 0, 0, TRUE, TRUE, 0)
       ON CONFLICT DO NOTHING`,
      [eventId, issuerPk],
    );
    await client.query(
      `INSERT INTO tokens
         (token_id, owner_pk, issuer_pk, first_event_id, token_metadata_uri, token_private_metadata_commit,
          is_burned, minted_block, minted_tx)
       VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7,$8)
       ON CONFLICT (token_id) DO NOTHING`,
      [
        tokenId.toString(),
        toHex(ownerPk),
        issuerPk,
        eventId,
        tokenMetadataURI,
        tokenPrivateMetadataCommit,
        meta.blockHeight.toString(),
        meta.txHash,
      ],
    );
    console.log(`  [+] token #${tokenId} minted → owner ${toHex(ownerPk).slice(0, 16)}…`);
  }

  // Detect burns: new entries in burnedTokens
  const prevBurned = snapshotMap(prev.burnedTokens, (id) => bigintKey(id));
  const currBurned = snapshotMap(curr.burnedTokens, (id) => bigintKey(id));

  for (const { k: tokenId } of
    diffMap(prevBurned, currBurned, (a, b) => a === b).added) {
    await client.query(
      `UPDATE tokens SET is_burned = TRUE, burned_block = $1, burned_tx = $2
       WHERE token_id = $3`,
      [meta.blockHeight.toString(), meta.txHash, tokenId.toString()],
    );
    console.log(`  [-] token #${tokenId} burned`);
  }
}

// ── Selective Disclosure ─────────────────────────────────────────────────────────
//
// Only tracks proveAttributeMembershipOnce redemptions (the nullifier-guarded,
// single-use variant). The stateless proveAttributeMembership — the one
// most "answer a question" flows should use — never mutates usedDisclosures
// (or any other ledger map), so it produces no diff and this handler never
// sees it. That's intentional: this table can only ever record that SOME
// disclosure was redeemed against a nullifier, never who, which event, or
// which attribute — the app layer learns nothing beyond what the contract
// itself discloses.

async function handleDisclosures(
  client: PoolClient,
  prev: LedgerView,
  curr: LedgerView,
  meta: TxMeta,
): Promise<void> {
  // usedDisclosures is a Set<Bytes<32>> on-chain (was Map<_,Boolean>) —
  // diffSet, not snapshotMap/diffMap, since a Set iterates single values.
  const diff = diffSet(prev.usedDisclosures, curr.usedDisclosures);

  for (const n of diff.added) {
    await client.query(
      `INSERT INTO disclosure_nullifiers (nullifier, spent_block, spent_tx)
       VALUES ($1, $2, $3)
       ON CONFLICT (nullifier) DO NOTHING`,
      [toHex(n), meta.blockHeight.toString(), meta.txHash],
    );
    console.log(`  [+] disclosure nullifier ${toHex(n).slice(0, 16)}… spent`);
  }
}

// ── Disclosure Requests ───────────────────────────────────────────────────────────
//
// Requests are immutable once published (the contract asserts !member(rid)
// before insert), so only "added" is meaningful here — an "updated" pair
// would indicate a bug elsewhere, not a legitimate state transition.

async function handleDisclosureRequests(
  client: PoolClient,
  prev: LedgerView,
  curr: LedgerView,
  meta: TxMeta,
): Promise<void> {
  const prevSnap = snapshotMap(prev.disclosureRequests, (bytes) => toHex(bytes));
  const currSnap = snapshotMap(curr.disclosureRequests, (bytes) => toHex(bytes));
  const diff = diffMap(prevSnap, currSnap, disclosureRequestEquals);

  for (const { k, v } of diff.added) {
    await client.query(
      `INSERT INTO disclosure_requests
         (request_id, verifier_pk, event_id, field_id, set_root, published_block, published_tx)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (request_id) DO NOTHING`,
      [
        toHex(k),
        toHex(v.verifier),
        toHex(v.eventId),
        toHex(v.fieldId),
        toHex(v.setRoot),
        meta.blockHeight.toString(),
        meta.txHash,
      ],
    );
    console.log(`  [+] disclosure request ${toHex(k).slice(0, 16)}… published`);
  }
}

// ── Util ───────────────────────────────────────────────────────────────────────

function getFromIter<V>(iter: Iterable<[bigint, V]>, target: bigint): V {
  for (const [k, v] of iter) {
    if (k === target) return v;
  }
  throw new Error(`key ${target} not found in iterable`);
}
