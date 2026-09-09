import { createHash } from 'node:crypto';
import {
  type CircuitContext,
  createCircuitContext,
  emptyZswapLocalState,
  sampleContractAddress,
  transientHash,
  degradeToTransient,
  upgradeFromTransient,
  CompactTypeField,
  CompactTypeVector,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, type Ledger, ledger, pureCircuits } from '../managed/poap/contract/index.js';
import { createWitnesses, type PoapPrivateState } from '../witnesses.js';

// MerkleTreePath<n, Bytes<32>> compiled shape (confirmed via generated
// contract/index.d.ts against compactc 0.31.1) — the depth generic (8 for
// attributePath, 16 for setMembershipPath) is enforced by the circuit at
// proof time via the array length, not encoded in this TS type, so one
// alias covers both. Note goes_left (snake_case), not goesLeft.
type MerklePathArg = {
  leaf: Uint8Array;
  path: { sibling: { field: bigint }; goes_left: boolean }[];
};

// ── Merkle path fixtures ──────────────────────────────────────────────────
//
// Reimplements merkleTreePathRoot's exact algorithm so tests can build a
// REAL, valid (leaf, path) → root, rather than guessing. Confirmed via
// direct source inspection of midnightntwrk/midnight-ledger (`ledger-8`,
// commit a94bd39a) and LFDT-Minokawa/compact (`main`, commit 2acb58e):
//   leaf digest = degradeToTransient(SHA256("mdn:lh" ++ leafBytes))
//   combine(acc, sibling, goesLeft) = transientHash<Vector<2,Field>>(
//     goesLeft ? [acc, sibling] : [sibling, acc])
// The leaf-hash step is plain SHA-256 (Node's crypto — unambiguous). The
// per-level combine step calls the REAL exported transientHash rather than
// hand-rolling Poseidon: its exact parameterization lives in an external
// crate (midnight_circuits) the source investigation couldn't reach, so
// this is the only reliable way to reproduce it — and it's literally the
// same function the compiled contract calls internally, not a lookalike.
const LEAF_DOMAIN_SEP = Buffer.from('mdn:lh', 'ascii');
const FIELD_PAIR = new CompactTypeVector<bigint>(2, CompactTypeField);

function leafDigestField(leafBytes32: Uint8Array): bigint {
  const sha = createHash('sha256')
    .update(Buffer.concat([LEAF_DOMAIN_SEP, Buffer.from(leafBytes32)]))
    .digest();
  return degradeToTransient(new Uint8Array(sha));
}

// Builds a self-consistent MerkleTreePath<depth, Bytes<32>> for a single
// leaf from caller-supplied (or default all-zero/all-left) siblings —
// enough to produce a genuinely valid root/path pair without needing a
// populated multi-leaf tree, since these attribute/set trees are computed
// off-ledger by the organizer/verifier rather than tracked as an on-chain
// MerkleTree ledger.
export function buildMerklePath(
  leafBytes32: Uint8Array,
  depth: number,
  siblings: bigint[] = new Array(depth).fill(0n),
  goesLeft: boolean[] = new Array(depth).fill(true),
): { leaf: Uint8Array; path: MerklePathArg['path']; rootBytes: Uint8Array } {
  if (siblings.length !== depth || goesLeft.length !== depth) {
    throw new Error(`siblings/goesLeft must have length ${depth}`);
  }
  let acc = leafDigestField(leafBytes32);
  const path: MerklePathArg['path'] = [];
  for (let i = 0; i < depth; i++) {
    const sibling = siblings[i];
    const left = goesLeft[i] ? acc : sibling;
    const right = goesLeft[i] ? sibling : acc;
    acc = transientHash(FIELD_PAIR, [left, right]);
    path.push({ sibling: { field: sibling }, goes_left: goesLeft[i] });
  }
  return { leaf: leafBytes32, path, rootBytes: upgradeFromTransient(acc) };
}

// The POAP contract is account-model (no shielded coins), so the Zswap coin
// public key is never used by circuit logic — a fixed dummy key is sufficient.
const DUMMY_COIN_PUBLIC_KEY = '00'.repeat(32);

// Deterministic test keys (32 bytes each)
export const ADMIN_SK = new Uint8Array(32).fill(1);
export const USER1_SK = new Uint8Array(32).fill(2);
export const USER2_SK = new Uint8Array(32).fill(3);
export const ISSUER1_SK = new Uint8Array(32).fill(4);
export const ISSUER2_SK = new Uint8Array(32).fill(5);

