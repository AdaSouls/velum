import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  contractAddress: required('CONTRACT_ADDRESS'),
  indexerWs:       process.env.MIDNIGHT_INDEXER_WS   ?? 'ws://127.0.0.1:8090/api/v1/graphql/ws',
  indexerHttp:     process.env.MIDNIGHT_INDEXER_URL   ?? 'http://127.0.0.1:8090/api/v1/graphql',
  dbUrl:           process.env.DATABASE_URL           ?? 'postgresql://poap:poap@localhost:5434/poap_indexer',
  apiPort:         Number(process.env.PORT ?? 3001),
  // Compact contract artifacts path (absolute)
  contractCjsPath: process.env.CONTRACT_CJS_PATH      ??
    '/Users/<user>/Projects/poap-midnight/contracts/src/managed/poap/contract/index.cjs',
};
