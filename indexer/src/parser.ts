/**
 * Parses the hex-encoded contract state returned by the Midnight Indexer into a
 * typed ledger object using the compiled Compact contract artifacts.
 *
 * The `state` field on ContractAction (ContractDeploy/ContractCall/ContractUpdate) is a hex
 * string. ContractState.deserialize converts it to a ContractState, whose `.data` (a
 * ChargedState) is what the compiled contract's ledger() now expects.
 *
 * The compiled contract module is ESM (contracts/src/managed/poap/contract/index.js), so it's
 * loaded via dynamic import rather than createRequire — call initContractModule() once at
 * startup before any parseState() call.
 */

import * as compactRuntime from '@midnight-ntwrk/compact-runtime';
import { config } from './config.js';

let _ledger: ((state: unknown) => LedgerView) | undefined;

export async function initContractModule(): Promise<void> {
  const mod = await import(config.contractModulePath);
  _ledger = mod.ledger;
}

export type EventRecord = {
  maxSupply: bigint;
  minted: bigint;
  expiration: bigint;
  organizer: Uint8Array;
  isActive: boolean;
  isPublicMint: boolean;
  // URI to off-chain JSON (name/description/image/…), e.g. "ipfs://<CID>".
  metadataURI: string;
  // Merkle root over independently-committed private attributes (see
  // proveAttributeMembership in poap.compact) — all-zero means none
  // committed. NOTE: privateMetadataCommit (the older single-blob commit)
  // is also on-chain but was never added to this type or to eventEquals —
  // a pre-existing gap, not introduced here; the indexer has never tracked
  // it. Fix alongside this if/when that's revisited.
  privateAttributesRoot: Uint8Array;
};

export type IssuerRecord = {
  organizerPk: Uint8Array;
  isActive: boolean;
};

export type LedgerView = {
  totalSupply: bigint;
  tokenOwner:                 Iterable<[bigint,    Uint8Array]>;
  // Renamed from the contract's old tokenFirstEvent: every claim now mints a
  // brand-new token (no more "update an existing token across events"), so a
  // token maps to exactly one event, permanently — "first" no longer applies.
  tokenEvent:                 Iterable<[bigint,    Uint8Array]>;
  tokenIssuer:                Iterable<[bigint,    Uint8Array]>;
  // URI to off-chain JSON for this specific token (inherited from the event
  // at claim time, or personalized per-recipient via mintTo).
  tokenMetadataURI:           Iterable<[bigint,    string]>;
  tokenPrivateMetadataCommit: Iterable<[bigint,    Uint8Array]>;
  events:         Iterable<[Uint8Array, EventRecord]>;
  issuers:        Iterable<[Uint8Array, IssuerRecord]>;
  burnedTokens:   Iterable<[bigint,    boolean]>;
  // Nullifiers spent via proveAttributeMembershipOnce (selective disclosure,
  // single-use variant). proveAttributeMembership itself (the stateless,
  // typical-case predicate proof) never touches ledger state, so it never
  // appears in any diff here — by design, the indexer has no visibility
  // into ordinary disclosure proofs at all.
  usedDisclosures: Iterable<[Uint8Array, boolean]>;
  isPaused: boolean;
  adminPk: Uint8Array;
};

export function parseState(stateHex: string): LedgerView {
  if (!_ledger) throw new Error('Contract module not initialized — call initContractModule() first');
  const bytes = Buffer.from(stateHex, 'hex');
  const cs = (compactRuntime as any).ContractState.deserialize(bytes);
  return _ledger(cs.data) as LedgerView;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function bigintKey(n: bigint): string {
  return n.toString();
}

/** Snapshot a ledger map to a plain JS Map (key-string → value). */
export function snapshotMap<K, V>(
  iter: Iterable<[K, V]>,
  key: (k: K) => string,
): Map<string, { k: K; v: V }> {
  const m = new Map<string, { k: K; v: V }>();
  for (const [k, v] of iter) m.set(key(k), { k, v });
  return m;
}

export type MapDiff<K, V> = {
  added:   { k: K; v: V }[];
  removed: { k: K; v: V }[];
  updated: { k: K; prev: V; curr: V }[];
};

/** Diff two ledger-map snapshots. Updated entries are included when any field differs. */
export function diffMap<K, V>(
  prev: Map<string, { k: K; v: V }>,
  curr: Map<string, { k: K; v: V }>,
  equals: (a: V, b: V) => boolean,
): MapDiff<K, V> {
  const added:   { k: K; v: V }[] = [];
  const removed: { k: K; v: V }[] = [];
  const updated: { k: K; prev: V; curr: V }[] = [];

  for (const [ks, entry] of curr) {
    if (!prev.has(ks)) {
      added.push(entry);
    } else {
      const prevEntry = prev.get(ks)!;
      if (!equals(prevEntry.v, entry.v)) {
        updated.push({ k: entry.k, prev: prevEntry.v, curr: entry.v });
      }
    }
  }
  for (const [ks, entry] of prev) {
    if (!curr.has(ks)) removed.push(entry);
  }
  return { added, removed, updated };
}

// ── Equality helpers ───────────────────────────────────────────────────────────

export function issuerEquals(a: IssuerRecord, b: IssuerRecord): boolean {
  return a.isActive === b.isActive && toHex(a.organizerPk) === toHex(b.organizerPk);
}

export function eventEquals(a: EventRecord, b: EventRecord): boolean {
  return (
    a.isActive === b.isActive &&
    a.minted === b.minted &&
    a.maxSupply === b.maxSupply &&
    a.expiration === b.expiration &&
    a.isPublicMint === b.isPublicMint &&
    a.metadataURI === b.metadataURI &&
    toHex(a.organizer) === toHex(b.organizer) &&
    toHex(a.privateAttributesRoot) === toHex(b.privateAttributesRoot)
  );
}
