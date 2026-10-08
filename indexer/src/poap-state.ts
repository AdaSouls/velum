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
    await handleCredentialRequests(client, prev, curr, meta);
    await handleCredentialUpdateRequests(client, prev, curr, meta);
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

  // A new ledger entry is either a registration (active) or a block of a key that was never
  // registered (inactive — see deactivateIssuer in poap.compact). Either way the row may already
  // exist: handleEvents/handleTokens insert one for every organizer, registered or not. So this
  // has to update that row, not skip it.
  for (const { k, v } of diff.added) {
    if (v.isActive) {
      await client.query(
        `INSERT INTO issuers (issuer_pk, is_active, registered_block, registered_tx)
         VALUES ($1, TRUE, $2, $3)
         ON CONFLICT (issuer_pk) DO UPDATE
           SET is_active        = TRUE,
               registered_block = COALESCE(issuers.registered_block, EXCLUDED.registered_block),
               registered_tx    = COALESCE(issuers.registered_tx, EXCLUDED.registered_tx)`,
        [toHex(k), meta.blockHeight.toString(), meta.txHash],
      );
      console.log(`  [+] issuer ${toHex(k).slice(0, 16)}… registered`);
    } else {
      await client.query(
        `INSERT INTO issuers (issuer_pk, is_active, deactivated_block, deactivated_tx)
         VALUES ($1, FALSE, $2, $3)
         ON CONFLICT (issuer_pk) DO UPDATE
           SET is_active         = FALSE,
               deactivated_block = COALESCE(issuers.deactivated_block, EXCLUDED.deactivated_block),
               deactivated_tx    = COALESCE(issuers.deactivated_tx, EXCLUDED.deactivated_tx)`,
        [toHex(k), meta.blockHeight.toString(), meta.txHash],
      );
      console.log(`  [-] issuer ${toHex(k).slice(0, 16)}… deactivated`);
    }
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

  for (const { k, prev: before, curr: v } of diff.updated) {
    if (!v.isActive) {
      await client.query(
        `UPDATE events SET minted = $1, is_active = FALSE, deactivated_block = $2, deactivated_tx = $3
         WHERE event_id = $4`,
        [v.minted.toString(), meta.blockHeight.toString(), meta.txHash, toHex(k)],
      );
      console.log(`  [-] event ${toHex(k).slice(0, 16)}… deactivated`);
    } else {
      // Active covers both an ordinary mint and reactivateEvent, so is_active is written too and
      // the deactivation it undoes is cleared.
      await client.query(
        `UPDATE events SET minted = $1, is_active = TRUE, deactivated_block = NULL, deactivated_tx = NULL
         WHERE event_id = $2`,
        [v.minted.toString(), toHex(k)],
      );
      if (!before.isActive) console.log(`  [+] event ${toHex(k).slice(0, 16)}… reactivated`);
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

  // Re-issues: reissueCredential burns a token and mints its replacement in the same transaction.
  for (const { oldTokenId, newTokenId } of findReissues(prev, curr)) {
    await client.query(
      `UPDATE tokens SET replaces_token_id = $1 WHERE token_id = $2`,
      [oldTokenId.toString(), newTokenId.toString()],
    );
    console.log(`  [~] token #${newTokenId} replaces #${oldTokenId}`);
  }
}

// reissueCredential is the only circuit that burns one token and mints another in a single
// transaction, the new one to the same holder pseudonym and event. So within one state diff, a
// newly burned token and a newly minted one with the same owner and event are a re-issue pair.
function findReissues(prev: LedgerView, curr: LedgerView): { oldTokenId: bigint; newTokenId: bigint }[] {
  const prevBurned = snapshotMap(prev.burnedTokens, (id) => bigintKey(id));
  const newlyBurned = [...curr.burnedTokens].map(([id]) => id).filter((id) => !prevBurned.has(bigintKey(id)));
  if (newlyBurned.length === 0) return [];
  const prevOwners = snapshotMap(prev.tokenOwner, (id) => bigintKey(id));
  const owners = snapshotMap(curr.tokenOwner, (id) => bigintKey(id));
  const events = snapshotMap(curr.tokenEvent, (id) => bigintKey(id));
  const slot = (id: bigint) => `${toHex(owners.get(bigintKey(id))!.v)}:${toHex(events.get(bigintKey(id))!.v)}`;
  const minted = [...owners.values()].map(({ k }) => k).filter((id) => !prevOwners.has(bigintKey(id)));
  const pairs: { oldTokenId: bigint; newTokenId: bigint }[] = [];
  for (const oldTokenId of newlyBurned) {
    const newTokenId = minted.find((id) => slot(id) === slot(oldTokenId));
    if (newTokenId !== undefined) pairs.push({ oldTokenId, newTokenId });
  }
  return pairs;
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
         (request_id, verifier_pk, event_id, field_id, set_root, recipient_pk, published_block, published_tx)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (request_id) DO NOTHING`,
      [
        toHex(k),
        toHex(v.verifier),
        toHex(v.eventId),
        toHex(v.fieldId),
        toHex(v.setRoot),
        // All-zero recipient = open request → NULL.
        v.recipient.some((b) => b !== 0) ? toHex(v.recipient) : null,
        meta.blockHeight.toString(),
        meta.txHash,
      ],
    );
    console.log(`  [+] disclosure request ${toHex(k).slice(0, 16)}… published`);
  }
}

// ── Credential Requests ───────────────────────────────────────────────────────
//
// Multi-condition questions for one holder (publishCredentialRequest). Immutable once published,
// like disclosure requests, so only "added" matters. Unused condition slots (all-zero fieldId) are
// dropped: `conditions` holds the used ones, in the request's order.

async function handleCredentialRequests(
  client: PoolClient,
  prev: LedgerView,
  curr: LedgerView,
  meta: TxMeta,
): Promise<void> {
  const prevSnap = snapshotMap(prev.credentialRequests, (bytes) => toHex(bytes));
  const currSnap = snapshotMap(curr.credentialRequests, (bytes) => toHex(bytes));

  for (const [key, { k, v }] of currSnap) {
    if (prevSnap.has(key)) continue;
    const conditions = v.conditions
      .map((c, slot) => ({ slot, fieldId: toHex(c.fieldId), setRoot: toHex(c.setRoot) }))
      .filter((c) => /[^0]/.test(c.fieldId));
    await client.query(
      `INSERT INTO credential_requests
         (request_id, verifier_pk, event_id, recipient_pk, conditions, published_block, published_tx)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
       ON CONFLICT (request_id) DO NOTHING`,
      [
        toHex(k),
        toHex(v.verifier),
        toHex(v.eventId),
        toHex(v.recipient),
        JSON.stringify(conditions),
        meta.blockHeight.toString(),
        meta.txHash,
      ],
    );
    console.log(`  [+] credential request ${toHex(k).slice(0, 16)}… published (${conditions.length} conditions)`);
  }
}

// ── Credential Update Requests ─────────────────────────────────────────────────
//
// The ledger holds only pending requests. Added or updated (the holder filed
// again with a new commitment) → pending. Removed → closed, and the reason is
// read from the same diff: a re-issue pair (see findReissues) means the issuer
// answered it with reissueCredential; otherwise, if the token is burned in the
// current state it was burn() (a revocation or a self-burn); otherwise
// dismissCredentialUpdate.

async function handleCredentialUpdateRequests(
  client: PoolClient,
  prev: LedgerView,
  curr: LedgerView,
  meta: TxMeta,
): Promise<void> {
  const prevSnap = snapshotMap(prev.credentialUpdateRequests, (id) => bigintKey(id));
  const currSnap = snapshotMap(curr.credentialUpdateRequests, (id) => bigintKey(id));
  const diff = diffMap(prevSnap, currSnap, (a, b) => toHex(a) === toHex(b));

  const filed = [
    ...diff.added.map(({ k, v }) => ({ k, v })),
    ...diff.updated.map(({ k, curr: v }) => ({ k, v })),
  ];
  for (const { k, v } of filed) {
    await client.query(
      `INSERT INTO credential_update_requests
         (token_id, payload_commit, status, requested_block, requested_tx)
       VALUES ($1, $2, 'pending', $3, $4)
       ON CONFLICT (token_id) DO UPDATE
         SET payload_commit    = EXCLUDED.payload_commit,
             status            = 'pending',
             requested_block   = EXCLUDED.requested_block,
             requested_tx      = EXCLUDED.requested_tx,
             closed_block      = NULL,
             closed_tx         = NULL,
             reissued_token_id = NULL`,
      [k.toString(), toHex(v), meta.blockHeight.toString(), meta.txHash],
    );
    console.log(`  [+] update request for token #${k} filed`);
  }

  if (diff.removed.length === 0) return;
  const burned = new Set<string>();
  for (const [id] of curr.burnedTokens) burned.add(bigintKey(id));
  const reissued = new Map<string, bigint>();
  for (const { oldTokenId, newTokenId } of findReissues(prev, curr)) reissued.set(bigintKey(oldTokenId), newTokenId);
  for (const { k } of diff.removed) {
    const newTokenId = reissued.get(bigintKey(k));
    const status = newTokenId !== undefined ? 'reissued' : burned.has(bigintKey(k)) ? 'burned' : 'dismissed';
    await client.query(
      `UPDATE credential_update_requests
         SET status = $1, closed_block = $2, closed_tx = $3, reissued_token_id = $4
       WHERE token_id = $5`,
      [status, meta.blockHeight.toString(), meta.txHash, newTokenId?.toString() ?? null, k.toString()],
    );
    console.log(`  [-] update request for token #${k} ${status}`);
  }
}

// ── Util ───────────────────────────────────────────────────────────────────────

function getFromIter<V>(iter: Iterable<[bigint, V]>, target: bigint): V {
  for (const [k, v] of iter) {
    if (k === target) return v;
  }
  throw new Error(`key ${target} not found in iterable`);
}
