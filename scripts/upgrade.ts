/**
 * Upgrade the deployed POAP contract IN PLACE: same address, same ledger state, new circuit logic.
 *
 * Compares every provable circuit's verifier key in the local build (contracts/src/managed/poap)
 * with the one on-chain and, with --apply, swaps the ones that differ using the contract's
 * maintenance authority (the key deploy.ts derives from the deploying wallet's seed):
 *
 *   changed  on-chain key differs from the local one → remove, then insert the new key
 *   new      circuit exists locally but not on-chain  → insert
 *   orphan   circuit exists on-chain but not locally  → reported only; removed with --remove-orphans
 *
 * Without --apply it only prints that plan. The plan needs no wallet, so it's quick even on
 * preprod, where the wallet's DUST sync takes 1.5-2h (see lib/network.ts).
 *
 * WHAT CAN AND CAN'T BE UPGRADED THIS WAY. Only circuits are swapped; the ledger (the contract's
 * stored state) keeps the shape it was deployed with. So this is safe when the `ledger`
 * declarations, the types stored in them, and every circuit's signature are unchanged — a quick
 * check is that contracts/src/managed/poap/contract/index.d.ts has no diff. Any change there
 * needs a new deployment. Changing how existing ids are derived (event_key, holder_pk, …) also
 * upgrades "fine" but orphans the data already stored under the old ids. The ledger parse check
 * below catches gross layout mismatches, not every one — it's a guard, not a proof.
 *
 * USERS. Clients build proofs locally from their own copy of the compiled contract and prover
 * keys, and those must match the verifier keys on-chain. Ship the matching frontend build
 * (poap-frontend/src/midnight/contract/ + ZK artifacts) and sync the API host's /zk keys
 * (deploy/production/sync-zk.sh) right after --apply. Between a circuit's remove and insert, and
 * until clients update, calls to the swapped circuits fail. The indexer needs no DB reset.
 *
 * Same network/seed environment as deploy.ts (MN_TEST_ENVIRONMENT, MN_TEST_WALLET_SEED — the
 * seed that deployed the contract), plus CONTRACT_ADDRESS. Requires a full ZK build
 * (`cd contracts && npm run compact`), not --skip-zk: the verifier keys are the whole point.
 *
 *   CONTRACT_ADDRESS=<addr> npx tsx scripts/upgrade.ts                  # local devnet, plan only
 *   CONTRACT_ADDRESS=<addr> npx tsx scripts/upgrade.ts --apply          # local devnet, swap keys
 *   MN_TEST_ENVIRONMENT=preprod MN_TEST_WALLET_SEED=<hex> CONTRACT_ADDRESS=<addr> \
 *     npx tsx scripts/upgrade.ts --apply
 *
 * An interrupted --apply is safe to re-run: a circuit whose old key was removed but whose new
 * one wasn't inserted yet shows up as `new` and gets inserted.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import pino from 'pino';
import {
  submitInsertVerifierKeyTx,
  submitRemoveVerifierKeyTx,
  verifierKeysEqual,
} from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { ContractState as RuntimeContractState, signatureVerifyingKey } from '@midnight-ntwrk/compact-runtime';
import { initializeMidnightProviders } from '@midnight-ntwrk/testkit-js';
import type { ContractState } from '@midnight-ntwrk/ledger-v8';
import type { VerifierKey } from '@midnight-ntwrk/midnight-js-types';

import {
  resolveNetwork,
  startFundedWallet,
  contractSecretKey,
  deriveMaintenanceSigningKey,
} from './lib/network.js';
import { Contract, ledger } from '../contracts/src/managed/poap/contract/index.js';
import { createWitnesses, type PoapPrivateState } from '../contracts/src/witnesses.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZK_CONFIG_PATH = path.resolve(__dirname, '..', 'contracts', 'src', 'managed', 'poap');

// Read from the build instead of a hand-kept list (deploy.ts's PROOF_CIRCUIT_IDS), so a newly
// added circuit can't be forgotten here.
const LOCAL_CIRCUIT_IDS: string[] = JSON.parse(
  fs.readFileSync(path.join(ZK_CONFIG_PATH, 'compiler', 'contract-info.json'), 'utf8'),
).circuits
  .filter((c: { proof: boolean }) => c.proof)
  .map((c: { name: string }) => c.name);

type Action = 'unchanged' | 'changed' | 'new' | 'orphan';
type PlanEntry = { circuitId: string; action: Action; localVk?: VerifierKey };

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

function operationIds(state: ContractState): string[] {
  return state.operations().map((op) => (typeof op === 'string' ? op : Buffer.from(op).toString('utf8')));
}

async function buildPlan(state: ContractState, zkConfig: NodeZkConfigProvider<string>): Promise<PlanEntry[]> {
  const plan: PlanEntry[] = [];
  for (const circuitId of LOCAL_CIRCUIT_IDS) {
    const localVk = await zkConfig.getVerifierKey(circuitId);
    const onChain = state.operation(circuitId);
    const action: Action = !onChain ? 'new' : verifierKeysEqual(onChain.verifierKey, localVk) ? 'unchanged' : 'changed';
    plan.push({ circuitId, action, localVk });
  }
  for (const circuitId of operationIds(state)) {
    if (!LOCAL_CIRCUIT_IDS.includes(circuitId)) plan.push({ circuitId, action: 'orphan' });
  }
  return plan;
}

function printPlan(plan: PlanEntry[]): void {
  const count = (a: Action) => plan.filter((p) => p.action === a).length;
  logger.info(
    `Plan: ${count('changed')} changed, ${count('new')} new, ${count('orphan')} orphan, ` +
      `${count('unchanged')} unchanged`,
  );
  for (const p of plan) {
    if (p.action !== 'unchanged') logger.info(`  ${p.action.padEnd(7)} ${p.circuitId}`);
  }
}

// The compiled contract's ledger() rejects state from ledger-v8's ContractState directly
// ("expected instance of ChargedState") — round-trip it through compact-runtime's class, the same
// way indexer/src/parser.ts does.
function parseLedger(state: ContractState) {
  return ledger(RuntimeContractState.deserialize(state.serialize()).data);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const removeOrphans = args.has('--remove-orphans');
  const contractAddress = process.env['CONTRACT_ADDRESS'] ?? '';
  if (!contractAddress) throw new Error('CONTRACT_ADDRESS is required.');

  const targetNetwork = (process.env.MN_TEST_ENVIRONMENT || 'undeployed').toLowerCase();
  logger.info(`=== AdaSouls POAP Contract Upgrade (network: ${targetNetwork}${apply ? '' : ', plan only'}) ===`);
  const { envConfig, seedHex } = resolveNetwork(targetNetwork, logger);

  const publicData = indexerPublicDataProvider(envConfig.indexer, envConfig.indexerWS);
  const zkConfig = new NodeZkConfigProvider<string>(ZK_CONFIG_PATH);

  const state = await publicData.queryContractState(contractAddress);
  if (!state) throw new Error(`No contract found at ${contractAddress} on ${targetNetwork}.`);

  // Fail before any wallet work if this seed isn't the contract's maintenance authority.
  const maintenanceSigningKey = deriveMaintenanceSigningKey(seedHex);
  const authority = state.maintenanceAuthority;
  if (!authority.committee.includes(signatureVerifyingKey(maintenanceSigningKey))) {
    throw new Error(
      `This seed's maintenance key is not in the contract's maintenance authority ` +
        `(committee of ${authority.committee.length}, threshold ${authority.threshold}). ` +
        `Use the seed that deployed the contract.`,
    );
  }
  if (authority.threshold !== 1) {
    throw new Error(`Maintenance threshold is ${authority.threshold}; this script only signs with one key.`);
  }

  try {
    parseLedger(state);
  } catch (err) {
    throw new Error(
      `The local build can't parse the on-chain ledger state, so its layout has changed — this ` +
        `needs a new deployment, not an upgrade. (${(err as Error).message})`,
    );
  }

  const plan = await buildPlan(state, zkConfig);
  printPlan(plan);

  const todo = plan.filter((p) => p.action === 'changed' || p.action === 'new' || (removeOrphans && p.action === 'orphan'));
  if (todo.length === 0) {
    logger.info('On-chain circuits already match the local build. Nothing to do.');
    process.exit(0);
  }
  if (!apply) {
    logger.info('Plan only. Re-run with --apply to submit it.');
    process.exit(0);
  }

  const wallet = await startFundedWallet(logger, envConfig, seedHex);
  try {
    const CompiledPoapContract = CompiledContract.make('PoapContract', Contract).pipe(
      CompiledContract.withWitnesses(createWitnesses(contractSecretKey(seedHex))),
      CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
    );
    const providers = initializeMidnightProviders<string, PoapPrivateState>(wallet, envConfig, {
      privateStateStoreName: 'poap-upgrade-state',
      zkConfigPath: ZK_CONFIG_PATH,
    });
    // The maintenance transactions read the authority key from the private state store.
    await providers.privateStateProvider.setSigningKey(contractAddress, maintenanceSigningKey);

    // One circuit at a time, remove immediately followed by insert, so each circuit is
    // unavailable for as short a window as possible.
    for (const { circuitId, action, localVk } of todo) {
      if (action === 'changed' || action === 'orphan') {
        const tx = await submitRemoveVerifierKeyTx(providers, CompiledPoapContract, contractAddress, circuitId as never);
        logger.info(`  ${circuitId}: old key removed (block ${tx.blockHeight})`);
      }
      if (action === 'changed' || action === 'new') {
        const tx = await submitInsertVerifierKeyTx(providers, CompiledPoapContract, contractAddress, circuitId as never, localVk!);
        logger.info(`  ${circuitId}: new key inserted (block ${tx.blockHeight})`);
      }
    }

    const after = await publicData.queryContractState(contractAddress);
    const remaining = (await buildPlan(after!, zkConfig)).filter((p) => p.action !== 'unchanged' && p.action !== 'orphan');
    if (remaining.length > 0) {
      throw new Error(`Upgrade incomplete: ${remaining.map((p) => `${p.circuitId} (${p.action})`).join(', ')}`);
    }
    parseLedger(after!);
    logger.info('=== Upgrade complete: every local circuit matches on-chain ===');
    logger.info('Next: sync the API host keys (deploy/production/sync-zk.sh) and ship the matching frontend build.');
  } finally {
    await wallet.stop();
  }
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'Upgrade failed');
  process.exit(1);
});
