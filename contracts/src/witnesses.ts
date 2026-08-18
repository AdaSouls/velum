import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from './managed/poap/contract/index.js';

// ── Private State ─────────────────────────────────────────────────────────────
//
// Every claim mints a brand-new token now — the contract itself decides
// mint-vs-reject purely from public ledger state (eventHolderToken), so this
// private state is no longer load-bearing for contract logic. It's kept as a
// convenience cache so a wallet can list "my tokens" without re-querying the
// indexer for every event it might have claimed.

export type TokenRecord = {
  tokenId: bigint;
  isSoulbound: boolean;
};

export type PoapPrivateState = {
  secretKey: Uint8Array;
  // eventId (hex) → the token claimed for that event
  tokens: Record<string, TokenRecord>;
};

function eventKey(eventId: Uint8Array): string {
  return Buffer.from(eventId).toString('hex');
}

// ── Witness Factory ───────────────────────────────────────────────────────────

export function createWitnesses(secretKey: Uint8Array): Witnesses<PoapPrivateState> {
  return {
    local_sk(context: WitnessContext<Ledger, PoapPrivateState>): [PoapPrivateState, Uint8Array] {
      return [context.privateState, secretKey];
    },

    store_token(
      context: WitnessContext<Ledger, PoapPrivateState>,
      tokenId: bigint,
      _issuerId: Uint8Array,
      eventId: Uint8Array,
      isSoulbound: boolean,
    ): [PoapPrivateState, []] {
      const newState: PoapPrivateState = {
        ...context.privateState,
        tokens: {
          ...context.privateState.tokens,
          [eventKey(eventId)]: { tokenId, isSoulbound },
        },
      };
      return [newState, []];
    },
  };
}
