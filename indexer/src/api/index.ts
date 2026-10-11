import cors from 'cors';
import express from 'express';
import type { Pool } from 'pg';
import { eventsRouter } from './routes/events.js';
import { tokensRouter } from './routes/tokens.js';
import { disclosuresRouter } from './routes/disclosures.js';
import { credentialRequestsRouter } from './routes/credential-requests.js';
import { updateRequestsRouter } from './routes/update-requests.js';
import { config } from '../config.js';

export function startApiServer(db: Pool): void {
  const app = express();

  if (config.corsAllowedOrigins?.length) {
    app.use(cors({ origin: config.corsAllowedOrigins }));
    console.log(`[api] CORS enabled for: ${config.corsAllowedOrigins.join(', ')}`);
  }

  app.use(express.json());

  // Health
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Indexing position: the block of the last contract action applied. A monitor compares it with
  // the contract's latest action on Midnight's indexer to tell a stalled indexer from a quiet
  // contract, which /health cannot do.
  app.get('/api/status', async (_req, res) => {
    try {
      const { rows } = await db.query<{ last_block: string; updated_at: Date | null }>(
        'SELECT last_block, updated_at FROM indexer_cursor WHERE id = 1',
      );
      res.json({
        networkId: config.networkId,
        contractAddress: config.contractAddress,
        lastBlock: Number(rows[0]?.last_block ?? 0),
        updatedAt: rows[0]?.updated_at?.toISOString() ?? null,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  // POAP routes
  app.use('/api/events', eventsRouter(db));
  app.use('/api/tokens', tokensRouter(db));
  app.use('/api/disclosure-requests', disclosuresRouter(db));
  app.use('/api/credential-requests', credentialRequestsRouter(db));
  app.use('/api/credential-update-requests', updateRequestsRouter(db));

  app.listen(config.apiPort, () => {
    console.log(`[api] listening on http://localhost:${config.apiPort}`);
  });
}
