/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  resolver: './js-resolver.cjs',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
};
