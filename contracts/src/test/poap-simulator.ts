import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, type Ledger, ledger } from '../managed/poap/contract/index.cjs';
import { createWitnesses, type PoapPrivateState } from '../witnesses.js';

// Deterministic test keys (32 bytes each)
export const ADMIN_SK = new Uint8Array(32).fill(1);
export const USER1_SK = new Uint8Array(32).fill(2);
export const USER2_SK = new Uint8Array(32).fill(3);

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
    const deployerPrivateState: PoapPrivateState = { secretKey: deployerSk };
    this.contract = new Contract<PoapPrivateState>(createWitnesses(deployerSk));
    const [initialPS, initialCS] = this.contract.initialState(deployerPrivateState);
    this.circuitContext = {
      currentPrivateState: initialPS ?? deployerPrivateState,
      originalState: initialCS,
      transactionContext: new QueryContext(initialCS.data, sampleContractAddress()),
    };
    this.privateStates.set(deployerSk[0], this.circuitContext.currentPrivateState);
  }

  // Switch active user. Public chain state is shared; private state is per-user.
  asUser(secretKey: Uint8Array): this {
    const existing = this.privateStates.get(secretKey[0]);
    const userPrivateState: PoapPrivateState = existing ?? { secretKey };
    this.contract = new Contract<PoapPrivateState>(createWitnesses(secretKey));
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: userPrivateState,
    };
    return this;
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.transactionContext.state);
  }

  getPrivateState(): PoapPrivateState {
    return this.circuitContext.currentPrivateState;
  }

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

  claimOrUpdate(eventId: Uint8Array, isSoulbound: boolean): Ledger {
    this.circuitContext = this.contract.impureCircuits
      .claimOrUpdate(this.circuitContext, eventId, isSoulbound)
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

  private savePrivateState(): void {
    const sk = this.circuitContext.currentPrivateState?.secretKey;
    if (sk !== undefined) {
      this.privateStates.set(sk[0], this.circuitContext.currentPrivateState);
    }
  }
}
