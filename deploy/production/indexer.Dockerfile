# Velum indexer app (indexer/) — built from the REPO ROOT as context, because it is an npm
# workspace: the root package-lock.json and its "overrides" pin (a single
# @midnight-ntwrk/onchain-runtime-v3 instance — see scripts/deploy.ts's prerequisites for why two
# copies break WASM instanceof checks) only apply when installing through the root.
#
#   docker build -f deploy/production/indexer.Dockerfile -t velum-indexer .
FROM node:22-bookworm-slim

WORKDIR /app

# Manifests first so the dependency layer is cached across source-only changes.
COPY package.json package-lock.json ./
COPY contracts/package.json contracts/
COPY scripts/package.json scripts/
COPY indexer/package.json indexer/
# Dev dependencies included on purpose: the indexer runs from TypeScript source via tsx (a
# devDependency), same as `npm start` does locally.
RUN npm ci --workspace indexer --no-audit --no-fund && npm cache clean --force

COPY indexer/src indexer/src
COPY indexer/db indexer/db
# The compiled contract module the parser loads at runtime (config.ts's
# DEFAULT_CONTRACT_MODULE_PATH resolves ../../contracts/src/managed/poap/contract/index.js from
# indexer/src). Must be the build matching the deployed CONTRACT_ADDRESS.
COPY contracts/src/managed/poap/contract contracts/src/managed/poap/contract

WORKDIR /app/indexer
USER node
ENV NODE_ENV=production PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["/app/node_modules/.bin/tsx", "src/index.ts"]
