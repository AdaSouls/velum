import {
  type CircuitContext,
  createCircuitContext,
  emptyZswapLocalState,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, type Ledger, ledger } from '../managed/poap/contract/index.js';
import { createWitnesses, type PoapPrivateState } from '../witnesses.js';

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

  createEvent(
    eventId: Uint8Array,
    maxSupply: bigint,
    expiration: bigint,
    isPublicMint: boolean,
  ): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .createEvent(this.circuitContext, eventId, maxSupply, expiration, isPublicMint)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  deactivateEvent(eventId: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .deactivateEvent(this.circuitContext, eventId)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  // ── Tokens ────────────────────────────────────────────────────────────────

  claimOrUpdate(eventId: Uint8Array, isSoulbound: boolean): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .claimOrUpdate(this.circuitContext, eventId, isSoulbound)
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

  // Organizer- or admin-initiated mint directly to a recipient's public key.
  // Does not touch the caller's private state (the recipient's wallet
  // reconciles it on its next claimOrUpdate call).
  mintTo(eventId: Uint8Array, recipientPk: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .mintTo(this.circuitContext, eventId, recipientPk)
      .context;
    this.savePrivateState();
    return this.getLedger();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Derive the public key for the currently active user's secret key.
  // Mirrors the on-chain derive_pk circuit so tests can look up issuerId keys.
  getCallerPk(): Uint8Array {
    const result = this.contract.impureCircuits.getCallerPk(this.circuitContext);
    return result.result as Uint8Array;
  }

  private savePrivateState(): void {
    const sk = this.circuitContext.currentPrivateState?.secretKey;
    if (sk !== undefined) {
      this.privateStates.set(sk[0], this.circuitContext.currentPrivateState);
    }
  }
}
