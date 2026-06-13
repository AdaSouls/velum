import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<T> = {
}

export type ImpureCircuits<T> = {
  greet(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, void>;
  getCount(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, bigint>;
}

export type PureCircuits = {
}

export type Circuits<T> = {
  greet(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, void>;
  getCount(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, bigint>;
}

export type Ledger = {
  readonly greetCount: bigint;
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
