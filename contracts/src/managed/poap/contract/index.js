import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.16.0');

const _descriptor_0 = __compactRuntime.CompactTypeBoolean;

const _descriptor_1 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

const _descriptor_2 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_3 = __compactRuntime.CompactTypeOpaqueString;

class _EventRecord_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_2.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_3.alignment().concat(_descriptor_2.alignment())))))));
  }
  fromValue(value_0) {
    return {
      maxSupply: _descriptor_1.fromValue(value_0),
      minted: _descriptor_1.fromValue(value_0),
      expiration: _descriptor_1.fromValue(value_0),
      organizer: _descriptor_2.fromValue(value_0),
      isActive: _descriptor_0.fromValue(value_0),
      isPublicMint: _descriptor_0.fromValue(value_0),
      metadataURI: _descriptor_3.fromValue(value_0),
      privateMetadataCommit: _descriptor_2.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.maxSupply).concat(_descriptor_1.toValue(value_0.minted).concat(_descriptor_1.toValue(value_0.expiration).concat(_descriptor_2.toValue(value_0.organizer).concat(_descriptor_0.toValue(value_0.isActive).concat(_descriptor_0.toValue(value_0.isPublicMint).concat(_descriptor_3.toValue(value_0.metadataURI).concat(_descriptor_2.toValue(value_0.privateMetadataCommit))))))));
  }
}

const _descriptor_4 = new _EventRecord_0();

const _descriptor_5 = new __compactRuntime.CompactTypeUnsignedInteger(65535n, 2);

class _IssuerRecord_0 {
  alignment() {
    return _descriptor_2.alignment().concat(_descriptor_0.alignment());
  }
  fromValue(value_0) {
    return {
      organizerPk: _descriptor_2.fromValue(value_0),
      isActive: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_2.toValue(value_0.organizerPk).concat(_descriptor_0.toValue(value_0.isActive));
  }
}

const _descriptor_6 = new _IssuerRecord_0();

const _descriptor_7 = new __compactRuntime.CompactTypeVector(2, _descriptor_2);

const _descriptor_8 = new __compactRuntime.CompactTypeVector(3, _descriptor_2);

class _Either_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_2.alignment().concat(_descriptor_2.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_0.fromValue(value_0),
      left: _descriptor_2.fromValue(value_0),
      right: _descriptor_2.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.is_left).concat(_descriptor_2.toValue(value_0.left).concat(_descriptor_2.toValue(value_0.right)));
  }
}

const _descriptor_9 = new _Either_0();

const _descriptor_10 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_2.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_2.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_2.toValue(value_0.bytes);
  }
}

const _descriptor_11 = new _ContractAddress_0();

