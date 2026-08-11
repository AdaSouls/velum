import cors from 'cors';
import express from 'express';
import type { Pool } from 'pg';
import { eventsRouter } from './routes/events.js';
import { tokensRouter } from './routes/tokens.js';
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

  // POAP routes
  app.use('/api/events', eventsRouter(db));
  app.use('/api/tokens', tokensRouter(db));

  app.listen(config.apiPort, () => {
    console.log(`[api] listening on http://localhost:${config.apiPort}`);
  });
}
