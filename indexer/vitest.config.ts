import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

// Midnight packages live in the examples monorepo, not in local node_modules.
// NODE_PATH works for tsx/node but Vite's resolver ignores it, so alias them explicitly.
const MIDNIGHT_MODULES = '/Users/<user>/Projects/midnight-network/midnight-examples-0.1.12/node_modules';

function midnightAlias(pkg: string) {
  return { find: pkg, replacement: path.join(MIDNIGHT_MODULES, pkg) };
}

export default defineConfig({
  resolve: {
    alias: [
      midnightAlias('@midnight-ntwrk/compact-runtime'),
      midnightAlias('@midnight-ntwrk/midnight-js-network-id'),
      midnightAlias('graphql-ws'),
    ],
  },
  test: {
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 10_000,
  },
});