const _descriptor_12 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.local_sk) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named local_sk');
    }
    if (typeof(witnesses_0.store_token) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named store_token');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      pause: (...args_1) => {
        if (args_1.length !== 1) {
          throw new __compactRuntime.CompactError(`pause: expected 1 argument (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('pause',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 143 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: { value: [], alignment: [] },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._pause_0(context, partialProofData);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      unpause: (...args_1) => {
        if (args_1.length !== 1) {
          throw new __compactRuntime.CompactError(`unpause: expected 1 argument (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('unpause',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 148 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: { value: [], alignment: [] },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._unpause_0(context, partialProofData);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      registerIssuer: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`registerIssuer: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerPk_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('registerIssuer',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 159 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerPk_0.buffer instanceof ArrayBuffer && issuerPk_0.BYTES_PER_ELEMENT === 1 && issuerPk_0.length === 32)) {
          __compactRuntime.typeError('registerIssuer',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'poap.compact line 159 char 1',
                                     'Bytes<32>',
                                     issuerPk_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_2.toValue(issuerPk_0),
            alignment: _descriptor_2.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._registerIssuer_0(context,
                                                partialProofData,
                                                issuerPk_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      deactivateIssuer: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`deactivateIssuer: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerPk_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('deactivateIssuer',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 169 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerPk_0.buffer instanceof ArrayBuffer && issuerPk_0.BYTES_PER_ELEMENT === 1 && issuerPk_0.length === 32)) {
          __compactRuntime.typeError('deactivateIssuer',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'poap.compact line 169 char 1',
                                     'Bytes<32>',
                                     issuerPk_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_2.toValue(issuerPk_0),
            alignment: _descriptor_2.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._deactivateIssuer_0(context,
                                                  partialProofData,
                                                  issuerPk_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      createEvent: (...args_1) => {
        if (args_1.length !== 7) {
          throw new __compactRuntime.CompactError(`createEvent: expected 7 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const eventId_0 = args_1[1];
        const maxSupply_0 = args_1[2];
        const expiration_0 = args_1[3];
        const isPublicMint_0 = args_1[4];
        const metadataURI_0 = args_1[5];
        const privateMetadataCommit_0 = args_1[6];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('createEvent',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 192 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(eventId_0.buffer instanceof ArrayBuffer && eventId_0.BYTES_PER_ELEMENT === 1 && eventId_0.length === 32)) {
          __compactRuntime.typeError('createEvent',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'poap.compact line 192 char 1',
                                     'Bytes<32>',
                                     eventId_0)
        }
        if (!(typeof(maxSupply_0) === 'bigint' && maxSupply_0 >= 0n && maxSupply_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('createEvent',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'poap.compact line 192 char 1',
                                     'Uint<0..18446744073709551616>',
                                     maxSupply_0)
        }
        if (!(typeof(expiration_0) === 'bigint' && expiration_0 >= 0n && expiration_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('createEvent',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'poap.compact line 192 char 1',
                                     'Uint<0..18446744073709551616>',
                                     expiration_0)
        }
        if (!(typeof(isPublicMint_0) === 'boolean')) {
          __compactRuntime.typeError('createEvent',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'poap.compact line 192 char 1',
                                     'Boolean',
                                     isPublicMint_0)
        }
        if (!(privateMetadataCommit_0.buffer instanceof ArrayBuffer && privateMetadataCommit_0.BYTES_PER_ELEMENT === 1 && privateMetadataCommit_0.length === 32)) {
          __compactRuntime.typeError('createEvent',
                                     'argument 6 (argument 7 as invoked from Typescript)',
                                     'poap.compact line 192 char 1',
                                     'Bytes<32>',
                                     privateMetadataCommit_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_2.toValue(eventId_0).concat(_descriptor_1.toValue(maxSupply_0).concat(_descriptor_1.toValue(expiration_0).concat(_descriptor_0.toValue(isPublicMint_0).concat(_descriptor_3.toValue(metadataURI_0).concat(_descriptor_2.toValue(privateMetadataCommit_0)))))),
            alignment: _descriptor_2.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_0.alignment().concat(_descriptor_3.alignment().concat(_descriptor_2.alignment())))))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._createEvent_0(context,
                                             partialProofData,
                                             eventId_0,
                                             maxSupply_0,
                                             expiration_0,
                                             isPublicMint_0,
                                             metadataURI_0,
                                             privateMetadataCommit_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      deactivateEvent: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`deactivateEvent: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const eventId_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('deactivateEvent',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 222 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(eventId_0.buffer instanceof ArrayBuffer && eventId_0.BYTES_PER_ELEMENT === 1 && eventId_0.length === 32)) {
          __compactRuntime.typeError('deactivateEvent',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'poap.compact line 222 char 1',
                                     'Bytes<32>',
                                     eventId_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_2.toValue(eventId_0),
            alignment: _descriptor_2.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._deactivateEvent_0(context,
                                                 partialProofData,
                                                 eventId_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      claim: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`claim: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const eventId_0 = args_1[1];
        const isSoulbound_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('claim',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 292 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(eventId_0.buffer instanceof ArrayBuffer && eventId_0.BYTES_PER_ELEMENT === 1 && eventId_0.length === 32)) {
          __compactRuntime.typeError('claim',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'poap.compact line 292 char 1',
                                     'Bytes<32>',
                                     eventId_0)
        }
        if (!(typeof(isSoulbound_0) === 'boolean')) {
          __compactRuntime.typeError('claim',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'poap.compact line 292 char 1',
                                     'Boolean',
                                     isSoulbound_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_2.toValue(eventId_0).concat(_descriptor_0.toValue(isSoulbound_0)),
            alignment: _descriptor_2.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._claim_0(context,
                                       partialProofData,
                                       eventId_0,
                                       isSoulbound_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      mintTo: (...args_1) => {
        if (args_1.length !== 5) {
          throw new __compactRuntime.CompactError(`mintTo: expected 5 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const eventId_0 = args_1[1];
        const recipientPk_0 = args_1[2];
        const tokenMetadataURI_0 = args_1[3];
        const tokenPrivateMetadataCommit_0 = args_1[4];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('mintTo',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 313 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(eventId_0.buffer instanceof ArrayBuffer && eventId_0.BYTES_PER_ELEMENT === 1 && eventId_0.length === 32)) {
          __compactRuntime.typeError('mintTo',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'poap.compact line 313 char 1',
                                     'Bytes<32>',
                                     eventId_0)
        }
        if (!(recipientPk_0.buffer instanceof ArrayBuffer && recipientPk_0.BYTES_PER_ELEMENT === 1 && recipientPk_0.length === 32)) {
          __compactRuntime.typeError('mintTo',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'poap.compact line 313 char 1',
                                     'Bytes<32>',
                                     recipientPk_0)
        }
        if (!(tokenPrivateMetadataCommit_0.buffer instanceof ArrayBuffer && tokenPrivateMetadataCommit_0.BYTES_PER_ELEMENT === 1 && tokenPrivateMetadataCommit_0.length === 32)) {
          __compactRuntime.typeError('mintTo',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'poap.compact line 313 char 1',
                                     'Bytes<32>',
                                     tokenPrivateMetadataCommit_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_2.toValue(eventId_0).concat(_descriptor_2.toValue(recipientPk_0).concat(_descriptor_3.toValue(tokenMetadataURI_0).concat(_descriptor_2.toValue(tokenPrivateMetadataCommit_0)))),
            alignment: _descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_3.alignment().concat(_descriptor_2.alignment())))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._mintTo_0(context,
                                        partialProofData,
                                        eventId_0,
                                        recipientPk_0,
                                        tokenMetadataURI_0,
                                        tokenPrivateMetadataCommit_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      burn: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`burn: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const tokenId_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('burn',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 340 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(tokenId_0) === 'bigint' && tokenId_0 >= 0n && tokenId_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('burn',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'poap.compact line 340 char 1',
                                     'Uint<0..18446744073709551616>',
                                     tokenId_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(tokenId_0),
            alignment: _descriptor_1.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._burn_0(context, partialProofData, tokenId_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      getCallerPk: (...args_1) => {
        if (args_1.length !== 1) {
          throw new __compactRuntime.CompactError(`getCallerPk: expected 1 argument (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('getCallerPk',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 356 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: { value: [], alignment: [] },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._getCallerPk_0(context, partialProofData);
        partialProofData.output = { value: _descriptor_2.toValue(result_0), alignment: _descriptor_2.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      getHolderPk: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`getHolderPk: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const issuerId_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('getHolderPk',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 363 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(issuerId_0.buffer instanceof ArrayBuffer && issuerId_0.BYTES_PER_ELEMENT === 1 && issuerId_0.length === 32)) {
          __compactRuntime.typeError('getHolderPk',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'poap.compact line 363 char 1',
                                     'Bytes<32>',
                                     issuerId_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_2.toValue(issuerId_0),
            alignment: _descriptor_2.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._getHolderPk_0(context,
                                             partialProofData,
                                             issuerId_0);
        partialProofData.output = { value: _descriptor_2.toValue(result_0), alignment: _descriptor_2.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      computePrivateMetadataCommit(context, ...args_1) {
        return { result: pureCircuits.computePrivateMetadataCommit(...args_1), context };
      },
      revealPrivateMetadata: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`revealPrivateMetadata: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const eventId_0 = args_1[1];
        const value_0 = args_1[2];
        const rand_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('revealPrivateMetadata',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 385 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(eventId_0.buffer instanceof ArrayBuffer && eventId_0.BYTES_PER_ELEMENT === 1 && eventId_0.length === 32)) {
          __compactRuntime.typeError('revealPrivateMetadata',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'poap.compact line 385 char 1',
                                     'Bytes<32>',
                                     eventId_0)
        }
        if (!(value_0.buffer instanceof ArrayBuffer && value_0.BYTES_PER_ELEMENT === 1 && value_0.length === 32)) {
          __compactRuntime.typeError('revealPrivateMetadata',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'poap.compact line 385 char 1',
                                     'Bytes<32>',
                                     value_0)
        }
        if (!(rand_0.buffer instanceof ArrayBuffer && rand_0.BYTES_PER_ELEMENT === 1 && rand_0.length === 32)) {
          __compactRuntime.typeError('revealPrivateMetadata',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'poap.compact line 385 char 1',
                                     'Bytes<32>',
                                     rand_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_2.toValue(eventId_0).concat(_descriptor_2.toValue(value_0).concat(_descriptor_2.toValue(rand_0))),
            alignment: _descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_2.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._revealPrivateMetadata_0(context,
                                                       partialProofData,
                                                       eventId_0,
                                                       value_0,
                                                       rand_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      revealPrivateTokenMetadata: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`revealPrivateTokenMetadata: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const tokenId_0 = args_1[1];
        const value_0 = args_1[2];
        const rand_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('revealPrivateTokenMetadata',
                                     'argument 1 (as invoked from Typescript)',
                                     'poap.compact line 399 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(tokenId_0) === 'bigint' && tokenId_0 >= 0n && tokenId_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('revealPrivateTokenMetadata',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'poap.compact line 399 char 1',
                                     'Uint<0..18446744073709551616>',
                                     tokenId_0)
        }
        if (!(value_0.buffer instanceof ArrayBuffer && value_0.BYTES_PER_ELEMENT === 1 && value_0.length === 32)) {
          __compactRuntime.typeError('revealPrivateTokenMetadata',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'poap.compact line 399 char 1',
                                     'Bytes<32>',
                                     value_0)
        }
        if (!(rand_0.buffer instanceof ArrayBuffer && rand_0.BYTES_PER_ELEMENT === 1 && rand_0.length === 32)) {
          __compactRuntime.typeError('revealPrivateTokenMetadata',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'poap.compact line 399 char 1',
                                     'Bytes<32>',
                                     rand_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(tokenId_0).concat(_descriptor_2.toValue(value_0).concat(_descriptor_2.toValue(rand_0))),
            alignment: _descriptor_1.alignment().concat(_descriptor_2.alignment().concat(_descriptor_2.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._revealPrivateTokenMetadata_0(context,
                                                            partialProofData,
                                                            tokenId_0,
                                                            value_0,
                                                            rand_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      }
    };
    this.impureCircuits = {
      pause: this.circuits.pause,
      unpause: this.circuits.unpause,
      registerIssuer: this.circuits.registerIssuer,
      deactivateIssuer: this.circuits.deactivateIssuer,
      createEvent: this.circuits.createEvent,
      deactivateEvent: this.circuits.deactivateEvent,
      claim: this.circuits.claim,
      mintTo: this.circuits.mintTo,
      burn: this.circuits.burn,
      getCallerPk: this.circuits.getCallerPk,
      getHolderPk: this.circuits.getHolderPk,
      revealPrivateMetadata: this.circuits.revealPrivateMetadata,
      revealPrivateTokenMetadata: this.circuits.revealPrivateTokenMetadata
    };
    this.provableCircuits = {
      pause: this.circuits.pause,
      unpause: this.circuits.unpause,
      registerIssuer: this.circuits.registerIssuer,
      deactivateIssuer: this.circuits.deactivateIssuer,
      createEvent: this.circuits.createEvent,
      deactivateEvent: this.circuits.deactivateEvent,
      claim: this.circuits.claim,
      mintTo: this.circuits.mintTo,
      burn: this.circuits.burn,
      revealPrivateMetadata: this.circuits.revealPrivateMetadata,
      revealPrivateTokenMetadata: this.circuits.revealPrivateTokenMetadata
    };
  }
  initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('pause', new __compactRuntime.ContractOperation());
    state_0.setOperation('unpause', new __compactRuntime.ContractOperation());
    state_0.setOperation('registerIssuer', new __compactRuntime.ContractOperation());
    state_0.setOperation('deactivateIssuer', new __compactRuntime.ContractOperation());
    state_0.setOperation('createEvent', new __compactRuntime.ContractOperation());
    state_0.setOperation('deactivateEvent', new __compactRuntime.ContractOperation());
    state_0.setOperation('claim', new __compactRuntime.ContractOperation());
    state_0.setOperation('mintTo', new __compactRuntime.ContractOperation());
    state_0.setOperation('burn', new __compactRuntime.ContractOperation());
    state_0.setOperation('revealPrivateMetadata', new __compactRuntime.ContractOperation());
    state_0.setOperation('revealPrivateTokenMetadata', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(0n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(1n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(2n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(3n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(4n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(5n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(6n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(7n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(8n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(9n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(10n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(11n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(12n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(false),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(13n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_0 = this._derive_pk_0(this._local_sk_0(context, partialProofData));
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(13n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(tmp_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(12n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(false),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_7, value_0);
    return result_0;
  }
  _persistentHash_1(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_8, value_0);
    return result_0;
  }
  _persistentCommit_0(value_0, rand_0) {
    const result_0 = __compactRuntime.persistentCommit(_descriptor_2,
                                                       value_0,
                                                       rand_0);
    return result_0;
  }
  _local_sk_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.local_sk(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('local_sk',
                                 'return value',
                                 'poap.compact line 92 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _store_token_0(context,
                 partialProofData,
                 tokenId_0,
                 issuerId_0,
                 eventId_0,
                 isSoulbound_0)
  {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.store_token(witnessContext_0,
                                                                      tokenId_0,
                                                                      issuerId_0,
                                                                      eventId_0,
                                                                      isSoulbound_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(Array.isArray(result_0) && result_0.length === 0 )) {
      __compactRuntime.typeError('store_token',
                                 'return value',
                                 'poap.compact line 95 char 1',
                                 '[]',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: [],
      alignment: []
    });
    return result_0;
  }
  _derive_pk_0(sk_0) {
    return this._persistentHash_0([new Uint8Array([97, 100, 97, 115, 111, 117, 108, 115, 58, 112, 107, 58, 118, 49, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   sk_0]);
  }
  _caller_pk_0(context, partialProofData) {
    return this._derive_pk_0(this._local_sk_0(context, partialProofData));
  }
  _holder_pk_0(context, partialProofData, issuerId_0) {
    return this._persistentHash_1([new Uint8Array([97, 100, 97, 115, 111, 117, 108, 115, 58, 104, 111, 108, 100, 101, 114, 45, 112, 107, 58, 118, 49, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   this._local_sk_0(context, partialProofData),
                                   issuerId_0]);
  }
  _holder_event_key_0(holderPk_0, eventId_0) {
    return this._persistentHash_0([new Uint8Array([97, 100, 97, 115, 111, 117, 108, 115, 58, 104, 111, 108, 100, 101, 114, 45, 101, 118, 101, 110, 116, 58, 118, 49, 58, 0, 0, 0, 0, 0, 0, 0]),
                                   this._persistentHash_0([holderPk_0, eventId_0])]);
  }
  _is_admin_0(context, partialProofData) {
    return this._equal_0(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                   partialProofData,
                                                                                   [
                                                                                    { dup: { n: 0 } },
                                                                                    { idx: { cached: false,
                                                                                             pushPath: false,
                                                                                             path: [
                                                                                                    { tag: 'value',
                                                                                                      value: { value: _descriptor_12.toValue(13n),
                                                                                                               alignment: _descriptor_12.alignment() } }] } },
                                                                                    { popeq: { cached: false,
                                                                                               result: undefined } }]).value),
                         this._caller_pk_0(context, partialProofData));
  }
  _pause_0(context, partialProofData) {
    __compactRuntime.assert(this._is_admin_0(context, partialProofData),
                            'Only admin can pause');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(12n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(true),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _unpause_0(context, partialProofData) {
    __compactRuntime.assert(this._is_admin_0(context, partialProofData),
                            'Only admin can unpause');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_12.toValue(12n),
                                                                                              alignment: _descriptor_12.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(false),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _registerIssuer_0(context, partialProofData, issuerPk_0) {
    const pk_0 = issuerPk_0;
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(12n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { popeq: { cached: false,
                                                                                                   result: undefined } }]).value),
                            'Contract is paused');
    __compactRuntime.assert(this._is_admin_0(context, partialProofData),
                            'Only admin can register issuers');
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(10n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(pk_0),
                                                                                                                                               alignment: _descriptor_2.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Issuer already registered');
    const issuer_0 = { organizerPk: pk_0, isActive: true };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(10n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(pk_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(issuer_0),
                                                                                              alignment: _descriptor_6.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _deactivateIssuer_0(context, partialProofData, issuerPk_0) {
    const pk_0 = issuerPk_0;
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(12n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { popeq: { cached: false,
                                                                                                   result: undefined } }]).value),
                            'Contract is paused');
    __compactRuntime.assert(this._is_admin_0(context, partialProofData),
                            'Only admin can deactivate issuers');
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_12.toValue(10n),
                                                                                                                  alignment: _descriptor_12.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(pk_0),
                                                                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Issuer does not exist');
    const existing_0 = _descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                 partialProofData,
                                                                                 [
                                                                                  { dup: { n: 0 } },
                                                                                  { idx: { cached: false,
                                                                                           pushPath: false,
                                                                                           path: [
                                                                                                  { tag: 'value',
                                                                                                    value: { value: _descriptor_12.toValue(10n),
                                                                                                             alignment: _descriptor_12.alignment() } }] } },
                                                                                  { idx: { cached: false,
                                                                                           pushPath: false,
                                                                                           path: [
                                                                                                  { tag: 'value',
                                                                                                    value: { value: _descriptor_2.toValue(pk_0),
                                                                                                             alignment: _descriptor_2.alignment() } }] } },
                                                                                  { popeq: { cached: false,
                                                                                             result: undefined } }]).value);
    const updated_0 = { organizerPk: existing_0.organizerPk, isActive: false };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(10n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(pk_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(updated_0),
                                                                                              alignment: _descriptor_6.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _createEvent_0(context,
                 partialProofData,
                 eventId_0,
                 maxSupply_0,
                 expiration_0,
                 isPublicMint_0,
                 metadataURI_0,
                 privateMetadataCommit_0)
  {
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(12n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { popeq: { cached: false,
                                                                                                   result: undefined } }]).value),
                            'Contract is paused');
    const evId_0 = eventId_0;
    const maxS_0 = maxSupply_0;
    const exp_0 = expiration_0;
    const pubMint_0 = isPublicMint_0;
    const metaURI_0 = metadataURI_0;
    const privCommit_0 = privateMetadataCommit_0;
    const issuerId_0 = this._caller_pk_0(context, partialProofData);
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(8n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(evId_0),
                                                                                                                                               alignment: _descriptor_2.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Event already exists');
    const ev_0 = { maxSupply: maxS_0,
                   minted: 0n,
                   expiration: exp_0,
                   organizer: issuerId_0,
                   isActive: true,
                   isPublicMint: pubMint_0,
                   metadataURI: metaURI_0,
                   privateMetadataCommit: privCommit_0 };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(8n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(evId_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(ev_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _deactivateEvent_0(context, partialProofData, eventId_0) {
    const evId_0 = eventId_0;
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(12n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { popeq: { cached: false,
                                                                                                   result: undefined } }]).value),
                            'Contract is paused');
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_12.toValue(8n),
                                                                                                                  alignment: _descriptor_12.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(evId_0),
                                                                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Event does not exist');
    const ev_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                           partialProofData,
                                                                           [
                                                                            { dup: { n: 0 } },
                                                                            { idx: { cached: false,
                                                                                     pushPath: false,
                                                                                     path: [
                                                                                            { tag: 'value',
                                                                                              value: { value: _descriptor_12.toValue(8n),
                                                                                                       alignment: _descriptor_12.alignment() } }] } },
                                                                            { idx: { cached: false,
                                                                                     pushPath: false,
                                                                                     path: [
                                                                                            { tag: 'value',
                                                                                              value: { value: _descriptor_2.toValue(evId_0),
                                                                                                       alignment: _descriptor_2.alignment() } }] } },
                                                                            { popeq: { cached: false,
                                                                                       result: undefined } }]).value);
    __compactRuntime.assert(this._is_admin_0(context, partialProofData)
                            ||
                            this._equal_1(ev_0.organizer,
                                          this._caller_pk_0(context,
                                                            partialProofData)),
                            'Not authorized');
    const updated_0 = { maxSupply: ev_0.maxSupply,
                        minted: ev_0.minted,
                        expiration: ev_0.expiration,
                        organizer: ev_0.organizer,
                        isActive: false,
                        isPublicMint: ev_0.isPublicMint,
                        metadataURI: ev_0.metadataURI,
                        privateMetadataCommit: ev_0.privateMetadataCommit };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(8n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(evId_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(updated_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _mintTokenTo_0(context,
                 partialProofData,
                 pk_0,
                 eventId_0,
                 ev_0,
                 tokenMetaURI_0,
                 tokenPrivCommit_0)
  {
    __compactRuntime.assert(ev_0.isActive, 'Event is not active');
    let t_0;
    __compactRuntime.assert(this._equal_2(ev_0.maxSupply, 0n)
                            ||
                            (t_0 = ev_0.minted, t_0 < ev_0.maxSupply),
                            'Event has reached maximum supply');
    const key_0 = this._holder_event_key_0(pk_0, eventId_0);
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(7n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(key_0),
                                                                                                                                               alignment: _descriptor_2.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Wallet already claimed this event');
    const tokenId_0 = _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                partialProofData,
                                                                                [
                                                                                 { dup: { n: 0 } },
                                                                                 { idx: { cached: false,
                                                                                          pushPath: false,
                                                                                          path: [
                                                                                                 { tag: 'value',
                                                                                                   value: { value: _descriptor_12.toValue(0n),
                                                                                                            alignment: _descriptor_12.alignment() } }] } },
                                                                                 { popeq: { cached: true,
                                                                                            result: undefined } }]).value);
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(0n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_5.toValue(tmp_0),
                                                                alignment: _descriptor_5.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(1n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tokenId_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(pk_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(2n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tokenId_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(eventId_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_1 = ev_0.organizer;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(3n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tokenId_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(tmp_1),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(4n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tokenId_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(tokenMetaURI_0),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(5n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tokenId_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(tokenPrivCommit_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(7n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(key_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tokenId_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const updatedEv_0 = { maxSupply: ev_0.maxSupply,
                          minted:
                            ((t1) => {
                              if (t1 > 18446744073709551615n) {
                                throw new __compactRuntime.CompactError('poap.compact line 275 char 33: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                              }
                              return t1;
                            })(ev_0.minted + 1n),
                          expiration: ev_0.expiration,
                          organizer: ev_0.organizer,
                          isActive: ev_0.isActive,
                          isPublicMint: ev_0.isPublicMint,
                          metadataURI: ev_0.metadataURI,
                          privateMetadataCommit: ev_0.privateMetadataCommit };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(8n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(eventId_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(updatedEv_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return tokenId_0;
  }
  _claim_0(context, partialProofData, eventId_0, isSoulbound_0) {
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(12n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { popeq: { cached: false,
                                                                                                   result: undefined } }]).value),
                            'Contract is paused');
    const evId_0 = eventId_0;
    const sb_0 = isSoulbound_0;
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_12.toValue(8n),
                                                                                                                  alignment: _descriptor_12.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(evId_0),
                                                                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Event does not exist');
    const ev_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                           partialProofData,
                                                                           [
                                                                            { dup: { n: 0 } },
                                                                            { idx: { cached: false,
                                                                                     pushPath: false,
                                                                                     path: [
                                                                                            { tag: 'value',
                                                                                              value: { value: _descriptor_12.toValue(8n),
                                                                                                       alignment: _descriptor_12.alignment() } }] } },
                                                                            { idx: { cached: false,
                                                                                     pushPath: false,
                                                                                     path: [
                                                                                            { tag: 'value',
                                                                                              value: { value: _descriptor_2.toValue(evId_0),
                                                                                                       alignment: _descriptor_2.alignment() } }] } },
                                                                            { popeq: { cached: false,
                                                                                       result: undefined } }]).value);
    __compactRuntime.assert(ev_0.isPublicMint,
                            'Event requires organizer to mint');
    const pk_0 = this._holder_pk_0(context, partialProofData, ev_0.organizer);
    const tokenId_0 = this._mintTokenTo_0(context,
                                          partialProofData,
                                          pk_0,
                                          evId_0,
                                          ev_0,
                                          ev_0.metadataURI,
                                          ev_0.privateMetadataCommit);
    this._store_token_0(context,
                        partialProofData,
                        tokenId_0,
                        ev_0.organizer,
                        evId_0,
                        sb_0);
    return [];
  }
  _mintTo_0(context,
            partialProofData,
            eventId_0,
            recipientPk_0,
            tokenMetadataURI_0,
            tokenPrivateMetadataCommit_0)
  {
    const evId_0 = eventId_0;
    const recipient_0 = recipientPk_0;
    const tokMetaURI_0 = tokenMetadataURI_0;
    const tokPrivCommit_0 = tokenPrivateMetadataCommit_0;
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(12n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { popeq: { cached: false,
                                                                                                   result: undefined } }]).value),
                            'Contract is paused');
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_12.toValue(8n),
                                                                                                                  alignment: _descriptor_12.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(evId_0),
                                                                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Event does not exist');
    const ev_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                           partialProofData,
                                                                           [
                                                                            { dup: { n: 0 } },
                                                                            { idx: { cached: false,
                                                                                     pushPath: false,
                                                                                     path: [
                                                                                            { tag: 'value',
                                                                                              value: { value: _descriptor_12.toValue(8n),
                                                                                                       alignment: _descriptor_12.alignment() } }] } },
                                                                            { idx: { cached: false,
                                                                                     pushPath: false,
                                                                                     path: [
                                                                                            { tag: 'value',
                                                                                              value: { value: _descriptor_2.toValue(evId_0),
                                                                                                       alignment: _descriptor_2.alignment() } }] } },
                                                                            { popeq: { cached: false,
                                                                                       result: undefined } }]).value);
    __compactRuntime.assert(this._is_admin_0(context, partialProofData)
                            ||
                            this._equal_3(ev_0.organizer,
                                          this._caller_pk_0(context,
                                                            partialProofData)),
                            'Not authorized to mint for this event');
    this._mintTokenTo_0(context,
                        partialProofData,
                        recipient_0,
                        evId_0,
                        ev_0,
                        tokMetaURI_0,
                        tokPrivCommit_0);
    return [];
  }
  _burn_0(context, partialProofData, tokenId_0) {
    const tId_0 = tokenId_0;
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(12n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { popeq: { cached: false,
                                                                                                   result: undefined } }]).value),
                            'Contract is paused');
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_12.toValue(1n),
                                                                                                                  alignment: _descriptor_12.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tId_0),
                                                                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Token does not exist');
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(11n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tId_0),
                                                                                                                                               alignment: _descriptor_1.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Token already burned');
    const issuerId_0 = _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                 partialProofData,
                                                                                 [
                                                                                  { dup: { n: 0 } },
                                                                                  { idx: { cached: false,
                                                                                           pushPath: false,
                                                                                           path: [
                                                                                                  { tag: 'value',
                                                                                                    value: { value: _descriptor_12.toValue(3n),
                                                                                                             alignment: _descriptor_12.alignment() } }] } },
                                                                                  { idx: { cached: false,
                                                                                           pushPath: false,
                                                                                           path: [
                                                                                                  { tag: 'value',
                                                                                                    value: { value: _descriptor_1.toValue(tId_0),
                                                                                                             alignment: _descriptor_1.alignment() } }] } },
                                                                                  { popeq: { cached: false,
                                                                                             result: undefined } }]).value);
    const isOwner_0 = this._equal_4(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                              partialProofData,
                                                                                              [
                                                                                               { dup: { n: 0 } },
                                                                                               { idx: { cached: false,
                                                                                                        pushPath: false,
                                                                                                        path: [
                                                                                                               { tag: 'value',
                                                                                                                 value: { value: _descriptor_12.toValue(1n),
                                                                                                                          alignment: _descriptor_12.alignment() } }] } },
                                                                                               { idx: { cached: false,
                                                                                                        pushPath: false,
                                                                                                        path: [
                                                                                                               { tag: 'value',
                                                                                                                 value: { value: _descriptor_1.toValue(tId_0),
                                                                                                                          alignment: _descriptor_1.alignment() } }] } },
                                                                                               { popeq: { cached: false,
                                                                                                          result: undefined } }]).value),
                                    this._holder_pk_0(context,
                                                      partialProofData,
                                                      issuerId_0));
    __compactRuntime.assert(isOwner_0
                            ||
                            this._is_admin_0(context, partialProofData)
                            ||
                            this._equal_5(issuerId_0,
                                          this._caller_pk_0(context,
                                                            partialProofData)),
                            'Not authorized to burn this token');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(11n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tId_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(true),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _getCallerPk_0(context, partialProofData) {
    return this._caller_pk_0(context, partialProofData);
  }
  _getHolderPk_0(context, partialProofData, issuerId_0) {
    return this._holder_pk_0(context, partialProofData, issuerId_0);
  }
  _computePrivateMetadataCommit_0(value_0, rand_0) {
    return this._persistentCommit_0(value_0, rand_0);
  }
  _revealPrivateMetadata_0(context, partialProofData, eventId_0, value_0, rand_0)
  {
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(12n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { popeq: { cached: false,
                                                                                                   result: undefined } }]).value),
                            'Contract is paused');
    const evId_0 = eventId_0;
    const val_0 = value_0;
    const r_0 = rand_0;
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_12.toValue(8n),
                                                                                                                  alignment: _descriptor_12.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(evId_0),
                                                                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Event does not exist');
    const ev_0 = _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                           partialProofData,
                                                                           [
                                                                            { dup: { n: 0 } },
                                                                            { idx: { cached: false,
                                                                                     pushPath: false,
                                                                                     path: [
                                                                                            { tag: 'value',
                                                                                              value: { value: _descriptor_12.toValue(8n),
                                                                                                       alignment: _descriptor_12.alignment() } }] } },
                                                                            { idx: { cached: false,
                                                                                     pushPath: false,
                                                                                     path: [
                                                                                            { tag: 'value',
                                                                                              value: { value: _descriptor_2.toValue(evId_0),
                                                                                                       alignment: _descriptor_2.alignment() } }] } },
                                                                            { popeq: { cached: false,
                                                                                       result: undefined } }]).value);
    const commit_0 = this._persistentCommit_0(val_0, r_0);
    __compactRuntime.assert(this._equal_6(commit_0, ev_0.privateMetadataCommit),
                            'Value does not match the committed metadata');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(9n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(evId_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(val_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _revealPrivateTokenMetadata_0(context,
                                partialProofData,
                                tokenId_0,
                                value_0,
                                rand_0)
  {
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_12.toValue(12n),
                                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                                        { popeq: { cached: false,
                                                                                                   result: undefined } }]).value),
                            'Contract is paused');
    const tId_0 = tokenId_0;
    const val_0 = value_0;
    const r_0 = rand_0;
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_12.toValue(1n),
                                                                                                                  alignment: _descriptor_12.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tId_0),
                                                                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'Token does not exist');
    const commit_0 = this._persistentCommit_0(val_0, r_0);
    __compactRuntime.assert(this._equal_7(commit_0,
                                          _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_12.toValue(5n),
                                                                                                                                alignment: _descriptor_12.alignment() } }] } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_1.toValue(tId_0),
                                                                                                                                alignment: _descriptor_1.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value)),
                            'Value does not match the committed metadata');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_12.toValue(6n),
                                                                  alignment: _descriptor_12.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tId_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(val_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _equal_0(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_1(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_2(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_3(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_4(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_5(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_6(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_7(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()),
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    get totalSupply() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_12.toValue(0n),
                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                        { popeq: { cached: true,
                                                                                   result: undefined } }]).value);
    },
    tokenOwner: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(1n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(1n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'poap.compact line 33 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(1n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(key_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'poap.compact line 33 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(1n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_1.toValue(key_0),
                                                                                                     alignment: _descriptor_1.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_1.fromValue(key.value),      _descriptor_2.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    tokenEvent: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(2n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(2n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'poap.compact line 38 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(2n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(key_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'poap.compact line 38 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(2n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_1.toValue(key_0),
                                                                                                     alignment: _descriptor_1.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[2];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_1.fromValue(key.value),      _descriptor_2.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    tokenIssuer: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(3n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(3n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'poap.compact line 41 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(3n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(key_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'poap.compact line 41 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(3n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_1.toValue(key_0),
                                                                                                     alignment: _descriptor_1.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[3];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_1.fromValue(key.value),      _descriptor_2.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    tokenMetadataURI: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(4n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(4n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'poap.compact line 46 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(4n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(key_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'poap.compact line 46 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_3.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(4n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_1.toValue(key_0),
                                                                                                     alignment: _descriptor_1.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[4];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_1.fromValue(key.value),      _descriptor_3.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    tokenPrivateMetadataCommit: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(5n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(5n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'poap.compact line 52 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(5n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(key_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'poap.compact line 52 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(5n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_1.toValue(key_0),
                                                                                                     alignment: _descriptor_1.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[5];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_1.fromValue(key.value),      _descriptor_2.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    tokenRevealedMetadata: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(6n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(6n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'poap.compact line 57 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(6n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(key_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'poap.compact line 57 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(6n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_1.toValue(key_0),
                                                                                                     alignment: _descriptor_1.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[6];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_1.fromValue(key.value),      _descriptor_2.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    eventHolderToken: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(7n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(7n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'poap.compact line 62 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(7n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(key_0),
                                                                                                                                 alignment: _descriptor_2.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'poap.compact line 62 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(7n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(key_0),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[7];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_2.fromValue(key.value),      _descriptor_1.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    events: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(8n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(8n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'poap.compact line 65 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(8n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(key_0),
                                                                                                                                 alignment: _descriptor_2.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'poap.compact line 65 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(8n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(key_0),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[8];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_2.fromValue(key.value),      _descriptor_4.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    eventRevealedMetadata: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(9n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(9n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'poap.compact line 71 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(9n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(key_0),
                                                                                                                                 alignment: _descriptor_2.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'poap.compact line 71 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(9n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(key_0),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[9];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_2.fromValue(key.value),      _descriptor_2.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    issuers: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(10n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(10n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'poap.compact line 74 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(10n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(key_0),
                                                                                                                                 alignment: _descriptor_2.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(key_0.buffer instanceof ArrayBuffer && key_0.BYTES_PER_ELEMENT === 1 && key_0.length === 32)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'poap.compact line 74 char 1',
                                     'Bytes<32>',
                                     key_0)
        }
        return _descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(10n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_2.toValue(key_0),
                                                                                                     alignment: _descriptor_2.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[10];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_2.fromValue(key.value),      _descriptor_6.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    burnedTokens: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(11n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(11n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'poap.compact line 77 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(11n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(key_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'bigint' && key_0 >= 0n && key_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'poap.compact line 77 char 1',
                                     'Uint<0..18446744073709551616>',
                                     key_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_12.toValue(11n),
                                                                                                     alignment: _descriptor_12.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_1.toValue(key_0),
                                                                                                     alignment: _descriptor_1.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[11];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_1.fromValue(key.value),      _descriptor_0.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    },
    get isPaused() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_12.toValue(12n),
                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get adminPk() {
      return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_12.toValue(13n),
                                                                                                   alignment: _descriptor_12.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    }
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  local_sk: (...args) => undefined, store_token: (...args) => undefined
});
export const pureCircuits = {
  computePrivateMetadataCommit: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`computePrivateMetadataCommit: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const value_0 = args_0[0];
    const rand_0 = args_0[1];
    if (!(value_0.buffer instanceof ArrayBuffer && value_0.BYTES_PER_ELEMENT === 1 && value_0.length === 32)) {
      __compactRuntime.typeError('computePrivateMetadataCommit',
                                 'argument 1',
                                 'poap.compact line 378 char 1',
                                 'Bytes<32>',
                                 value_0)
    }
    if (!(rand_0.buffer instanceof ArrayBuffer && rand_0.BYTES_PER_ELEMENT === 1 && rand_0.length === 32)) {
      __compactRuntime.typeError('computePrivateMetadataCommit',
                                 'argument 2',
                                 'poap.compact line 378 char 1',
                                 'Bytes<32>',
                                 rand_0)
    }
    return _dummyContract._computePrivateMetadataCommit_0(value_0, rand_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
//# sourceMappingURL=index.js.map