export function makeEventId(n: number): Uint8Array {
  const id = new Uint8Array(32);
  id[0] = n;
  return id;
}

// PoapSimulator deploys the contract once (as `deployerSk`) and allows switching
// the active user by calling `asUser(sk)`. All users share the same public chain
// state; each has their own private state.
export class PoapSimulator {
  private contract: Contract<PoapPrivateState>;
  private circuitContext: CircuitContext<PoapPrivateState>;
  // Per-user private state keyed by secretKey[0] (deterministic in tests)
  private privateStates: Map<number, PoapPrivateState> = new Map();

  constructor(deployerSk: Uint8Array = ADMIN_SK) {
    const deployerPrivateState: PoapPrivateState = { secretKey: deployerSk, tokens: {} };
    this.contract = new Contract<PoapPrivateState>(createWitnesses(deployerSk));
    const initialResult = this.contract.initialState({
      initialPrivateState: deployerPrivateState,
      initialZswapLocalState: emptyZswapLocalState(DUMMY_COIN_PUBLIC_KEY),
    });
    this.circuitContext = createCircuitContext<PoapPrivateState>(
      sampleContractAddress(),
      initialResult.currentZswapLocalState,
      initialResult.currentContractState,
      initialResult.currentPrivateState,
    );
    this.privateStates.set(deployerSk[0], this.circuitContext.currentPrivateState);
  }

