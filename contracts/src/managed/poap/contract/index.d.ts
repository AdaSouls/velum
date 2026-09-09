import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type EventRecord = { maxSupply: bigint;
                            minted: bigint;
                            expiration: bigint;
                            organizer: Uint8Array;
                            isActive: boolean;
                            isPublicMint: boolean;
                            metadataURI: string;
                            privateMetadataCommit: Uint8Array;
                            privateAttributesRoot: Uint8Array
                          };

export type IssuerRecord = { organizerPk: Uint8Array; isActive: boolean };

export type DisclosureRequest = { verifier: Uint8Array;
                                  eventId: Uint8Array;
                                  fieldId: Uint8Array;
                                  setRoot: Uint8Array
                                };

export type Witnesses<PS> = {
  local_sk(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  store_token(context: __compactRuntime.WitnessContext<Ledger, PS>,
              tokenId_0: bigint,
              issuerId_0: Uint8Array,
              eventId_0: Uint8Array,
              isSoulbound_0: boolean): [PS, []];
}

export type ImpureCircuits<PS> = {
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  deactivateIssuer(context: __compactRuntime.CircuitContext<PS>,
                   issuerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  createEvent(context: __compactRuntime.CircuitContext<PS>,
              label_0: Uint8Array,
              maxSupply_0: bigint,
              expiration_0: bigint,
              isPublicMint_0: boolean,
              metadataURI_0: string,
              privateMetadataCommit_0: Uint8Array,
              privateAttributesRoot_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deactivateEvent(context: __compactRuntime.CircuitContext<PS>,
                  eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  reactivateEvent(context: __compactRuntime.CircuitContext<PS>,
                  eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claim(context: __compactRuntime.CircuitContext<PS>,
        eventId_0: Uint8Array,
        isSoulbound_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  mintTo(context: __compactRuntime.CircuitContext<PS>,
         eventId_0: Uint8Array,
         recipientPk_0: Uint8Array,
         tokenMetadataURI_0: string,
         tokenPrivateMetadataCommit_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  burn(context: __compactRuntime.CircuitContext<PS>, tokenId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getCallerPk(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getHolderPk(context: __compactRuntime.CircuitContext<PS>,
              issuerId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  revealPrivateMetadata(context: __compactRuntime.CircuitContext<PS>,
                        eventId_0: Uint8Array,
                        value_0: Uint8Array,
                        rand_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revealPrivateTokenMetadata(context: __compactRuntime.CircuitContext<PS>,
                             tokenId_0: bigint,
                             value_0: Uint8Array,
                             rand_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  publishDisclosureRequest(context: __compactRuntime.CircuitContext<PS>,
                           label_0: Uint8Array,
                           eventId_0: Uint8Array,
                           fieldId_0: Uint8Array,
                           setRoot_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  proveAttributeMembership(context: __compactRuntime.CircuitContext<PS>,
                           requestId_0: Uint8Array,
                           value_0: Uint8Array,
                           rand_0: Uint8Array,
                           attributePath_0: { leaf: Uint8Array,
                                              path: { sibling: { field: bigint },
                                                      goes_left: boolean
                                                    }[]
                                            },
                           setMembershipPath_0: { leaf: Uint8Array,
                                                  path: { sibling: { field: bigint
                                                                   },
                                                          goes_left: boolean
                                                        }[]
                                                }): __compactRuntime.CircuitResults<PS, []>;
  proveAttributeMembershipOnce(context: __compactRuntime.CircuitContext<PS>,
                               requestId_0: Uint8Array,
                               value_0: Uint8Array,
                               rand_0: Uint8Array,
                               attributePath_0: { leaf: Uint8Array,
                                                  path: { sibling: { field: bigint
                                                                   },
                                                          goes_left: boolean
                                                        }[]
                                                },
                               setMembershipPath_0: { leaf: Uint8Array,
                                                      path: { sibling: { field: bigint
                                                                       },
                                                              goes_left: boolean
                                                            }[]
                                                    }): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  deactivateIssuer(context: __compactRuntime.CircuitContext<PS>,
                   issuerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  createEvent(context: __compactRuntime.CircuitContext<PS>,
              label_0: Uint8Array,
              maxSupply_0: bigint,
              expiration_0: bigint,
              isPublicMint_0: boolean,
              metadataURI_0: string,
              privateMetadataCommit_0: Uint8Array,
              privateAttributesRoot_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deactivateEvent(context: __compactRuntime.CircuitContext<PS>,
                  eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  reactivateEvent(context: __compactRuntime.CircuitContext<PS>,
                  eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claim(context: __compactRuntime.CircuitContext<PS>,
        eventId_0: Uint8Array,
        isSoulbound_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  mintTo(context: __compactRuntime.CircuitContext<PS>,
         eventId_0: Uint8Array,
         recipientPk_0: Uint8Array,
         tokenMetadataURI_0: string,
         tokenPrivateMetadataCommit_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  burn(context: __compactRuntime.CircuitContext<PS>, tokenId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  revealPrivateMetadata(context: __compactRuntime.CircuitContext<PS>,
                        eventId_0: Uint8Array,
                        value_0: Uint8Array,
                        rand_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revealPrivateTokenMetadata(context: __compactRuntime.CircuitContext<PS>,
                             tokenId_0: bigint,
                             value_0: Uint8Array,
                             rand_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  publishDisclosureRequest(context: __compactRuntime.CircuitContext<PS>,
                           label_0: Uint8Array,
                           eventId_0: Uint8Array,
                           fieldId_0: Uint8Array,
                           setRoot_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  proveAttributeMembership(context: __compactRuntime.CircuitContext<PS>,
                           requestId_0: Uint8Array,
                           value_0: Uint8Array,
                           rand_0: Uint8Array,
                           attributePath_0: { leaf: Uint8Array,
                                              path: { sibling: { field: bigint },
                                                      goes_left: boolean
                                                    }[]
                                            },
                           setMembershipPath_0: { leaf: Uint8Array,
                                                  path: { sibling: { field: bigint
                                                                   },
                                                          goes_left: boolean
                                                        }[]
                                                }): __compactRuntime.CircuitResults<PS, []>;
  proveAttributeMembershipOnce(context: __compactRuntime.CircuitContext<PS>,
                               requestId_0: Uint8Array,
                               value_0: Uint8Array,
                               rand_0: Uint8Array,
                               attributePath_0: { leaf: Uint8Array,
                                                  path: { sibling: { field: bigint
                                                                   },
                                                          goes_left: boolean
                                                        }[]
                                                },
                               setMembershipPath_0: { leaf: Uint8Array,
                                                      path: { sibling: { field: bigint
                                                                       },
                                                              goes_left: boolean
                                                            }[]
                                                    }): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  computeEventId(organizer_0: Uint8Array, label_0: Uint8Array): Uint8Array;
  computePrivateMetadataCommit(value_0: Uint8Array, rand_0: Uint8Array): Uint8Array;
  computeAttributeLeaf(eventId_0: Uint8Array,
                       fieldId_0: Uint8Array,
                       value_0: Uint8Array,
                       rand_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  computeEventId(context: __compactRuntime.CircuitContext<PS>,
                 organizer_0: Uint8Array,
                 label_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  pause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  unpause(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  deactivateIssuer(context: __compactRuntime.CircuitContext<PS>,
                   issuerPk_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  createEvent(context: __compactRuntime.CircuitContext<PS>,
              label_0: Uint8Array,
              maxSupply_0: bigint,
              expiration_0: bigint,
              isPublicMint_0: boolean,
              metadataURI_0: string,
              privateMetadataCommit_0: Uint8Array,
              privateAttributesRoot_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deactivateEvent(context: __compactRuntime.CircuitContext<PS>,
                  eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  reactivateEvent(context: __compactRuntime.CircuitContext<PS>,
                  eventId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  claim(context: __compactRuntime.CircuitContext<PS>,
        eventId_0: Uint8Array,
        isSoulbound_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  mintTo(context: __compactRuntime.CircuitContext<PS>,
         eventId_0: Uint8Array,
         recipientPk_0: Uint8Array,
         tokenMetadataURI_0: string,
         tokenPrivateMetadataCommit_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  burn(context: __compactRuntime.CircuitContext<PS>, tokenId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getCallerPk(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
  getHolderPk(context: __compactRuntime.CircuitContext<PS>,
              issuerId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  computePrivateMetadataCommit(context: __compactRuntime.CircuitContext<PS>,
                               value_0: Uint8Array,
                               rand_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  revealPrivateMetadata(context: __compactRuntime.CircuitContext<PS>,
                        eventId_0: Uint8Array,
                        value_0: Uint8Array,
                        rand_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revealPrivateTokenMetadata(context: __compactRuntime.CircuitContext<PS>,
                             tokenId_0: bigint,
                             value_0: Uint8Array,
                             rand_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  computeAttributeLeaf(context: __compactRuntime.CircuitContext<PS>,
                       eventId_0: Uint8Array,
                       fieldId_0: Uint8Array,
                       value_0: Uint8Array,
                       rand_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  publishDisclosureRequest(context: __compactRuntime.CircuitContext<PS>,
                           label_0: Uint8Array,
                           eventId_0: Uint8Array,
                           fieldId_0: Uint8Array,
                           setRoot_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  proveAttributeMembership(context: __compactRuntime.CircuitContext<PS>,
                           requestId_0: Uint8Array,
                           value_0: Uint8Array,
                           rand_0: Uint8Array,
                           attributePath_0: { leaf: Uint8Array,
                                              path: { sibling: { field: bigint },
                                                      goes_left: boolean
                                                    }[]
                                            },
                           setMembershipPath_0: { leaf: Uint8Array,
                                                  path: { sibling: { field: bigint
                                                                   },
                                                          goes_left: boolean
                                                        }[]
                                                }): __compactRuntime.CircuitResults<PS, []>;
  proveAttributeMembershipOnce(context: __compactRuntime.CircuitContext<PS>,
                               requestId_0: Uint8Array,
                               value_0: Uint8Array,
                               rand_0: Uint8Array,
                               attributePath_0: { leaf: Uint8Array,
                                                  path: { sibling: { field: bigint
                                                                   },
                                                          goes_left: boolean
                                                        }[]
                                                },
                               setMembershipPath_0: { leaf: Uint8Array,
                                                      path: { sibling: { field: bigint
                                                                       },
                                                              goes_left: boolean
                                                            }[]
                                                    }): __compactRuntime.CircuitResults<PS, []>;
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
  tokenEvent: {
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
  tokenMetadataURI: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): string;
    [Symbol.iterator](): Iterator<[bigint, string]>
  };
  tokenPrivateMetadataCommit: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  tokenRevealedMetadata: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  eventHolderToken: {
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
  eventRevealedMetadata: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
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
  usedDisclosures: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  disclosureRequests: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): DisclosureRequest;
    [Symbol.iterator](): Iterator<[Uint8Array, DisclosureRequest]>
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
