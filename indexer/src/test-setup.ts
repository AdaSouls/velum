// Runs before any test-file imports so config.ts does not throw on missing env vars.
process.env.CONTRACT_ADDRESS ??= 'test-contract-address-for-unit-tests';
process.env.DATABASE_URL     ??= 'postgresql://poap:poap@localhost:5434/poap_indexer';