  // Switch active user. Public chain state is shared; private state is per-user.
  asUser(secretKey: Uint8Array): this {
    const existing = this.privateStates.get(secretKey[0]);
    const userPrivateState: PoapPrivateState = existing ?? { secretKey, tokens: {} };
    this.contract = new Contract<PoapPrivateState>(createWitnesses(secretKey));
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: userPrivateState,
    };
    return this;
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  getPrivateState(): PoapPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  pause(): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .pause(this.circuitContext)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  unpause(): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .unpause(this.circuitContext)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  registerIssuer(issuerPk: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .registerIssuer(this.circuitContext, issuerPk)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  deactivateIssuer(issuerPk: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .deactivateIssuer(this.circuitContext, issuerPk)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  // ── Events ────────────────────────────────────────────────────────────────

  // Returns the DERIVED eventId (hash(organizerPk, label) — see event_key
  // in poap.compact, the fix for the confirmed event-ID-squatting
  // vulnerability), not a Ledger. `label` is what used to be a raw,
  // caller-chosen eventId; callers must capture and use the return value
  // for any subsequent lookup/claim/etc. — the label alone is no longer
  // the on-chain key.
  createEvent(
    label: Uint8Array,
    maxSupply: bigint,
    expiration: bigint,
    isPublicMint: boolean,
    metadataURI: string = 'ipfs://test-metadata',
    privateMetadataCommit: Uint8Array = new Uint8Array(32),
    privateAttributesRoot: Uint8Array = new Uint8Array(32),
  ): Uint8Array {
    const result = this.contract.impureCircuits
      .createEvent(
        this.circuitContext,
        label,
        maxSupply,
        expiration,
        isPublicMint,
        metadataURI,
        privateMetadataCommit,
        privateAttributesRoot,
      );
    this.circuitContext = result.context;
    this.savePrivateState();
    return result.result as Uint8Array;
  }

  // Pure helper mirroring the contract's computeEventId — predicts the id
  // createEvent(label, ...) will assign for a given organizer, without a
  // circuit context.
  static computeEventId(organizer: Uint8Array, label: Uint8Array): Uint8Array {
    return pureCircuits.computeEventId(organizer, label);
  }

  deactivateEvent(eventId: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .deactivateEvent(this.circuitContext, eventId)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  reactivateEvent(eventId: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .reactivateEvent(this.circuitContext, eventId)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  // ── Tokens ────────────────────────────────────────────────────────────────

  // Mints a brand-new token to the caller for this event every time — no
  // more "update an existing token" path. Fails if the caller already
  // claimed this specific event.
  claim(eventId: Uint8Array, isSoulbound: boolean): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .claim(this.circuitContext, eventId, isSoulbound)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  burn(tokenId: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .burn(this.circuitContext, tokenId)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  // ── Private metadata (commit/reveal) ─────────────────────────────────────

  revealPrivateMetadata(eventId: Uint8Array, value: Uint8Array, rand: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .revealPrivateMetadata(this.circuitContext, eventId, value, rand)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  revealPrivateTokenMetadata(tokenId: bigint, value: Uint8Array, rand: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .revealPrivateTokenMetadata(this.circuitContext, tokenId, value, rand)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  // Organizer- or admin-initiated mint directly to a recipient's public key,
  // with metadata the organizer chooses for that specific token. Does not
  // touch the caller's private state — the recipient discovers the token
  // via the indexer / getHolderPk, not via a reconciliation step (there
  // isn't one anymore).
  mintTo(
    eventId: Uint8Array,
    recipientPk: Uint8Array,
    tokenMetadataURI: string = 'ipfs://test-metadata',
    tokenPrivateMetadataCommit: Uint8Array = new Uint8Array(32),
  ): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .mintTo(this.circuitContext, eventId, recipientPk, tokenMetadataURI, tokenPrivateMetadataCommit)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Derive the public key for the currently active user's secret key.
  // Mirrors the on-chain derive_pk circuit so tests can look up issuerId keys.
  // This is the GLOBAL identity (admin/issuer/organizer) — do not use it to
  // predict a tokenOwner entry, use getHolderPk for that.
  getCallerPk(): Uint8Array {
    const result = this.contract.impureCircuits.getCallerPk(this.circuitContext);
    return result.result as Uint8Array;
  }

  // Per-issuer holder pseudonym for the currently active user — what their
  // tokenOwner entry looks like for this specific issuer.
  getHolderPk(issuerId: Uint8Array): Uint8Array {
    const result = this.contract.impureCircuits.getHolderPk(this.circuitContext, issuerId);
    return result.result as Uint8Array;
  }

  // Pure helper, no circuit context needed — computes the same commitment
  // the chain checks in revealPrivateMetadata.
  static computePrivateMetadataCommit(value: Uint8Array, rand: Uint8Array): Uint8Array {
    return pureCircuits.computePrivateMetadataCommit(value, rand);
  }

  // ── Selective disclosure (attribute membership) ──────────────────────────
  //
  // Pure helper — computeAttributeLeaf reads no ledger state and, unlike
  // getCallerPk/getHolderPk, landed in PureCircuits per the compiled
  // contract/index.d.ts (confirmed via `npm run compact` against
  // compactc 0.31.1) — no CircuitContext needed.
  static computeAttributeLeaf(eventId: Uint8Array, fieldId: Uint8Array, value: Uint8Array, rand: Uint8Array): Uint8Array {
    return pureCircuits.computeAttributeLeaf(eventId, fieldId, value, rand);
  }

  // Verifier publishes the question ("does this event's field belong to
  // this set?") on-chain BEFORE a holder can prove against it — this is
  // what pins setRoot/eventId/fieldId so proveAttributeMembership can't be
  // satisfied by a self-invented set. Returns the derived requestId.
  publishDisclosureRequest(
    label: Uint8Array,
    eventId: Uint8Array,
    fieldId: Uint8Array,
    setRoot: Uint8Array,
  ): Uint8Array {
    const result = this.contract.impureCircuits.publishDisclosureRequest(
      this.circuitContext, label, eventId, fieldId, setRoot,
    );
    this.circuitContext = result.context;
    this.savePrivateState();
    return result.result as Uint8Array;
  }

  // Signals success purely by not throwing — the contract circuit itself
  // returns [] now (see poap.compact: every failure path is an assert, so
  // a Boolean return could only ever observably be true).
  proveAttributeMembership(
    requestId: Uint8Array,
    value: Uint8Array,
    rand: Uint8Array,
    attributePath: MerklePathArg,
    setMembershipPath: MerklePathArg,
  ): void {
    const result = this.contract.impureCircuits.proveAttributeMembership(
      this.circuitContext, requestId, value, rand, attributePath, setMembershipPath,
    );
    this.circuitContext = result.context;
    this.savePrivateState();
  }

  proveAttributeMembershipOnce(
    requestId: Uint8Array,
    value: Uint8Array,
    rand: Uint8Array,
    attributePath: MerklePathArg,
    setMembershipPath: MerklePathArg,
  ): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .proveAttributeMembershipOnce(
        this.circuitContext, requestId, value, rand, attributePath, setMembershipPath,
      )
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  private savePrivateState(): void {
    const sk = this.circuitContext.currentPrivateState?.secretKey;
    if (sk !== undefined) {
      this.privateStates.set(sk[0], this.circuitContext.currentPrivateState);
    }
  }
}
