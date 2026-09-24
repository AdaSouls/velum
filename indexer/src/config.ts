import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Derived from this file's own resolved location rather than hardcoded, and specifically NOT
// via a manually-typed absolute path string. On a case-insensitive-but-case-preserving filesystem
// (default macOS/APFS), a path typed with different casing than the real on-disk directory name
// (e.g. "POAP-Midnight" vs the actual "poap-midnight") points at the identical file, but Node's
// ESM loader keys its module cache on the literal resolved URL string — a casing mismatch between
// this value and however the rest of the process naturally resolves the same file (e.g. via
// process.cwd()) makes Node evaluate @midnight-ntwrk/onchain-runtime-v3's WASM glue TWICE, once
// per casing variant. Each evaluation gets its own WebAssembly.Instance and thus its own
// ChargedState/QueryContext classes, so `instanceof` silently fails across the two — surfacing as
// "expected instance of ChargedState" deep inside the compiled contract's ledger() function.
// Confirmed 2026-08-29 by instrumenting the installed package to log import.meta.url on load: one
// evaluation resolved through /Users/<user>/Projects/poap-midnight/... (this process's actual
// cwd casing) and the other through /Users/<user>/Projects/POAP-Midnight/... (this file's old
// hardcoded default / a manually-set CONTRACT_MODULE_PATH) — same file, two module identities.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONTRACT_MODULE_PATH = path.resolve(__dirname, '../../contracts/src/managed/poap/contract/index.js');

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  contractAddress: required('CONTRACT_ADDRESS'),
  // Affects address encoding/decoding and ledger state parsing — must match whichever network
  // indexerWs/indexerHttp below actually point at. Was hardcoded to 'undeployed' directly in
  // index.ts's setNetworkId() call until 2026-08-29, silently wrong for any non-local network.
  networkId:       process.env.MIDNIGHT_NETWORK_ID    ?? 'undeployed',
  // devnet.yml's indexer-standalone service (new-generation SDK devnet)
  indexerWs:       process.env.MIDNIGHT_INDEXER_WS   ?? 'ws://127.0.0.1:8088/api/v4/graphql/ws',
  indexerHttp:     process.env.MIDNIGHT_INDEXER_URL   ?? 'http://127.0.0.1:8088/api/v4/graphql',
  // The indexer app's own business-data Postgres (devnet.yml's poap-pg service — unrelated to
  // the Midnight SDK generation, just merged into the same compose file for convenience)
  dbUrl:           process.env.DATABASE_URL           ?? 'postgresql://poap:poap@localhost:5434/poap_indexer',
  apiPort:         Number(process.env.PORT ?? 3001),
  // Comma-separated allowlist of origins allowed to call the API cross-origin, e.g.
  // "http://localhost:5173,https://staging.adasouls.io". Unset (the default) disables
  // CORS entirely — same-origin only. Never falls back to "*".
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Compiled contract module path (absolute). ESM (index.js), loaded via dynamic import — see
  // parser.ts's initContractModule(). CONTRACT_MODULE_PATH overrides the derived default above —
  // only set it if the compiled contract genuinely lives somewhere other than the sibling
  // contracts/ workspace, and be careful to match the filesystem's actual casing exactly (see the
  // comment on DEFAULT_CONTRACT_MODULE_PATH above for why a casing mismatch silently breaks things).
  contractModulePath: process.env.CONTRACT_MODULE_PATH ?? DEFAULT_CONTRACT_MODULE_PATH,
};
