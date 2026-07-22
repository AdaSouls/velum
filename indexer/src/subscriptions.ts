/**
 * TASK-019: Midnight Indexer contract-event subscription.
 *
 * Subscribes to contract(address) events using the real GraphQL schema:
 *   subscription { contract(address, offset) { ... on ContractCall { operation state } } }
 *
 * For each event:
 *   1. Parse the current ledger state (parseState)
 *   2. Diff against the previous ledger state
 *   3. Persist changes via applyStateDiff
 *   4. Update the cursor in the DB
 */

import type { Client } from 'graphql-ws';
import type { Pool } from 'pg';
import { parseState, type LedgerView } from './parser.js';
import { applyStateDiff, type TxMeta } from './poap-state.js';
import { loadCursor, saveCursor } from './db.js';

// Subscription document — uses inline fragments for the ContractCallOrDeploy union
const CONTRACT_SUB = `
  subscription ContractSub($address: String!, $offset: BlockOffsetInput) {
    contract(address: $address, offset: $offset) {
      ... on ContractDeploy {
        transaction { hash block { height } }
        state
      }
      ... on ContractCall {
        transaction { hash block { height } }
        operation
        state
      }
    }
  }
`;

export async function startSubscription(
  client: Client,
  db: Pool,
  contractAddress: string,
): Promise<void> {
  const { lastBlock, lastState } = await loadCursor();
  console.log(`[sub] resuming from block ${lastBlock}`);

  // Restore previous ledger state for diffing (empty on first run)
  let prevLedger: LedgerView = lastState ? parseState(lastState) : emptyLedger();

  const offset = lastBlock > 0n ? { height: lastBlock.toString() } : undefined;

  return new Promise<void>((resolve, reject) => {
    const cleanup = client.subscribe<{ contract: ContractEvent }>(
      { query: CONTRACT_SUB, variables: { address: contractAddress, offset } },
      {
        next: async ({ data, errors }) => {
          if (errors?.length) {
            console.error('[sub] subscription errors:', errors);
            return;
          }
          if (!data?.contract) return;

          const event = data.contract;
          try {
            await handleEvent(db, event, prevLedger, (newPrev) => { prevLedger = newPrev; });
          } catch (err) {
            console.error('[sub] error handling event:', err);
          }
        },
        error: (err) => {
          console.error('[sub] fatal subscription error:', err);
          reject(err);
        },
        complete: () => {
          console.log('[sub] subscription completed');
          resolve();
        },
      },
    );
    // Expose cleanup so caller can close on shutdown
    (db as any)._subCleanup = cleanup;
  });
}

async function handleEvent(
  db: Pool,
  event: ContractEvent,
  prevLedger: LedgerView,
  setPrev: (l: LedgerView) => void,
): Promise<void> {
  const stateHex = event.state;
  const currLedger = parseState(stateHex);
  const operation = (event as ContractCall).operation ?? 'deploy';
  const tx = event.transaction;
  const meta: TxMeta = { txHash: tx.hash, blockHeight: BigInt(tx.block.height) };

  await applyStateDiff(db, operation, prevLedger, currLedger, meta);
  await saveCursor(meta.blockHeight, stateHex);
  setPrev(currLedger);
}

// ── Types ──────────────────────────────────────────────────────────────────────

type BlockRef  = { height: string };
type TxRef     = { hash: string; block: BlockRef };
type ContractDeploy = { state: string; transaction: TxRef; __typename?: 'ContractDeploy' };
type ContractCall   = { state: string; transaction: TxRef; operation: string; __typename?: 'ContractCall' };
type ContractEvent  = ContractDeploy | ContractCall;

// ── Empty ledger (used when no prior state exists) ─────────────────────────────

function emptyLedger(): LedgerView {
  return {
    totalSupply: 0n,
    tokenOwner:      [],
    tokenFirstEvent: [],
    tokenIssuer:     [],
    events:          [],
    issuers:         [],
    burnedTokens:    [],
    isPaused: false,
    adminPk:  new Uint8Array(32),
  };
}
