/**
 * TASK-015: Deploy the POAP contract to a Midnight network.
 *
 * Rewritten against the SDK generation actually declared in this package's package.json
 * (compact-runtime 0.16.0 / ledger 4.0.0 / midnight-js-* 4.1.1 / zswap 4.0.0 / testkit-js 4.1.1 /
 * wallet-sdk 1.1.0), which matches the "preview" row of Midnight's official compatibility matrix.
 * Uses CompiledContract.make/.pipe, deployContract(providers, options),
 * submitCallTx(providers, options), and MidnightWalletProvider/syncWallet/
 * initializeMidnightProviders from @midnight-ntwrk/testkit-js — verified end-to-end against a
 * running local devnet (devnet.yml: midnight-node 0.22.5 + indexer-standalone 4.2.1 +
 * proof-server 8.1.0), not just typechecked.
 *
 * Network selection (2026-08-28): driven by testkit-js's own `MN_TEST_ENVIRONMENT` env var —
 * this is the SDK's built-in mechanism, not a hand-rolled config map, so it stays correct as
 * Midnight adds/changes networks:
 *   - unset / 'undeployed' (default): local devnet.yml, unchanged from the original version of
 *     this script. Uses the genesis wallet — devnet.yml's `dev` chain spec pre-mints NIGHT to it.
 *   - 'preprod' | 'preview' | 'qanet': testkit-js's built-in `RemoteTestEnvironment` subclasses.
 *     `getTestEnvironment().getEnvironmentConfiguration()` returns the network's canonical
 *     node/indexer/faucet URLs — no URLs are hardcoded here. We deliberately do NOT call this
 *     class's `.start()`: it health-checks node/indexer/faucet with a hardcoded 1000ms axios
 *     timeout per endpoint (testkit-js's NodeClient/IndexerClient/FaucetClient.health()), which is
 *     tighter than preprod's real round-trip latency from here (~1.0-1.1s measured directly
 *     against rpc.preprod/indexer.preprod.midnight.network on 2026-08-28) and fails spuriously
 *     even though the endpoints are healthy — confirmed by curling them directly. The proof
 *     server is local for every network regardless (it handles your private data — see
 *     docs.midnight.network/guides/networks-and-environments), so we override it with an
 *     already-running instance on :6300 (`docker compose -f devnet.yml up -d proof-server`)
 *     rather than the one `.start()` would otherwise have resolved. Requires
 *     `MN_TEST_WALLET_SEED` (a 32-byte hex secret key) for a wallet that's already been funded
 *     via that network's faucet — see `scripts/wallet-info.ts` to derive the address to fund
 *     before running this. There is no genesis wallet outside 'undeployed'.
 *   - 'env-var-remote': any other/future network (including mainnet once it's live) — set
 *     MN_TEST_NODE, MN_TEST_INDEXER, MN_TEST_INDEXER_WS, MN_TEST_NETWORK_ID (and optionally
 *     MN_TEST_FAUCET) directly; testkit-js reads those without needing a new named case here.
 *
 * Prerequisites:
 * - `npm install` at the repo root (contracts/ and scripts/ are npm workspaces sharing one
 *   node_modules — required so WASM-backed classes like ContractMaintenanceAuthority and
 *   StateValue come from a single @midnight-ntwrk/onchain-runtime-v3 instance. Two separate
 *   copies of that package — e.g. one under contracts/node_modules and another under
 *   scripts/node_modules, or a version mismatch forcing a nested copy under some other
 *   package's node_modules — fail `instanceof` checks in the WASM bindings even when the
 *   versions match; the "overrides" pin in the root package.json exists for that reason).
 * - contracts/src/managed/poap/keys/ generated locally via `cd contracts && npm run compact`
 *   (gitignored build output; NodeZkConfigProvider reads prover/verifier keys from there). These
 *   artifacts are network-agnostic (the proof server itself is always local, for every network —
 *   see docs.midnight.network/guides/networks-and-environments), so nothing to recompile per network.
 * - For 'undeployed': devnet.yml running (`docker compose -f devnet.yml up -d` from the repo root).
 * - For 'preprod'/'preview'/'qanet': just the proof server from devnet.yml running
 *   (`docker compose -f devnet.yml up -d proof-server` — it has no dependency on node/indexer/
 *   poap-pg, so this starts only that one container) and a funded wallet seed in
 *   MN_TEST_WALLET_SEED.
 *
 *   npx tsx scripts/deploy.ts                                              # local devnet
 *   MN_TEST_ENVIRONMENT=preprod MN_TEST_WALLET_SEED=<hex> npx tsx scripts/deploy.ts   # preprod
 *
 * Outputs the deployed contract address and saves it to deployments/<network>.md and
 * .env.<network>.local — 'undeployed' keeps the original unsuffixed .env.local filename so the
 * existing local workflow doesn't change.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import pino from 'pino';
import {
  deployContract,
  submitCallTx,
  submitInsertVerifierKeyTx,
  findDeployedContract,
  type DeployedContract,
} from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { initializeMidnightProviders } from '@midnight-ntwrk/testkit-js';

import {
  resolveNetwork,
  startFundedWallet,
  contractSecretKey,
  deriveMaintenanceSigningKey,
} from './lib/network.js';
import { Contract, pureCircuits } from '../contracts/src/managed/poap/contract/index.js';
import { Contract as ShellContract } from '../contracts/src/managed/poap-shell/contract/index.js';
import { createWitnesses, type PoapPrivateState } from '../contracts/src/witnesses.js';

type PoapCircuits =
  | 'pause'
  | 'unpause'
  | 'registerIssuer'
  | 'deactivateIssuer'
  | 'createEvent'
  | 'deactivateEvent'
  | 'claim'
  | 'mintTo'
  | 'burn'
  | 'getCallerPk'
  | 'getHolderPk'
  | 'revealPrivateMetadata'
  | 'revealPrivateTokenMetadata';

// ── Config ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(__dirname, '..', 'contracts');
const ZK_CONFIG_PATH = path.join(CONTRACTS_DIR, 'src', 'managed', 'poap');
// "Shell" build: same source, same ledger/constructor, but every `export circuit` (proof-
// requiring) demoted to plain `circuit` via `contracts/package.json`'s `compact:shell` script
// (`sed -E 's/^export circuit /circuit /'`) — 0 exported/provable circuits, so it compiles with
// no verifier keys and its own deploy transaction is ~750 bytes. See STAGED DEPLOYMENT below.
const SHELL_ZK_CONFIG_PATH = path.join(CONTRACTS_DIR, 'src', 'managed', 'poap-shell');
// Every circuit requiring a verifier key (contract-info.json's `proof: true` entries) — must be
// registered one at a time onto the shell contract after deploy. Keep in sync with poap.compact's
// `export circuit` declarations; run `cat contracts/src/managed/poap/compiler/contract-info.json
// | jq '.circuits[] | select(.proof) | .name'` to regenerate this list after adding a circuit.
const PROOF_CIRCUIT_IDS = [
  'pause',
  'unpause',
  'registerIssuer',
  'deactivateIssuer',
  'createEvent',
  'deactivateEvent',
  'reactivateEvent',
  'claim',
  'mintTo',
  'burn',
  'revealPrivateMetadata',
  'revealPrivateTokenMetadata',
  'publishDisclosureRequest',
  'proveAttributeMembership',
  'proveAttributeMembershipOnce',
  'proveTokenOwnership',
  'proveEventAttendance',
  'proveCredentialAttribute',
  'requestCredentialUpdate',
  'dismissCredentialUpdate',
] as const;

const PRIVATE_STATE_ID = 'poapPrivateState';
// Demo event parameters (TASK-016). This is a LABEL now, not the raw
// on-chain eventId — createEvent derives the real id as
// event_key(organizerPk, label) (see poap.compact, the fix for the
// confirmed event-ID-squatting vulnerability). See derivePk usage below
// for how the real id gets computed for documentation.
const DEMO_EVENT_LABEL = new Uint8Array(32);
DEMO_EVENT_LABEL[0] = 0xde;
DEMO_EVENT_LABEL[1] = 0x01;

// Replicates the contract's derive_pk circuit off-chain:
//   derive_pk(sk) = persistentHash<Vector<2,Bytes<32>>>([pad(32,"adasouls:pk:v1:"), sk])
// persistentHash is plain SHA-256 over the raw concatenated bytes (struct/vector
// fields are concatenated verbatim, no separators — confirmed via direct
// inspection of the ledger source during a security audit of this contract),
// and pad(32, "literal") right-pads the UTF-8 string with zero bytes to 32.
// Needed here (rather than an extra on-chain getCallerPk() call) purely to
// compute the demo event's real eventId for the deployment record below —
// this script has no live devnet/proof-server in the environment that wrote
// it to verify submitCallTx's return-value field name against, so deriving
// it independently from a formula already confirmed correct is the safer
// choice than guessing at an SDK response shape.
function derivePk(secretKey: Uint8Array): Uint8Array {
  const tag = Buffer.alloc(32);
  Buffer.from('adasouls:pk:v1:', 'utf8').copy(tag);
  return new Uint8Array(createHash('sha256').update(Buffer.concat([tag, Buffer.from(secretKey)])).digest());
}

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const targetNetwork = (process.env.MN_TEST_ENVIRONMENT || 'undeployed').toLowerCase();
  logger.info(`=== AdaSouls POAP Contract Deployment (network: ${targetNetwork}) ===`);

  const { envConfig, seedHex } = resolveNetwork(targetNetwork, logger);

  const wallet = await startFundedWallet(logger, envConfig, seedHex);

  const secretKey = contractSecretKey(seedHex);
  const CompiledPoapContract = CompiledContract.make('PoapContract', Contract).pipe(
    CompiledContract.withWitnesses(createWitnesses(secretKey)),
    CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
  );
  const CompiledPoapShellContract = CompiledContract.make('PoapContractShell', ShellContract).pipe(
    CompiledContract.withWitnesses(createWitnesses(secretKey)),
    CompiledContract.withCompiledFileAssets(SHELL_ZK_CONFIG_PATH),
  );

  const providers = initializeMidnightProviders<PoapCircuits, PoapPrivateState>(wallet, envConfig, {
    privateStateStoreName: 'poap-deploy-state',
    zkConfigPath: ZK_CONFIG_PATH,
  });

  const initialPrivateState: PoapPrivateState = { secretKey, tokens: {} };

  // The contract's on-chain maintenance authority (CMA) key — see deriveMaintenanceSigningKey.
  const maintenanceSigningKey = deriveMaintenanceSigningKey(seedHex);

  try {
    // ── STAGED DEPLOYMENT ──────────────────────────────────────────────────────────────────
    // Deploying all 15 proof-requiring circuits' verifier keys in one transaction (the
    // straightforward `deployContract(providers, { compiledContract: CompiledPoapContract, ... })`
    // this used to be) is rejected by the node with "1010: Invalid Transaction: Transaction would
    // exhaust the block limits" — confirmed 2026-09-17 on both midnight-node 0.22.5 and 1.0.2 (the
    // version preprod runs), so it is not a node-version bug. Measured: the extrinsic is only
    // ~36KB (well under the 768KB block-length limit) — this is a WEIGHT rejection, and it scales
    // linearly at ~2,211 bytes of deploy weight per proof-requiring circuit (each verifier key is
    // exactly 2,119 bytes regardless of the circuit's own complexity — a 10MB prover key's
    // verifier key costs the same as a 3KB one). The last version of this contract that deployed
    // successfully in one transaction (2026-08-05, local devnet) had 9 such circuits; the
    // selective-disclosure feature (commits 9f9cf9e/19a0211/cb0ab50) brought it to 15.
    //
    // Fix: deploy a "shell" build of the same contract (same ledger layout and constructor,
    // verified byte-identical — see contracts/package.json's `compact:shell` script — but every
    // circuit un-exported, so 0 verifier keys and a ~750-byte deploy transaction), then register
    // each of the 15 circuits' verifier keys one at a time via submitInsertVerifierKeyTx
    // (~2.4KB per transaction, independently confirmed against a real ledger simulation). This
    // makes deploy weight O(1) forever — the contract can keep growing without ever hitting this
    // limit again, since maintenance-authority inserts are one-per-transaction by construction.
    //
    // Do NOT call findDeployedContract with the full contract until every circuit is inserted:
    // its verifyContractState check throws ContractTypeError while any operation is missing.
    logger.info('Deploying POAP contract shell (0 circuits, staging verifier keys next)...');
    const deployedShell: DeployedContract<ShellContract> = await deployContract<ShellContract>(providers, {
      compiledContract: CompiledPoapShellContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState,
      signingKey: maintenanceSigningKey,
    });

    const contractAddress = deployedShell.deployTxData.public.contractAddress;
    const deployTxHash = deployedShell.deployTxData.public.txHash;
    logger.info(`Shell deployed! Address: ${contractAddress}, tx: ${deployTxHash}`);

    logger.info(`Staging ${PROOF_CIRCUIT_IDS.length} circuits' verifier keys...`);
    for (const circuitId of PROOF_CIRCUIT_IDS) {
      const currentState = await providers.publicDataProvider.queryContractState(contractAddress);
      if (currentState?.operation(circuitId)) {
        logger.info(`  ${circuitId}: already present, skipping (resumed run)`);
        continue;
      }
      const verifierKey = await providers.zkConfigProvider.getVerifierKey(circuitId);
      await submitInsertVerifierKeyTx(providers, CompiledPoapContract, contractAddress, circuitId, verifierKey);
      logger.info(`  ${circuitId}: inserted`);
    }
    logger.info('All circuits staged.');

    // Confirms every inserted verifier key matches what the full compiled contract expects
    // (verifyContractState) and re-persists maintenanceSigningKey against the full contract's
    // handle, in case more circuits need staging in a future run.
    await findDeployedContract<Contract>(providers, {
      compiledContract: CompiledPoapContract,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState,
      signingKey: maintenanceSigningKey,
    });

    logger.info('Creating demo event...');
    const eventTx = await submitCallTx<Contract, 'createEvent'>(providers, {
      compiledContract: CompiledPoapContract,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      circuitId: 'createEvent',
      // Fully public demo event — all-zero privateMetadataCommit/privateAttributesRoot
      // means "no private part" / "no attributes committed".
      args: [
        DEMO_EVENT_LABEL,
        100n,
        0n,
        true,
        'ipfs://bafybeih6xhqqfxfyfqgw2xkjxhcxc4kdemoevent/metadata.json',
        new Uint8Array(32),
        new Uint8Array(32),
      ],
    });
    logger.info(`Event created in block ${eventTx.public.blockHeight}, tx: ${eventTx.public.txHash}`);

    // The real on-chain key — NOT DEMO_EVENT_LABEL — see derivePk/comment above.
    const demoEventId = pureCircuits.computeEventId(derivePk(secretKey), DEMO_EVENT_LABEL);
    const demoEventHex = Buffer.from(demoEventId).toString('hex');
    const deploymentMd = `# Deployment Record

## POAP Contract — Midnight ${targetNetwork}

| Field | Value |
|---|---|
| Contract Address | \`${contractAddress}\` |
| Deploy Tx Hash | \`${deployTxHash}\` |
| Network | ${targetNetwork} |
| Deployed | ${new Date().toISOString()} |

## Demo Event

| Field | Value |
|---|---|
| Event ID | \`${demoEventHex}\` |
| Max Supply | 100 |
| Expiration | None |
| Public Mint | Yes |
| Metadata URI | \`ipfs://bafybeih6xhqqfxfyfqgw2xkjxhcxc4kdemoevent/metadata.json\` |
| Create Tx Hash | \`${eventTx.public.txHash}\` |
| Block Height | ${eventTx.public.blockHeight} |
`;

    // 'undeployed' keeps the original unsuffixed .env filename so the existing local workflow and
    // anything a developer has already scripted around it don't change.
    const deploymentMdName = `${targetNetwork}.md`;
    const envFileName = targetNetwork === 'undeployed' ? '.env.local' : `.env.${targetNetwork}.local`;

    const deploymentsDir = path.join(CONTRACTS_DIR, '..', 'deployments');
    fs.mkdirSync(deploymentsDir, { recursive: true });
    fs.writeFileSync(path.join(deploymentsDir, deploymentMdName), deploymentMd);
    logger.info(`Saved to deployments/${deploymentMdName}`);

    const envContent = `MIDNIGHT_NETWORK_ID=${targetNetwork}
MIDNIGHT_NODE_URL=${envConfig.nodeWS}
MIDNIGHT_INDEXER_URL=${envConfig.indexer}
MIDNIGHT_INDEXER_WS=${envConfig.indexerWS}
MIDNIGHT_PROOF_SERVER_URL=${envConfig.proofServer}
CONTRACT_ADDRESS=${contractAddress}
DEMO_EVENT_ID=${demoEventHex}
ADMIN_SEED=${seedHex}
`;
    fs.writeFileSync(path.join(CONTRACTS_DIR, '..', envFileName), envContent);
    logger.info(`Saved to ${envFileName}`);

    logger.info('=== Deployment complete ===');
  } finally {
    await wallet.stop();
  }
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'Deployment failed');
  process.exit(1);
});
