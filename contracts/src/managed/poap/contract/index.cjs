'use strict';
const __compactRuntime = require('@midnight-ntwrk/compact-runtime');
const expectedRuntimeVersionString = '0.6.13';
const expectedRuntimeVersion = expectedRuntimeVersionString.split('-')[0].split('.').map(Number);
const actualRuntimeVersion = __compactRuntime.versionString.split('-')[0].split('.').map(Number);
if (expectedRuntimeVersion[0] != actualRuntimeVersion[0]
     || (actualRuntimeVersion[0] == 0 && expectedRuntimeVersion[1] != actualRuntimeVersion[1])
     || expectedRuntimeVersion[1] > actualRuntimeVersion[1]
     || (expectedRuntimeVersion[1] == actualRuntimeVersion[1] && expectedRuntimeVersion[2] > actualRuntimeVersion[2]))
   throw new __compactRuntime.CompactError(`Version mismatch: compiled code expects ${expectedRuntimeVersionString}, runtime is ${__compactRuntime.versionString}`);
{ const MAX_FIELD = 52435875175126190479447740508185965837690552500527637822603658699938581184512n;
  if (__compactRuntime.MAX_FIELD !== MAX_FIELD)
     throw new __compactRuntime.CompactError(`compiler thinks maximum field value is ${MAX_FIELD}; run time thinks it is ${__compactRuntime.MAX_FIELD}`)
}

const _descriptor_0 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_1 = new __compactRuntime.CompactTypeBoolean();

const _descriptor_2 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

class _EventRecord_0 {
  alignment() {
    return _descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_0.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment())))));
  }
  fromValue(value) {
    return {
      maxSupply: _descriptor_2.fromValue(value),
      minted: _descriptor_2.fromValue(value),
      expiration: _descriptor_2.fromValue(value),
      organizer: _descriptor_0.fromValue(value),
      isActive: _descriptor_1.fromValue(value),
      isPublicMint: _descriptor_1.fromValue(value)
    }
  }
  toValue(value) {
    return _descriptor_2.toValue(value.maxSupply).concat(_descriptor_2.toValue(value.minted).concat(_descriptor_2.toValue(value.expiration).concat(_descriptor_0.toValue(value.organizer).concat(_descriptor_1.toValue(value.isActive).concat(_descriptor_1.toValue(value.isPublicMint))))));
  }
  valueAlignment(value) {
    return _descriptor_2.valueAlignment(value.maxSupply).concat(_descriptor_2.valueAlignment(value.minted).concat(_descriptor_2.valueAlignment(value.expiration).concat(_descriptor_0.valueAlignment(value.organizer).concat(_descriptor_1.valueAlignment(value.isActive).concat(_descriptor_1.valueAlignment(value.isPublicMint))))));
  }
}

const _descriptor_3 = new _EventRecord_0();

const _descriptor_4 = new __compactRuntime.CompactTypeUnsignedInteger(65535n, 2);

class _Maybe_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_2.alignment());
  }
  fromValue(value) {
    return {
      is_some: _descriptor_1.fromValue(value),
      value: _descriptor_2.fromValue(value)
    }
  }
  toValue(value) {
    return _descriptor_1.toValue(value.is_some).concat(_descriptor_2.toValue(value.value));
  }
  valueAlignment(value) {
    return _descriptor_1.valueAlignment(value.is_some).concat(_descriptor_2.valueAlignment(value.value));
  }
}

const _descriptor_5 = new _Maybe_0();

const _descriptor_6 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

