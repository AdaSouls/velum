/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  resolver: './js-resolver.cjs',
  // compact-runtime 0.6.13 (CJS) is only in the local midnight-examples monorepo.
  // The npm registry starts at 0.8.x (ESM), which is incompatible with compactc 0.10.6 output.
  moduleNameMapper: {
    '^@midnight-ntwrk/compact-runtime$':
      '/Users/<user>/Projects/midnight-network/midnight-examples-0.1.12/node_modules/@midnight-ntwrk/compact-runtime/dist/runtime.js',
    '^@midnight-ntwrk/midnight-js-network-id$':
      '/Users/<user>/Projects/midnight-network/midnight-examples-0.1.12/node_modules/@midnight-ntwrk/midnight-js-network-id',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
};
