/**
 * TASK-019: Midnight Indexer contract-event subscription.
 *
 * Subscribes to contractActions(address) using the new-generation indexer-standalone GraphQL
 * schema (confirmed via introspection against a running indexer-standalone:4.2.1 — the old
 * indexer's `contract` field/`operation` field/`BlockOffsetInput` type were renamed to
 * `contractActions`/`entryPoint`/`BlockOffset`, and `state`/`transaction` moved onto the shared
 * ContractAction interface so they no longer need to be repeated per inline fragment):
 *   subscription { contractActions(address, offset) { state transaction {...} ... on ContractCall { entryPoint } } }
 *
 * The ContractAction interface now has three implementations: ContractDeploy, ContractCall, and
 * ContractUpdate (contract-maintenance changes, e.g. verifier key updates — no entryPoint).
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

const CONTRACT_SUB = `
  subscription ContractSub($address: HexEncoded!, $offset: BlockOffset) {
    contractActions(address: $address, offset: $offset) {
      __typename
      state
      transaction { hash block { height } }
      ... on ContractCall {
        entryPoint
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

  // BlockOffset.height is Int in the indexer-standalone v4 schema, not String —
  // sending a string here fails GraphQL variable coercion on resubscribe after a
  // restart (only path where lastBlock > 0), which silently kills the subscription.
  const offset = lastBlock > 0n ? { height: Number(lastBlock) } : undefined;

  return new Promise<void>((resolve, reject) => {
    const cleanup = client.subscribe<{ contractActions: ContractEvent }>(
      { query: CONTRACT_SUB, variables: { address: contractAddress, offset } },
      {
        next: async ({ data, errors }) => {
          if (errors?.length) {
            console.error('[sub] subscription errors:', errors);
            return;
          }
          if (!data?.contractActions) return;

          const event = data.contractActions;
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
  const operation = (event as ContractCall).entryPoint ?? (event.__typename === 'ContractUpdate' ? 'update' : 'deploy');
  const tx = event.transaction;
  const meta: TxMeta = { txHash: tx.hash, blockHeight: BigInt(tx.block.height) };

  await applyStateDiff(db, operation, prevLedger, currLedger, meta);
  await saveCursor(meta.blockHeight, stateHex);
  setPrev(currLedger);
}

// ── Types ──────────────────────────────────────────────────────────────────────

type BlockRef  = { height: string };
type TxRef     = { hash: string; block: BlockRef };
type ContractDeploy = { state: string; transaction: TxRef; __typename: 'ContractDeploy' };
type ContractCall   = { state: string; transaction: TxRef; entryPoint: string; __typename: 'ContractCall' };
type ContractUpdate = { state: string; transaction: TxRef; __typename: 'ContractUpdate' };
type ContractEvent  = ContractDeploy | ContractCall | ContractUpdate;

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
