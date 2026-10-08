/**
 * End-to-end smoke test of multi-condition credential requests and atomic re-issue, with real
 * proofs and transactions, against the contract in .env.local (local devnet by default).
 *
 *   docker compose -f devnet.yml up -d
 *   npx tsx scripts/deploy.ts
 *   npx tsx scripts/e2e-credential-flow.ts
 *
 * One funded wallet pays for everything; the issuer/verifier and the holder are two different
 * contract secret keys (the contract's identities come from the local_sk witness, not from the
 * wallet). Flow:
 *   1. issuer creates an event with maxSupply 1 and mints the holder a credential with two private
 *      attributes (an identity value and a grade);
 *   2. verifier publishes ONE request with both conditions; the holder answers it with ONE proof;
 *   3. a wrong answer is rejected before any proof is built;
 *   4. issuer re-issues the credential (new identity value) although the event is full;
 *   5. the holder answers a new request with the new credential; the old answer no longer works.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

import pino from 'pino';
import { submitCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { initializeMidnightProviders } from '@midnight-ntwrk/testkit-js';

import { resolveNetwork, startFundedWallet, contractSecretKey } from './lib/network.js';
import { Contract, ledger, pureCircuits } from '../contracts/src/managed/poap/contract/index.js';
import { createWitnesses, type PoapPrivateState } from '../contracts/src/witnesses.js';
import { buildMerklePath, buildTreePaths, type MerklePathArg } from '../contracts/src/test/poap-simulator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZK_CONFIG_PATH = path.resolve(__dirname, '..', 'contracts', 'src', 'managed', 'poap');

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', transport: { target: 'pino-pretty' } });

const ZERO = new Uint8Array(32);
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const text32 = (value: string) => {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode(value));
  return out;
};
// persistentHash over a Vector<n, Bytes<32>> is SHA-256 of the concatenated elements, and
// pad(32, "tag") is the tag right-padded with zeros (see derivePk in deploy.ts).
const hashOf = (tag: string, ...parts: Uint8Array[]) =>
  new Uint8Array(createHash('sha256').update(Buffer.concat([text32(tag), ...parts])).digest());
const pathOf = (p: MerklePathArg): MerklePathArg => ({ leaf: p.leaf, path: p.path });
const emptyPath = (depth: number): MerklePathArg => ({
  leaf: ZERO,
  path: Array.from({ length: depth }, () => ({ sibling: { field: 0n }, goes_left: true })),
});
const pad4 = <T>(items: T[], filler: T): T[] => [...items, ...Array(4 - items.length).fill(filler)];

function readContractAddress(): string {
  const fromEnv = process.env['CONTRACT_ADDRESS'];
  if (fromEnv) return fromEnv;
  const envFile = fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf8');
  const match = envFile.match(/^CONTRACT_ADDRESS=(\w+)/m);
  if (!match) throw new Error('CONTRACT_ADDRESS not set and not found in .env.local');
  return match[1];
}

async function main() {
  const targetNetwork = (process.env.MN_TEST_ENVIRONMENT || 'undeployed').toLowerCase();
  const contractAddress = readContractAddress();
  logger.info(`=== Credential request + re-issue smoke test (${targetNetwork}, ${contractAddress.slice(0, 16)}…) ===`);

  const { envConfig, seedHex } = resolveNetwork(targetNetwork, logger);
  const wallet = await startFundedWallet(logger, envConfig, seedHex);
  const providers = initializeMidnightProviders<string, PoapPrivateState>(wallet, envConfig, {
    privateStateStoreName: 'poap-e2e-state',
    zkConfigPath: ZK_CONFIG_PATH,
  });

  // Two contract identities on one wallet.
  const issuerSk = contractSecretKey(seedHex);
  const holderSk = new Uint8Array(createHash('sha256').update(`velum-e2e-holder:${seedHex}`).digest());
  const identity = async (name: string, secretKey: Uint8Array) => {
    const compiledContract = CompiledContract.make('PoapContract', Contract).pipe(
      CompiledContract.withWitnesses(createWitnesses(secretKey)),
      CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
    );
    const privateStateId = `poap-e2e-${name}`;
    await findDeployedContract<Contract>(providers as any, {
      compiledContract,
      contractAddress,
      privateStateId,
      initialPrivateState: { secretKey, tokens: {} },
    } as any);
    return async (circuitId: string, args: unknown[]) => {
      const started = Date.now();
      const tx = await submitCallTx<Contract, any>(providers as any, {
        compiledContract, contractAddress, privateStateId, circuitId, args,
      } as any);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      logger.info(`  ${name}: ${circuitId} in block ${tx.public.blockHeight} (${seconds}s, tx ${tx.public.txHash.slice(0, 16)}…)`);
      return tx;
    };
  };
  const issuer = await identity('issuer', issuerSk);
  const holder = await identity('holder', holderSk);

  const readLedger = async () => {
    const state = await providers.publicDataProvider.queryContractState(contractAddress);
    if (!state) throw new Error('contract state not found');
    return ledger(state.data);
  };
  const expectRejected = async (what: string, call: () => Promise<unknown>, message: string) => {
    try {
      await call();
    } catch (err) {
      const text = String((err as Error)?.message ?? err);
      if (!text.includes(message)) throw new Error(`${what}: expected "${message}", got: ${text.slice(0, 300)}`);
      logger.info(`  rejected as expected — ${what}: "${message}"`);
      return;
    }
    throw new Error(`${what}: expected a rejection ("${message}") but the call went through`);
  };

  const issuerPk = hashOf('adasouls:pk:v1:', issuerSk);
  const holderPk = hashOf('adasouls:holder-pk:v1:', holderSk, issuerPk);

  // ── 1. Event (maxSupply 1) and a credential with two private attributes ────
  const FIELD_ID = text32('field:national_id');
  const FIELD_GPA = text32('field:gpa');
  const GPA = text32('9');
  const RAND_ID = new Uint8Array(randomBytes(32));
  const RAND_GPA = new Uint8Array(randomBytes(32));
  const identityValue = (number: string, salt: Uint8Array) =>
    pureCircuits.computeIdentityValue(text32('ARG'), text32('national_id'), text32(number), salt);
  const salt = new Uint8Array(randomBytes(32));
  const oldId = identityValue('30123456', salt);
  const newId = identityValue('40111222', salt);
  const attributeTree = (idValue: Uint8Array) => buildTreePaths([
    pureCircuits.computeCredentialAttrLeaf(FIELD_ID, idValue, RAND_ID),
    pureCircuits.computeCredentialAttrLeaf(FIELD_GPA, GPA, RAND_GPA),
  ], 8);
  const oldTree = attributeTree(oldId);
  const newTree = attributeTree(newId);

  const eventLabel = new Uint8Array(randomBytes(32));
  const eventId = pureCircuits.computeEventId(issuerPk, eventLabel);
  logger.info('1. Create a one-seat event and mint the credential');
  await issuer('createEvent', [eventLabel, 1n, 0n, false, 'ipfs://e2e-event', ZERO, ZERO]);
  await issuer('mintTo', [eventId, holderPk, 'ipfs://e2e-old', ZERO, oldTree[0].rootBytes]);
  let state = await readLedger();
  const oldTokenId = state.totalSupply - 1n;
  if (hex(state.tokenOwner.lookup(oldTokenId)) !== hex(holderPk)) throw new Error('holder pseudonym mismatch');

  // ── 2. One request, two conditions, one proof ──────────────────────────────
  const ask = async (idValue: Uint8Array) => {
    const label = new Uint8Array(randomBytes(32));
    const idSet = buildMerklePath(idValue, 16);
    const gpaSet = buildMerklePath(GPA, 16);
    await issuer('publishCredentialRequest', [label, eventId, holderPk, pad4(
      [{ fieldId: FIELD_ID, setRoot: idSet.rootBytes }, { fieldId: FIELD_GPA, setRoot: gpaSet.rootBytes }],
      { fieldId: ZERO, setRoot: ZERO },
    )]);
    const requestId = hashOf('adasouls:disclosure-req:v1:', issuerPk, label);
    return { requestId, idSet: pathOf(idSet), gpaSet: pathOf(gpaSet) };
  };
  const answer = async (
    req: Awaited<ReturnType<typeof ask>>, tokenId: bigint, idValue: Uint8Array, tree: ReturnType<typeof attributeTree>,
  ) => {
    const current = await readLedger();
    const leaf = pureCircuits.computeCredentialLeaf(eventId, holderPk, tree[0].rootBytes);
    const credPath = current.credentials.pathForLeaf(tokenId, leaf) as MerklePathArg;
    return holder('proveCredentialAttributes', [
      req.requestId,
      pad4([idValue, GPA], ZERO),
      pad4([RAND_ID, RAND_GPA], ZERO),
      pad4([pathOf(tree[0]), pathOf(tree[1])], emptyPath(8)),
      pad4([req.idSet, req.gpaSet], emptyPath(16)),
      credPath,
    ]);
  };

  logger.info('2. Verifier asks identity + grade as one request; holder answers with one proof');
  const firstRequest = await ask(oldId);
  state = await readLedger();
  if (!state.credentialRequests.member(firstRequest.requestId)) throw new Error('request id derivation mismatch');
  await answer(firstRequest, oldTokenId, oldId, oldTree);

  // ── 3. A wrong identity cannot be answered, grade or not ───────────────────
  logger.info('3. A request built from another document cannot be answered');
  const wrongRequest = await ask(newId);
  await expectRejected('identity not in the verifier\'s set',
    () => answer(wrongRequest, oldTokenId, oldId, oldTree), 'Set path does not match the hidden value');

  // ── 4. Atomic re-issue on a full event ─────────────────────────────────────
  logger.info('4. Issuer re-issues the credential with the new document (event is full)');
  await expectRejected('holder re-issuing their own credential',
    () => holder('reissueCredential', [oldTokenId, 'ipfs://e2e-new', ZERO, newTree[0].rootBytes]),
    'Not authorized to re-issue this token');
  await issuer('reissueCredential', [oldTokenId, 'ipfs://e2e-new', ZERO, newTree[0].rootBytes]);
  state = await readLedger();
  const newTokenId = state.totalSupply - 1n;
  const event = state.events.lookup(eventId);
  const checks: Array<[string, boolean]> = [
    ['old token is burned', state.burnedTokens.member(oldTokenId)],
    ['new token is live', !state.burnedTokens.member(newTokenId)],
    ['new token has the same owner', hex(state.tokenOwner.lookup(newTokenId)) === hex(holderPk)],
    ['new token carries the new metadata', state.tokenMetadataURI.lookup(newTokenId) === 'ipfs://e2e-new'],
    ['minted did not move (1 of 1)', event.minted === 1n && event.maxSupply === 1n],
  ];
  for (const [what, ok] of checks) {
    if (!ok) throw new Error(`re-issue check failed: ${what}`);
    logger.info(`  ok — ${what}`);
  }

  // ── 5. New credential proves, old one does not ─────────────────────────────
  logger.info('5. The new credential answers; the old one no longer does');
  await answer(wrongRequest, newTokenId, newId, newTree);
  await expectRejected('old credential after the re-issue', async () => {
    const leaf = pureCircuits.computeCredentialLeaf(eventId, holderPk, oldTree[0].rootBytes);
    // The old leaf is gone from the tree, so there is no path to build for it: reuse the new
    // token's path with the old leaf, which is what a stale wallet would effectively present.
    const current = await readLedger();
    const newLeaf = pureCircuits.computeCredentialLeaf(eventId, holderPk, newTree[0].rootBytes);
    const credPath = { ...(current.credentials.pathForLeaf(newTokenId, newLeaf) as MerklePathArg), leaf };
    return holder('proveCredentialAttributes', [
      firstRequest.requestId,
      pad4([oldId, GPA], ZERO),
      pad4([RAND_ID, RAND_GPA], ZERO),
      pad4([pathOf(oldTree[0]), pathOf(oldTree[1])], emptyPath(8)),
      pad4([firstRequest.idSet, firstRequest.gpaSet], emptyPath(16)),
      credPath,
    ]);
  }, 'Credential not in tree');

  logger.info('=== All checks passed ===');
  process.exit(0);
}

main().catch((err) => {
  logger.error(err, 'Smoke test failed');
  process.exit(1);
});
