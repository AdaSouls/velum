import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<T> = {
  local_sk(context: __compactRuntime.WitnessContext<Ledger, T>): [T, Uint8Array];
  get_my_token(context: __compactRuntime.WitnessContext<Ledger, T>): [T, { is_some: boolean,
                                                                           value: bigint
                                                                         }];
  store_token(context: __compactRuntime.WitnessContext<Ledger, T>,
              tokenId: bigint,
              eventId: Uint8Array,
              isSoulbound: boolean): [T, void];
  store_attendance(context: __compactRuntime.WitnessContext<Ledger, T>,
                   tokenId: bigint,
                   eventId: Uint8Array): [T, void];
}

export type ImpureCircuits<T> = {
  createEvent(context: __compactRuntime.CircuitContext<T>,
              eventId: Uint8Array,
              maxSupply: bigint,
              expiration: bigint,
              isPublicMint: boolean): __compactRuntime.CircuitResults<T, void>;
  deactivateEvent(context: __compactRuntime.CircuitContext<T>,
                  eventId: Uint8Array): __compactRuntime.CircuitResults<T, void>;
  claimOrUpdate(context: __compactRuntime.CircuitContext<T>,
                eventId: Uint8Array,
                isSoulbound: boolean): __compactRuntime.CircuitResults<T, void>;
  getCallerPk(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, Uint8Array>;
}

export type PureCircuits = {
}

export type Circuits<T> = {
  createEvent(context: __compactRuntime.CircuitContext<T>,
              eventId: Uint8Array,
              maxSupply: bigint,
              expiration: bigint,
              isPublicMint: boolean): __compactRuntime.CircuitResults<T, void>;
  deactivateEvent(context: __compactRuntime.CircuitContext<T>,
                  eventId: Uint8Array): __compactRuntime.CircuitResults<T, void>;
  claimOrUpdate(context: __compactRuntime.CircuitContext<T>,
                eventId: Uint8Array,
                isSoulbound: boolean): __compactRuntime.CircuitResults<T, void>;
  getCallerPk(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, Uint8Array>;
}

export type Ledger = {
  readonly totalSupply: bigint;
  tokenOwner: {
    isEmpty(): boolean;
    size(): bigint;
    member(key: bigint): boolean;
    lookup(key: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  tokenFirstEvent: {
    isEmpty(): boolean;
    size(): bigint;
    member(key: bigint): boolean;
    lookup(key: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  events: {
    isEmpty(): boolean;
    size(): bigint;
    member(key: Uint8Array): boolean;
    lookup(key: Uint8Array): { maxSupply: bigint,
                               minted: bigint,
                               expiration: bigint,
                               organizer: Uint8Array,
                               isActive: boolean,
                               isPublicMint: boolean
                             };
    [Symbol.iterator](): Iterator<[Uint8Array, { maxSupply: bigint,
  minted: bigint,
  expiration: bigint,
  organizer: Uint8Array,
  isActive: boolean,
  isPublicMint: boolean
}]>
  };
  readonly adminPk: Uint8Array;
}

export declare class Contract<T, W extends Witnesses<T> = Witnesses<T>> {
  witnesses: W;
  circuits: Circuits<T>;
  impureCircuits: ImpureCircuits<T>;
  constructor(witnesses: W);
  initialState(privateState: T): [T, __compactRuntime.ContractState];
}

export declare function ledger(state: __compactRuntime.StateValue): Ledger;
export declare const pureCircuits: PureCircuits;
