import { Router } from 'express';
import type { Pool } from 'pg';

export function eventsRouter(db: Pool): Router {
  const router = Router();

  // GET /api/events — list all events (active first, then inactive)
  router.get('/', async (_req, res) => {
    try {
      const { rows } = await db.query(`
        SELECT event_id, issuer_pk, max_supply, expiration, is_active,
               is_public_mint, minted, created_block, created_tx, deactivated_block
        FROM events
        ORDER BY is_active DESC, created_block ASC
      `);
      res.json(rows.map(normaliseEvent));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  // GET /api/events/:eventId — single event + its token count
  router.get('/:eventId', async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT e.event_id, e.issuer_pk, e.max_supply, e.expiration, e.is_active,
                e.is_public_mint, e.minted, e.created_block, e.created_tx, e.deactivated_block,
                COUNT(t.token_id) FILTER (WHERE NOT t.is_burned) AS live_tokens
         FROM events e
         LEFT JOIN tokens t ON t.first_event_id = e.event_id
         WHERE e.event_id = $1
         GROUP BY e.event_id`,
        [req.params.eventId],
      );
      if (!rows.length) return res.status(404).json({ error: 'event not found' });
      res.json({ ...normaliseEvent(rows[0]), liveTokens: Number(rows[0].live_tokens) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  return router;
}

function normaliseEvent(row: Record<string, unknown>) {
  return {
    eventId:        row.event_id,
    issuerPk:       row.issuer_pk,
    maxSupply:      Number(row.max_supply),
    expiration:     Number(row.expiration),
    isActive:       row.is_active,
    isPublicMint:   row.is_public_mint,
    minted:         Number(row.minted),
    createdBlock:   row.created_block ? Number(row.created_block) : null,
    createdTx:      row.created_tx,
    deactivatedBlock: row.deactivated_block ? Number(row.deactivated_block) : null,
  };
}
