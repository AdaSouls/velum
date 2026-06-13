import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from './managed/poap/contract/index.cjs';

// ── Private State ─────────────────────────────────────────────────────────────
// Stored client-side (in wallet). Never sent to the public chain.

export type AttendanceRecord = {
  eventIds: Uint8Array[];
  isSoulbound: boolean;
};

export type PoapPrivateState = {
  secretKey: Uint8Array;
  // tokenId → attendance record (undefined if no token yet)
  token?: {
    tokenId: bigint;
    attendance: AttendanceRecord;
  };
};

// ── Witness Factory ───────────────────────────────────────────────────────────
// Creates the witness functions for a given private state.

export function createWitnesses(secretKey: Uint8Array): Witnesses<PoapPrivateState> {
  return {
    local_sk(context: WitnessContext<Ledger, PoapPrivateState>): [PoapPrivateState, Uint8Array] {
      return [context.privateState, secretKey];
    },

    get_my_token(
      context: WitnessContext<Ledger, PoapPrivateState>,
    ): [PoapPrivateState, { is_some: boolean; value: bigint }] {
      const { token } = context.privateState;
      if (token !== undefined) {
        return [context.privateState, { is_some: true, value: token.tokenId }];
      }
      return [context.privateState, { is_some: false, value: 0n }];
    },

    store_token(
      context: WitnessContext<Ledger, PoapPrivateState>,
      tokenId: bigint,
      eventId: Uint8Array,
      isSoulbound: boolean,
    ): [PoapPrivateState, void] {
      const newState: PoapPrivateState = {
        ...context.privateState,
        token: {
          tokenId,
          attendance: {
            eventIds: [eventId],
            isSoulbound,
          },
        },
      };
      return [newState, undefined];
    },

    store_attendance(
      context: WitnessContext<Ledger, PoapPrivateState>,
      _tokenId: bigint,
      eventId: Uint8Array,
    ): [PoapPrivateState, void] {
      const existing = context.privateState.token;
      if (existing === undefined) {
        // Should not happen — updateToken checks ownership first
        return [context.privateState, undefined];
      }
      const newState: PoapPrivateState = {
        ...context.privateState,
        token: {
          ...existing,
          attendance: {
            ...existing.attendance,
            eventIds: [...existing.attendance.eventIds, eventId],
          },
        },
      };
      return [newState, undefined];
    },
  };
}
