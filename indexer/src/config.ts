import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  contractAddress: required('CONTRACT_ADDRESS'),
  // devnet.yml's indexer-standalone service (new-generation SDK devnet — see docs/environment.md)
  indexerWs:       process.env.MIDNIGHT_INDEXER_WS   ?? 'ws://127.0.0.1:8088/api/v4/graphql/ws',
  indexerHttp:     process.env.MIDNIGHT_INDEXER_URL   ?? 'http://127.0.0.1:8088/api/v4/graphql',
  // The indexer app's own business-data Postgres (docker-compose.devnet.yml's poap-pg service —
  // unrelated to Midnight SDK generation, so it stays on the old compose file)
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
  // parser.ts's initContractModule().
  contractModulePath: process.env.CONTRACT_MODULE_PATH ??
    '/Users/<user>/Projects/poap-midnight/contracts/src/managed/poap/contract/index.js',
};