class Contract {
  witnesses;
  constructor(...args) {
    if (args.length !== 1)
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args.length}`);
    const witnesses = args[0];
    if (typeof(witnesses) !== 'object')
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    if (typeof(witnesses.local_sk) !== 'function')
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named local_sk');
    if (typeof(witnesses.get_my_token) !== 'function')
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named get_my_token');
    if (typeof(witnesses.store_token) !== 'function')
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named store_token');
    if (typeof(witnesses.store_attendance) !== 'function')
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named store_attendance');
    this.witnesses = witnesses;
    this.circuits = {
      createEvent: (...args_0) => {
        if (args_0.length !== 5)
          throw new __compactRuntime.CompactError(`createEvent: expected 5 arguments (as invoked from Typescript), received ${args_0.length}`);
        const contextOrig = args_0[0];
        const eventId = args_0[1];
        const maxSupply = args_0[2];
        const expiration = args_0[3];
        const isPublicMint = args_0[4];
        if (!(typeof(contextOrig) === 'object' && contextOrig.originalState != undefined && contextOrig.transactionContext != undefined))
          __compactRuntime.type_error('createEvent',
                                      'argument 1 (as invoked from Typescript)',
                                      'contracts/compact/poap.compact line 73, char 1',
                                      'CircuitContext',
                                      contextOrig)
        if (!(eventId.buffer instanceof ArrayBuffer && eventId.BYTES_PER_ELEMENT === 1 && eventId.length === 32))
          __compactRuntime.type_error('createEvent',
                                      'argument 1 (argument 2 as invoked from Typescript)',
                                      'contracts/compact/poap.compact line 73, char 1',
                                      'Bytes[32]',
                                      eventId)
        if (!(typeof(maxSupply) === 'bigint' && maxSupply >= 0 && maxSupply <= 18446744073709551615n))
          __compactRuntime.type_error('createEvent',
                                      'argument 2 (argument 3 as invoked from Typescript)',
                                      'contracts/compact/poap.compact line 73, char 1',
                                      'Unsigned Integer[<= 18446744073709551615]',
                                      maxSupply)
        if (!(typeof(expiration) === 'bigint' && expiration >= 0 && expiration <= 18446744073709551615n))
          __compactRuntime.type_error('createEvent',
                                      'argument 3 (argument 4 as invoked from Typescript)',
                                      'contracts/compact/poap.compact line 73, char 1',
                                      'Unsigned Integer[<= 18446744073709551615]',
                                      expiration)
        if (!(typeof(isPublicMint) === 'boolean'))
          __compactRuntime.type_error('createEvent',
                                      'argument 4 (argument 5 as invoked from Typescript)',
                                      'contracts/compact/poap.compact line 73, char 1',
                                      'Boolean',
                                      isPublicMint)
        const context = { ...contextOrig };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(eventId).concat(_descriptor_2.toValue(maxSupply).concat(_descriptor_2.toValue(expiration).concat(_descriptor_1.toValue(isPublicMint)))),
            alignment: _descriptor_0.valueAlignment(eventId).concat(_descriptor_2.valueAlignment(maxSupply).concat(_descriptor_2.valueAlignment(expiration).concat(_descriptor_1.valueAlignment(isPublicMint))))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result = this.#_createEvent_0(context,
                                            partialProofData,
                                            eventId,
                                            maxSupply,
                                            expiration,
                                            isPublicMint);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result, context: context, proofData: partialProofData };
      },
      deactivateEvent: (...args_0) => {
        if (args_0.length !== 2)
          throw new __compactRuntime.CompactError(`deactivateEvent: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
        const contextOrig = args_0[0];
        const eventId = args_0[1];
        if (!(typeof(contextOrig) === 'object' && contextOrig.originalState != undefined && contextOrig.transactionContext != undefined))
          __compactRuntime.type_error('deactivateEvent',
                                      'argument 1 (as invoked from Typescript)',
                                      'contracts/compact/poap.compact line 94, char 1',
                                      'CircuitContext',
                                      contextOrig)
        if (!(eventId.buffer instanceof ArrayBuffer && eventId.BYTES_PER_ELEMENT === 1 && eventId.length === 32))
          __compactRuntime.type_error('deactivateEvent',
                                      'argument 1 (argument 2 as invoked from Typescript)',
                                      'contracts/compact/poap.compact line 94, char 1',
                                      'Bytes[32]',
                                      eventId)
        const context = { ...contextOrig };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(eventId),
            alignment: _descriptor_0.valueAlignment(eventId)
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result = this.#_deactivateEvent_0(context,
                                                partialProofData,
                                                eventId);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result, context: context, proofData: partialProofData };
      },
      claimOrUpdate: (...args_0) => {
        if (args_0.length !== 3)
          throw new __compactRuntime.CompactError(`claimOrUpdate: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
        const contextOrig = args_0[0];
        const eventId = args_0[1];
        const isSoulbound = args_0[2];
        if (!(typeof(contextOrig) === 'object' && contextOrig.originalState != undefined && contextOrig.transactionContext != undefined))
          __compactRuntime.type_error('claimOrUpdate',
                                      'argument 1 (as invoked from Typescript)',
                                      'contracts/compact/poap.compact line 166, char 1',
                                      'CircuitContext',
                                      contextOrig)
        if (!(eventId.buffer instanceof ArrayBuffer && eventId.BYTES_PER_ELEMENT === 1 && eventId.length === 32))
          __compactRuntime.type_error('claimOrUpdate',
                                      'argument 1 (argument 2 as invoked from Typescript)',
                                      'contracts/compact/poap.compact line 166, char 1',
                                      'Bytes[32]',
                                      eventId)
        if (!(typeof(isSoulbound) === 'boolean'))
          __compactRuntime.type_error('claimOrUpdate',
                                      'argument 2 (argument 3 as invoked from Typescript)',
                                      'contracts/compact/poap.compact line 166, char 1',
                                      'Boolean',
                                      isSoulbound)
        const context = { ...contextOrig };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(eventId).concat(_descriptor_1.toValue(isSoulbound)),
            alignment: _descriptor_0.valueAlignment(eventId).concat(_descriptor_1.valueAlignment(isSoulbound))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result = this.#_claimOrUpdate_0(context,
                                              partialProofData,
                                              eventId,
                                              isSoulbound);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result, context: context, proofData: partialProofData };
      },
      getCallerPk: (...args_0) => {
        if (args_0.length !== 1)
          throw new __compactRuntime.CompactError(`getCallerPk: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
        const contextOrig = args_0[0];
        if (!(typeof(contextOrig) === 'object' && contextOrig.originalState != undefined && contextOrig.transactionContext != undefined))
          __compactRuntime.type_error('getCallerPk',
                                      'argument 1 (as invoked from Typescript)',
                                      'contracts/compact/poap.compact line 176, char 1',
                                      'CircuitContext',
                                      contextOrig)
        const context = { ...contextOrig };
        const partialProofData = {
          input: { value: [], alignment: [] },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result = this.#_getCallerPk_0(context, partialProofData);
        partialProofData.output = { value: _descriptor_0.toValue(result), alignment: _descriptor_0.valueAlignment(result) };
        return { result: result, context: context, proofData: partialProofData };
      }
    };
    this.impureCircuits = {
      createEvent: this.circuits.createEvent,
      deactivateEvent: this.circuits.deactivateEvent,
      claimOrUpdate: this.circuits.claimOrUpdate,
      getCallerPk: this.circuits.getCallerPk
    };
  }
  initialState(...args) {
    if (args.length !== 1)
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args.length}`);
    const privateState = args[0];
    const state = new __compactRuntime.ContractState();
    let stateValue = __compactRuntime.StateValue.newArray();
    stateValue = stateValue.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue = stateValue.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue = stateValue.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue = stateValue.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue = stateValue.arrayPush(__compactRuntime.StateValue.newNull());
    state.data = stateValue;
    state.setOperation('createEvent', new __compactRuntime.ContractOperation());
    state.setOperation('deactivateEvent', new __compactRuntime.ContractOperation());
    state.setOperation('claimOrUpdate', new __compactRuntime.ContractOperation());
    state.setOperation('getCallerPk', new __compactRuntime.ContractOperation());
    const context = {
      originalState: state,
      currentPrivateState: privateState,
      transactionContext: new __compactRuntime.QueryContext(state.data, __compactRuntime.dummyContractAddress())
    };
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    Contract._query(context,
                    partialProofData,
                    [
                     { push: { storage: false,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(0n),
                                                                            alignment: _descriptor_6.valueAlignment(0n) }).encode() } },
                     { push: { storage: true,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                            alignment: _descriptor_2.valueAlignment(0n) }).encode() } },
                     { ins: { cached: false, n: 1 } }
                    ])
    Contract._query(context,
                    partialProofData,
                    [
                     { push: { storage: false,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(1n),
                                                                            alignment: _descriptor_6.valueAlignment(1n) }).encode() } },
                     { push: { storage: true,
                               value: __compactRuntime.StateValue.newMap(
                                        new __compactRuntime.StateMap()
                                      ).encode() } },
                     { ins: { cached: false, n: 1 } }
                    ])
    Contract._query(context,
                    partialProofData,
                    [
                     { push: { storage: false,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(2n),
                                                                            alignment: _descriptor_6.valueAlignment(2n) }).encode() } },
                     { push: { storage: true,
                               value: __compactRuntime.StateValue.newMap(
                                        new __compactRuntime.StateMap()
                                      ).encode() } },
                     { ins: { cached: false, n: 1 } }
                    ])
    Contract._query(context,
                    partialProofData,
                    [
                     { push: { storage: false,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(3n),
                                                                            alignment: _descriptor_6.valueAlignment(3n) }).encode() } },
                     { push: { storage: true,
                               value: __compactRuntime.StateValue.newMap(
                                        new __compactRuntime.StateMap()
                                      ).encode() } },
                     { ins: { cached: false, n: 1 } }
                    ])
    Contract._query(context,
                    partialProofData,
                    [
                     { push: { storage: false,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(4n),
                                                                            alignment: _descriptor_6.valueAlignment(4n) }).encode() } },
                     { push: { storage: true,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(new Uint8Array(32)),
                                                                            alignment: _descriptor_0.valueAlignment(new Uint8Array(32)) }).encode() } },
                     { ins: { cached: false, n: 1 } }
                    ])
    const tmp = this.#_derive_pk_0(context,
                                   partialProofData,
                                   this.#_local_sk_0(context, partialProofData));
    Contract._query(context,
                    partialProofData,
                    [
                     { push: { storage: false,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(4n),
                                                                            alignment: _descriptor_6.valueAlignment(4n) }).encode() } },
                     { push: { storage: true,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(tmp),
                                                                            alignment: _descriptor_0.valueAlignment(tmp) }).encode() } },
                     { ins: { cached: false, n: 1 } }
                    ]);
    state.data = context.transactionContext.state;
    return [context.currentPrivateState, state];
  }
  #_persistent_hash_0(context, partialProofData, x, y) {
    return __compactRuntime.persistentHash(x, y);
  }
  #_local_sk_0(context, partialProofData) {
    const contextRef = { context: context.transactionContext };
    const witnessContext = __compactRuntime.witnessContext(ledger, context.currentPrivateState, contextRef);
    const [nextPrivateState, result] = this.witnesses.local_sk(witnessContext);
    context.currentPrivateState = nextPrivateState;
    context.transactionContext = contextRef.context;
    if (!(result.buffer instanceof ArrayBuffer && result.BYTES_PER_ELEMENT === 1 && result.length === 32))
      __compactRuntime.type_error('local_sk',
                                  'return value',
                                  'contracts/compact/poap.compact line 44, char 1',
                                  'Bytes[32]',
                                  result)
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_0.toValue(result),
      alignment: _descriptor_0.valueAlignment(result)
    });
    return result;
  }
  #_get_my_token_0(context, partialProofData) {
    const contextRef = { context: context.transactionContext };
    const witnessContext = __compactRuntime.witnessContext(ledger, context.currentPrivateState, contextRef);
    const [nextPrivateState, result] = this.witnesses.get_my_token(witnessContext);
    context.currentPrivateState = nextPrivateState;
    context.transactionContext = contextRef.context;
    if (!(typeof(result) === 'object' && typeof(result.is_some) === 'boolean' && typeof(result.value) === 'bigint' && result.value >= 0 && result.value <= 18446744073709551615n))
      __compactRuntime.type_error('get_my_token',
                                  'return value',
                                  'contracts/compact/poap.compact line 47, char 1',
                                  'struct Maybe[is_some: Boolean, value: Unsigned Integer[<= 18446744073709551615]]',
                                  result)
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_5.toValue(result),
      alignment: _descriptor_5.valueAlignment(result)
    });
    return result;
  }
  #_store_token_0(context, partialProofData, tokenId, eventId, isSoulbound) {
    const contextRef = { context: context.transactionContext };
    const witnessContext = __compactRuntime.witnessContext(ledger, context.currentPrivateState, contextRef);
    const [nextPrivateState, result] = this.witnesses.store_token(witnessContext,
                                                                  tokenId,
                                                                  eventId,
                                                                  isSoulbound);
    context.currentPrivateState = nextPrivateState;
    context.transactionContext = contextRef.context;
    partialProofData.privateTranscriptOutputs.push({
      value: [],
      alignment: []
    });
    return result;
  }
  #_store_attendance_0(context, partialProofData, tokenId, eventId) {
    const contextRef = { context: context.transactionContext };
    const witnessContext = __compactRuntime.witnessContext(ledger, context.currentPrivateState, contextRef);
    const [nextPrivateState, result] = this.witnesses.store_attendance(witnessContext,
                                                                       tokenId,
                                                                       eventId);
    context.currentPrivateState = nextPrivateState;
    context.transactionContext = contextRef.context;
    partialProofData.privateTranscriptOutputs.push({
      value: [],
      alignment: []
    });
    return result;
  }
  #_derive_pk_0(context, partialProofData, sk) {
    return this.#_persistent_hash_0(context,
                                    partialProofData,
                                    new Uint8Array([97, 100, 97, 115, 111, 117, 108, 115, 58, 112, 107, 58, 118, 49, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                    sk);
  }
  #_caller_pk_0(context, partialProofData) {
    return this.#_derive_pk_0(context,
                              partialProofData,
                              this.#_local_sk_0(context, partialProofData));
  }
  #_is_admin_0(context, partialProofData) {
    return this.#_equal_0(_descriptor_0.fromValue(Contract._query(context,
                                                                  partialProofData,
                                                                  [
                                                                   { dup: { n: 0 } },
                                                                   { idx: { cached: false,
                                                                            pushPath: false,
                                                                            path: [
                                                                                   { tag: 'value',
                                                                                     value: { value: _descriptor_6.toValue(4n),
                                                                                              alignment: _descriptor_6.valueAlignment(4n) } }
                                                                                  ] } },
                                                                   { popeq: { cached: false,
                                                                              result: undefined } }
                                                                  ]).value),
                          this.#_caller_pk_0(context, partialProofData));
  }
  #_createEvent_0(context,
                  partialProofData,
                  eventId,
                  maxSupply,
                  expiration,
                  isPublicMint)
  {
    __compactRuntime.assert(this.#_is_admin_0(context, partialProofData),
                            'Only admin can create events');
    __compactRuntime.assert(!_descriptor_1.fromValue(Contract._query(context,
                                                                     partialProofData,
                                                                     [
                                                                      { dup: { n: 0 } },
                                                                      { idx: { cached: false,
                                                                               pushPath: false,
                                                                               path: [
                                                                                      { tag: 'value',
                                                                                        value: { value: _descriptor_6.toValue(3n),
                                                                                                 alignment: _descriptor_6.valueAlignment(3n) } }
                                                                                     ] } },
                                                                      { push: { storage: false,
                                                                                value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(eventId),
                                                                                                                             alignment: _descriptor_0.valueAlignment(eventId) }).encode() } },
                                                                      'member',
                                                                      { popeq: { cached: true,
                                                                                 result: undefined } }
                                                                     ]).value),
                            'Event already exists');
    const ev = { maxSupply: maxSupply,
                 minted: 0n,
                 expiration: expiration,
                 organizer: this.#_caller_pk_0(context, partialProofData),
                 isActive: true,
                 isPublicMint: isPublicMint };
    Contract._query(context,
                    partialProofData,
                    [
                     { idx: { cached: false,
                              pushPath: true,
                              path: [
                                     { tag: 'value',
                                       value: { value: _descriptor_6.toValue(3n),
                                                alignment: _descriptor_6.valueAlignment(3n) } }
                                    ] } },
                     { push: { storage: false,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(eventId),
                                                                            alignment: _descriptor_0.valueAlignment(eventId) }).encode() } },
                     { push: { storage: true,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(ev),
                                                                            alignment: _descriptor_3.valueAlignment(ev) }).encode() } },
                     { ins: { cached: false, n: 1 } },
                     { ins: { cached: true, n: 1 } }
                    ]);
  }
  #_deactivateEvent_0(context, partialProofData, eventId) {
    __compactRuntime.assert(this.#_is_admin_0(context, partialProofData),
                            'Only admin can deactivate events');
    __compactRuntime.assert(_descriptor_1.fromValue(Contract._query(context,
                                                                    partialProofData,
                                                                    [
                                                                     { dup: { n: 0 } },
                                                                     { idx: { cached: false,
                                                                              pushPath: false,
                                                                              path: [
                                                                                     { tag: 'value',
                                                                                       value: { value: _descriptor_6.toValue(3n),
                                                                                                alignment: _descriptor_6.valueAlignment(3n) } }
                                                                                    ] } },
                                                                     { push: { storage: false,
                                                                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(eventId),
                                                                                                                            alignment: _descriptor_0.valueAlignment(eventId) }).encode() } },
                                                                     'member',
                                                                     { popeq: { cached: true,
                                                                                result: undefined } }
                                                                    ]).value),
                            'Event does not exist');
    const ev = _descriptor_3.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(3n),
                                                                                   alignment: _descriptor_6.valueAlignment(3n) } }
                                                                       ] } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_0.toValue(eventId),
                                                                                   alignment: _descriptor_0.valueAlignment(eventId) } }
                                                                       ] } },
                                                        { popeq: { cached: false,
                                                                   result: undefined } }
                                                       ]).value);
    const updated = { maxSupply: ev.maxSupply,
                      minted: ev.minted,
                      expiration: ev.expiration,
                      organizer: ev.organizer,
                      isActive: false,
                      isPublicMint: ev.isPublicMint };
    Contract._query(context,
                    partialProofData,
                    [
                     { idx: { cached: false,
                              pushPath: true,
                              path: [
                                     { tag: 'value',
                                       value: { value: _descriptor_6.toValue(3n),
                                                alignment: _descriptor_6.valueAlignment(3n) } }
                                    ] } },
                     { push: { storage: false,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(eventId),
                                                                            alignment: _descriptor_0.valueAlignment(eventId) }).encode() } },
                     { push: { storage: true,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(updated),
                                                                            alignment: _descriptor_3.valueAlignment(updated) }).encode() } },
                     { ins: { cached: false, n: 1 } },
                     { ins: { cached: true, n: 1 } }
                    ]);
  }
  #_mintToken_0(context, partialProofData, eventId, isSoulbound) {
    __compactRuntime.assert(_descriptor_1.fromValue(Contract._query(context,
                                                                    partialProofData,
                                                                    [
                                                                     { dup: { n: 0 } },
                                                                     { idx: { cached: false,
                                                                              pushPath: false,
                                                                              path: [
                                                                                     { tag: 'value',
                                                                                       value: { value: _descriptor_6.toValue(3n),
                                                                                                alignment: _descriptor_6.valueAlignment(3n) } }
                                                                                    ] } },
                                                                     { push: { storage: false,
                                                                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(eventId),
                                                                                                                            alignment: _descriptor_0.valueAlignment(eventId) }).encode() } },
                                                                     'member',
                                                                     { popeq: { cached: true,
                                                                                result: undefined } }
                                                                    ]).value),
                            'Event does not exist');
    const ev = _descriptor_3.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(3n),
                                                                                   alignment: _descriptor_6.valueAlignment(3n) } }
                                                                       ] } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_0.toValue(eventId),
                                                                                   alignment: _descriptor_0.valueAlignment(eventId) } }
                                                                       ] } },
                                                        { popeq: { cached: false,
                                                                   result: undefined } }
                                                       ]).value);
    __compactRuntime.assert(ev.isActive, 'Event is not active');
    __compactRuntime.assert(ev.isPublicMint, 'Event requires organizer to mint');
    __compactRuntime.assert(this.#_equal_1(ev.maxSupply, 0n)
                            ||
                            ev.minted < ev.maxSupply,
                            'Event has reached maximum supply');
    const tokenId = _descriptor_2.fromValue(Contract._query(context,
                                                            partialProofData,
                                                            [
                                                             { dup: { n: 0 } },
                                                             { idx: { cached: false,
                                                                      pushPath: false,
                                                                      path: [
                                                                             { tag: 'value',
                                                                               value: { value: _descriptor_6.toValue(0n),
                                                                                        alignment: _descriptor_6.valueAlignment(0n) } }
                                                                            ] } },
                                                             { popeq: { cached: true,
                                                                        result: undefined } }
                                                            ]).value);
    const pk = this.#_caller_pk_0(context, partialProofData);
    const tmp = 1n;
    Contract._query(context,
                    partialProofData,
                    [
                     { idx: { cached: false,
                              pushPath: true,
                              path: [
                                     { tag: 'value',
                                       value: { value: _descriptor_6.toValue(0n),
                                                alignment: _descriptor_6.valueAlignment(0n) } }
                                    ] } },
                     { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                            { value: _descriptor_4.toValue(tmp),
                                              alignment: _descriptor_4.valueAlignment(tmp) }
                                              .value
                                          )) } },
                     { ins: { cached: true, n: 1 } }
                    ]);
    Contract._query(context,
                    partialProofData,
                    [
                     { idx: { cached: false,
                              pushPath: true,
                              path: [
                                     { tag: 'value',
                                       value: { value: _descriptor_6.toValue(1n),
                                                alignment: _descriptor_6.valueAlignment(1n) } }
                                    ] } },
                     { push: { storage: false,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(tokenId),
                                                                            alignment: _descriptor_2.valueAlignment(tokenId) }).encode() } },
                     { push: { storage: true,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(pk),
                                                                            alignment: _descriptor_0.valueAlignment(pk) }).encode() } },
                     { ins: { cached: false, n: 1 } },
                     { ins: { cached: true, n: 1 } }
                    ]);
    Contract._query(context,
                    partialProofData,
                    [
                     { idx: { cached: false,
                              pushPath: true,
                              path: [
                                     { tag: 'value',
                                       value: { value: _descriptor_6.toValue(2n),
                                                alignment: _descriptor_6.valueAlignment(2n) } }
                                    ] } },
                     { push: { storage: false,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(tokenId),
                                                                            alignment: _descriptor_2.valueAlignment(tokenId) }).encode() } },
                     { push: { storage: true,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(eventId),
                                                                            alignment: _descriptor_0.valueAlignment(eventId) }).encode() } },
                     { ins: { cached: false, n: 1 } },
                     { ins: { cached: true, n: 1 } }
                    ]);
    const updatedEv = { maxSupply: ev.maxSupply,
                        minted:
                          ((t1) => {
                            if (t1 > 18446744073709551615n)
                              throw new __compactRuntime.CompactError('contracts/compact/poap.compact line 136, char 6: cast from unsigned value to smaller unsigned value failed: ' + t1 + ' is greater than 18446744073709551615');
                            return t1;
                          })(ev.minted + 1n),
                        expiration: ev.expiration,
                        organizer: ev.organizer,
                        isActive: ev.isActive,
                        isPublicMint: ev.isPublicMint };
    Contract._query(context,
                    partialProofData,
                    [
                     { idx: { cached: false,
                              pushPath: true,
                              path: [
                                     { tag: 'value',
                                       value: { value: _descriptor_6.toValue(3n),
                                                alignment: _descriptor_6.valueAlignment(3n) } }
                                    ] } },
                     { push: { storage: false,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(eventId),
                                                                            alignment: _descriptor_0.valueAlignment(eventId) }).encode() } },
                     { push: { storage: true,
                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(updatedEv),
                                                                            alignment: _descriptor_3.valueAlignment(updatedEv) }).encode() } },
                     { ins: { cached: false, n: 1 } },
                     { ins: { cached: true, n: 1 } }
                    ]);
    this.#_store_token_0(context,
                         partialProofData,
                         tokenId,
                         eventId,
                         isSoulbound);
  }
  #_updateToken_0(context, partialProofData, tokenId, eventId) {
    __compactRuntime.assert(_descriptor_1.fromValue(Contract._query(context,
                                                                    partialProofData,
                                                                    [
                                                                     { dup: { n: 0 } },
                                                                     { idx: { cached: false,
                                                                              pushPath: false,
                                                                              path: [
                                                                                     { tag: 'value',
                                                                                       value: { value: _descriptor_6.toValue(3n),
                                                                                                alignment: _descriptor_6.valueAlignment(3n) } }
                                                                                    ] } },
                                                                     { push: { storage: false,
                                                                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(eventId),
                                                                                                                            alignment: _descriptor_0.valueAlignment(eventId) }).encode() } },
                                                                     'member',
                                                                     { popeq: { cached: true,
                                                                                result: undefined } }
                                                                    ]).value),
                            'Event does not exist');
    const ev = _descriptor_3.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(3n),
                                                                                   alignment: _descriptor_6.valueAlignment(3n) } }
                                                                       ] } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_0.toValue(eventId),
                                                                                   alignment: _descriptor_0.valueAlignment(eventId) } }
                                                                       ] } },
                                                        { popeq: { cached: false,
                                                                   result: undefined } }
                                                       ]).value);
    __compactRuntime.assert(ev.isActive, 'Event is not active');
    __compactRuntime.assert(_descriptor_1.fromValue(Contract._query(context,
                                                                    partialProofData,
                                                                    [
                                                                     { dup: { n: 0 } },
                                                                     { idx: { cached: false,
                                                                              pushPath: false,
                                                                              path: [
                                                                                     { tag: 'value',
                                                                                       value: { value: _descriptor_6.toValue(1n),
                                                                                                alignment: _descriptor_6.valueAlignment(1n) } }
                                                                                    ] } },
                                                                     { push: { storage: false,
                                                                               value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(tokenId),
                                                                                                                            alignment: _descriptor_2.valueAlignment(tokenId) }).encode() } },
                                                                     'member',
                                                                     { popeq: { cached: true,
                                                                                result: undefined } }
                                                                    ]).value),
                            'Token does not exist');
    __compactRuntime.assert(this.#_equal_2(_descriptor_0.fromValue(Contract._query(context,
                                                                                   partialProofData,
                                                                                   [
                                                                                    { dup: { n: 0 } },
                                                                                    { idx: { cached: false,
                                                                                             pushPath: false,
                                                                                             path: [
                                                                                                    { tag: 'value',
                                                                                                      value: { value: _descriptor_6.toValue(1n),
                                                                                                               alignment: _descriptor_6.valueAlignment(1n) } }
                                                                                                   ] } },
                                                                                    { idx: { cached: false,
                                                                                             pushPath: false,
                                                                                             path: [
                                                                                                    { tag: 'value',
                                                                                                      value: { value: _descriptor_2.toValue(tokenId),
                                                                                                               alignment: _descriptor_2.valueAlignment(tokenId) } }
                                                                                                   ] } },
                                                                                    { popeq: { cached: false,
                                                                                               result: undefined } }
                                                                                   ]).value),
                                           this.#_caller_pk_0(context,
                                                              partialProofData)),
                            'Caller does not own this token');
    this.#_store_attendance_0(context, partialProofData, tokenId, eventId);
  }
  #_claimOrUpdate_0(context, partialProofData, eventId, isSoulbound) {
    const maybeToken = this.#_get_my_token_0(context, partialProofData);
    if (maybeToken.is_some) {
      this.#_updateToken_0(context, partialProofData, maybeToken.value, eventId);
    } else {
      this.#_mintToken_0(context, partialProofData, eventId, isSoulbound);
    }
  }
  #_getCallerPk_0(context, partialProofData) {
    return this.#_caller_pk_0(context, partialProofData);
  }
  #_equal_0(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) return false;
    return true;
  }
  #_equal_1(x0, y0) {
    if (x0 !== y0) return false;
    return true;
  }
  #_equal_2(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) return false;
    return true;
  }
  static _query(context, partialProofData, prog) {
    var res;
    try {
      res = context.transactionContext.query(prog);
    } catch (err) {
      throw new __compactRuntime.CompactError(err.toString());
    }
    context.transactionContext = res.context;
    var reads = res.events.filter((e) => e.tag === 'read');
    var i = 0;
    partialProofData.publicTranscript = partialProofData.publicTranscript.concat(prog.map((op) => {
      if(typeof(op) === 'object' && 'popeq' in op) {
        return { popeq: {
          ...op.popeq,
          result: reads[i++].content,
        } };
      } else {
        return op;
      }
    }));
    if(res.events.length == 1 && res.events[0].tag === 'read') {
      return res.events[0].content;
    } else {
      return res.events;
    }
  }
}
function ledger(state) {
  const context = {
    originalState: state,
    transactionContext: new __compactRuntime.QueryContext(state, __compactRuntime.dummyContractAddress())
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    get totalSupply() {
      return _descriptor_2.fromValue(Contract._query(context,
                                                     partialProofData,
                                                     [
                                                      { dup: { n: 0 } },
                                                      { idx: { cached: false,
                                                               pushPath: false,
                                                               path: [
                                                                      { tag: 'value',
                                                                        value: { value: _descriptor_6.toValue(0n),
                                                                                 alignment: _descriptor_6.valueAlignment(0n) } }
                                                                     ] } },
                                                      { popeq: { cached: true,
                                                                 result: undefined } }
                                                     ]).value);
    },
    tokenOwner: {
      isEmpty(...args) {
        if (args.length !== 0)
          throw new __compactRuntime.CompactError(`is_empty: expected 0 arguments, received ${args.length}`);
        return _descriptor_1.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(1n),
                                                                                   alignment: _descriptor_6.valueAlignment(1n) } }
                                                                       ] } },
                                                        'size',
                                                        { push: { storage: false,
                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                                               alignment: _descriptor_2.valueAlignment(0n) }).encode() } },
                                                        'eq',
                                                        { popeq: { cached: true,
                                                                   result: undefined } }
                                                       ]).value);
      },
      size(...args) {
        if (args.length !== 0)
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args.length}`);
        return _descriptor_2.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(1n),
                                                                                   alignment: _descriptor_6.valueAlignment(1n) } }
                                                                       ] } },
                                                        'size',
                                                        { popeq: { cached: true,
                                                                   result: undefined } }
                                                       ]).value);
      },
      member(...args) {
        if (args.length !== 1)
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args.length}`);
        const key = args[0];
        if (!(typeof(key) === 'bigint' && key >= 0 && key <= 18446744073709551615n))
          __compactRuntime.type_error('member',
                                      'argument 1',
                                      'contracts/compact/poap.compact line 22, char 3',
                                      'Unsigned Integer[<= 18446744073709551615]',
                                      key)
        return _descriptor_1.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(1n),
                                                                                   alignment: _descriptor_6.valueAlignment(1n) } }
                                                                       ] } },
                                                        { push: { storage: false,
                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(key),
                                                                                                               alignment: _descriptor_2.valueAlignment(key) }).encode() } },
                                                        'member',
                                                        { popeq: { cached: true,
                                                                   result: undefined } }
                                                       ]).value);
      },
      lookup(...args) {
        if (args.length !== 1)
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args.length}`);
        const key = args[0];
        if (!(typeof(key) === 'bigint' && key >= 0 && key <= 18446744073709551615n))
          __compactRuntime.type_error('lookup',
                                      'argument 1',
                                      'contracts/compact/poap.compact line 22, char 3',
                                      'Unsigned Integer[<= 18446744073709551615]',
                                      key)
        return _descriptor_0.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(1n),
                                                                                   alignment: _descriptor_6.valueAlignment(1n) } }
                                                                       ] } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_2.toValue(key),
                                                                                   alignment: _descriptor_2.valueAlignment(key) } }
                                                                       ] } },
                                                        { popeq: { cached: false,
                                                                   result: undefined } }
                                                       ]).value);
      },
      [Symbol.iterator](...args) {
        if (args.length !== 0)
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args.length}`);
        const self = state.asArray()[1];
        return self.asMap().keys().map(  (key) => {    const value = self.asMap().get(key).asCell();    return [      _descriptor_2.fromValue(key.value),      _descriptor_0.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    tokenFirstEvent: {
      isEmpty(...args) {
        if (args.length !== 0)
          throw new __compactRuntime.CompactError(`is_empty: expected 0 arguments, received ${args.length}`);
        return _descriptor_1.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(2n),
                                                                                   alignment: _descriptor_6.valueAlignment(2n) } }
                                                                       ] } },
                                                        'size',
                                                        { push: { storage: false,
                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                                               alignment: _descriptor_2.valueAlignment(0n) }).encode() } },
                                                        'eq',
                                                        { popeq: { cached: true,
                                                                   result: undefined } }
                                                       ]).value);
      },
      size(...args) {
        if (args.length !== 0)
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args.length}`);
        return _descriptor_2.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(2n),
                                                                                   alignment: _descriptor_6.valueAlignment(2n) } }
                                                                       ] } },
                                                        'size',
                                                        { popeq: { cached: true,
                                                                   result: undefined } }
                                                       ]).value);
      },
      member(...args) {
        if (args.length !== 1)
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args.length}`);
        const key = args[0];
        if (!(typeof(key) === 'bigint' && key >= 0 && key <= 18446744073709551615n))
          __compactRuntime.type_error('member',
                                      'argument 1',
                                      'contracts/compact/poap.compact line 25, char 3',
                                      'Unsigned Integer[<= 18446744073709551615]',
                                      key)
        return _descriptor_1.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(2n),
                                                                                   alignment: _descriptor_6.valueAlignment(2n) } }
                                                                       ] } },
                                                        { push: { storage: false,
                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(key),
                                                                                                               alignment: _descriptor_2.valueAlignment(key) }).encode() } },
                                                        'member',
                                                        { popeq: { cached: true,
                                                                   result: undefined } }
                                                       ]).value);
      },
      lookup(...args) {
        if (args.length !== 1)
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args.length}`);
        const key = args[0];
        if (!(typeof(key) === 'bigint' && key >= 0 && key <= 18446744073709551615n))
          __compactRuntime.type_error('lookup',
                                      'argument 1',
                                      'contracts/compact/poap.compact line 25, char 3',
                                      'Unsigned Integer[<= 18446744073709551615]',
                                      key)
        return _descriptor_0.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(2n),
                                                                                   alignment: _descriptor_6.valueAlignment(2n) } }
                                                                       ] } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_2.toValue(key),
                                                                                   alignment: _descriptor_2.valueAlignment(key) } }
                                                                       ] } },
                                                        { popeq: { cached: false,
                                                                   result: undefined } }
                                                       ]).value);
      },
      [Symbol.iterator](...args) {
        if (args.length !== 0)
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args.length}`);
        const self = state.asArray()[2];
        return self.asMap().keys().map(  (key) => {    const value = self.asMap().get(key).asCell();    return [      _descriptor_2.fromValue(key.value),      _descriptor_0.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    events: {
      isEmpty(...args) {
        if (args.length !== 0)
          throw new __compactRuntime.CompactError(`is_empty: expected 0 arguments, received ${args.length}`);
        return _descriptor_1.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(3n),
                                                                                   alignment: _descriptor_6.valueAlignment(3n) } }
                                                                       ] } },
                                                        'size',
                                                        { push: { storage: false,
                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                                               alignment: _descriptor_2.valueAlignment(0n) }).encode() } },
                                                        'eq',
                                                        { popeq: { cached: true,
                                                                   result: undefined } }
                                                       ]).value);
      },
      size(...args) {
        if (args.length !== 0)
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args.length}`);
        return _descriptor_2.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(3n),
                                                                                   alignment: _descriptor_6.valueAlignment(3n) } }
                                                                       ] } },
                                                        'size',
                                                        { popeq: { cached: true,
                                                                   result: undefined } }
                                                       ]).value);
      },
      member(...args) {
        if (args.length !== 1)
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args.length}`);
        const key = args[0];
        if (!(key.buffer instanceof ArrayBuffer && key.BYTES_PER_ELEMENT === 1 && key.length === 32))
          __compactRuntime.type_error('member',
                                      'argument 1',
                                      'contracts/compact/poap.compact line 28, char 3',
                                      'Bytes[32]',
                                      key)
        return _descriptor_1.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(3n),
                                                                                   alignment: _descriptor_6.valueAlignment(3n) } }
                                                                       ] } },
                                                        { push: { storage: false,
                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(key),
                                                                                                               alignment: _descriptor_0.valueAlignment(key) }).encode() } },
                                                        'member',
                                                        { popeq: { cached: true,
                                                                   result: undefined } }
                                                       ]).value);
      },
      lookup(...args) {
        if (args.length !== 1)
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args.length}`);
        const key = args[0];
        if (!(key.buffer instanceof ArrayBuffer && key.BYTES_PER_ELEMENT === 1 && key.length === 32))
          __compactRuntime.type_error('lookup',
                                      'argument 1',
                                      'contracts/compact/poap.compact line 28, char 3',
                                      'Bytes[32]',
                                      key)
        return _descriptor_3.fromValue(Contract._query(context,
                                                       partialProofData,
                                                       [
                                                        { dup: { n: 0 } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_6.toValue(3n),
                                                                                   alignment: _descriptor_6.valueAlignment(3n) } }
                                                                       ] } },
                                                        { idx: { cached: false,
                                                                 pushPath: false,
                                                                 path: [
                                                                        { tag: 'value',
                                                                          value: { value: _descriptor_0.toValue(key),
                                                                                   alignment: _descriptor_0.valueAlignment(key) } }
                                                                       ] } },
                                                        { popeq: { cached: false,
                                                                   result: undefined } }
                                                       ]).value);
      },
      [Symbol.iterator](...args) {
        if (args.length !== 0)
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args.length}`);
        const self = state.asArray()[3];
        return self.asMap().keys().map(  (key) => {    const value = self.asMap().get(key).asCell();    return [      _descriptor_0.fromValue(key.value),      _descriptor_3.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    get adminPk() {
      return _descriptor_0.fromValue(Contract._query(context,
                                                     partialProofData,
                                                     [
                                                      { dup: { n: 0 } },
                                                      { idx: { cached: false,
                                                               pushPath: false,
                                                               path: [
                                                                      { tag: 'value',
                                                                        value: { value: _descriptor_6.toValue(4n),
                                                                                 alignment: _descriptor_6.valueAlignment(4n) } }
                                                                     ] } },
                                                      { popeq: { cached: false,
                                                                 result: undefined } }
                                                     ]).value);
    }
  };
}
const _emptyContext = {
  originalState: new __compactRuntime.ContractState(),
  transactionContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  local_sk: (...args) => undefined,
  get_my_token: (...args) => undefined,
  store_token: (...args) => undefined,
  store_attendance: (...args) => undefined
});
const pureCircuits = { };
exports.Contract = Contract;
exports.ledger = ledger;
exports.pureCircuits = pureCircuits;
//# sourceMappingURL=index.cjs.map
