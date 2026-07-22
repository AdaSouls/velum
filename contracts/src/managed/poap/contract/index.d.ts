import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type EventRecord = { maxSupply: bigint;
                            minted: bigint;
                            expiration: bigint;
                            organizer: Uint8Array;
                            isActive: boolean;
                            isPublicMint: boolean
                          };

export type IssuerRecord = { organizerPk: Uint8Array; isActive: boolean };

export type Witnesses<PS> = {
  local_sk(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_my_token_for_issuer(context: __compactRuntime.WitnessContext<Ledger, PS>,
                          issuerId_0: Uint8Array): [PS, { is_some: boolean,
                                                          value: bigint
                                                        }];
  store_token(context: __compactRuntime.WitnessContext<Ledger, PS>,
              tokenId_0: bigint,
              issuerId_0: Uint8Array,
              eventId_0: Uint8Array,
              isSoulbound_0: boolean): [PS, []];
  store_attendance(context: __compactRuntime.WitnessContext<Ledger, PS>,
                   tokenId_0: bigint,
                   issuerId_0: Uint8Array,
                   eventId_0: Uint8Array): [PS, []];
  has_attended(context: __compactRuntime.WitnessContext<Ledger, PS>,
               issuerId_0: Uint8Array,
               eventId_0: Uint8Array): [PS, boolean];
}

export type ImpureCircuits<PS> = {
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  deactivateIssuer(context: __compactRuntime.CircuitContext<PS>,
                   issuerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  createEvent(context: __compactRuntime.CircuitContext<PS>,
              eventId_0: Uint8Array,
              maxSupply_0: bigint,
              expiration_0: bigint,
              isPublicMint_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  deactivateEvent(context: __compactRuntime.CircuitContext<PS>,
                  eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claimOrUpdate(context: __compactRuntime.CircuitContext<PS>,
                eventId_0: Uint8Array,
                isSoulbound_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  mintTo(context: __compactRuntime.CircuitContext<PS>,
         eventId_0: Uint8Array,
         recipientPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  burn(context: __compactRuntime.CircuitContext<PS>, tokenId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getCallerPk(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type ProvableCircuits<PS> = {
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  deactivateIssuer(context: __compactRuntime.CircuitContext<PS>,
                   issuerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  createEvent(context: __compactRuntime.CircuitContext<PS>,
              eventId_0: Uint8Array,
              maxSupply_0: bigint,
              expiration_0: bigint,
              isPublicMint_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  deactivateEvent(context: __compactRuntime.CircuitContext<PS>,
                  eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claimOrUpdate(context: __compactRuntime.CircuitContext<PS>,
                eventId_0: Uint8Array,
                isSoulbound_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  mintTo(context: __compactRuntime.CircuitContext<PS>,
         eventId_0: Uint8Array,
         recipientPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  burn(context: __compactRuntime.CircuitContext<PS>, tokenId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  deactivateIssuer(context: __compactRuntime.CircuitContext<PS>,
                   issuerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  createEvent(context: __compactRuntime.CircuitContext<PS>,
              eventId_0: Uint8Array,
              maxSupply_0: bigint,
              expiration_0: bigint,
              isPublicMint_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  deactivateEvent(context: __compactRuntime.CircuitContext<PS>,
                  eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claimOrUpdate(context: __compactRuntime.CircuitContext<PS>,
                eventId_0: Uint8Array,
                isSoulbound_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  mintTo(context: __compactRuntime.CircuitContext<PS>,
         eventId_0: Uint8Array,
         recipientPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  burn(context: __compactRuntime.CircuitContext<PS>, tokenId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getCallerPk(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type Ledger = {
  readonly totalSupply: bigint;
  tokenOwner: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  tokenFirstEvent: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  tokenIssuer: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  issuerHolderToken: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  events: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): EventRecord;
    [Symbol.iterator](): Iterator<[Uint8Array, EventRecord]>
  };
  issuers: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): IssuerRecord;
    [Symbol.iterator](): Iterator<[Uint8Array, IssuerRecord]>
  };
  burnedTokens: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): boolean;
    [Symbol.iterator](): Iterator<[bigint, boolean]>
  };
  readonly isPaused: boolean;
  readonly adminPk: Uint8Array;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
