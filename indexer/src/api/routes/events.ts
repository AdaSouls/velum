import { Router } from 'express';
import type { Pool } from 'pg';
import { normaliseToken } from './tokens.js';

export function eventsRouter(db: Pool): Router {
  const router = Router();

  // GET /api/events — list all events (active first, then inactive)
  // Optional ?issuerPk=<hex> to scope to a single organizer's events server-side (issuer_pk is
  // indexed — see events_issuer_pk_idx).
  router.get('/', async (req, res) => {
    try {
      const issuerPk = typeof req.query.issuerPk === 'string' ? req.query.issuerPk : undefined;
      const { rows } = await db.query(
        `SELECT event_id, issuer_pk, max_supply, expiration, is_active,
                is_public_mint, metadata_uri, minted, created_block, created_tx, deactivated_block
         FROM events
         WHERE $1::text IS NULL OR issuer_pk = $1
         ORDER BY is_active DESC, created_block ASC`,
        [issuerPk ?? null],
      );
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
                e.is_public_mint, e.metadata_uri, e.minted, e.created_block, e.created_tx, e.deactivated_block,
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

  // GET /api/events/:eventId/tokens — all POAP tokens minted for this event.
  //
  // Optional ?includeBurned=false to exclude burned tokens (default: include them, each row
  // carries isBurned so the caller can decide).
  //
  // Every claim mints a brand-new token now (no more "update an existing token across events"
  // path), so this list is complete — it matches the event's `minted` count exactly, with no
  // untracked attendance gap like the old design had.
  router.get('/:eventId/tokens', async (req, res) => {
    try {
      const { rows: eventRows } = await db.query(
        'SELECT 1 FROM events WHERE event_id = $1',
        [req.params.eventId],
      );
      if (!eventRows.length) return res.status(404).json({ error: 'event not found' });

      const includeBurned = req.query.includeBurned !== 'false';
      const { rows } = await db.query(
        `SELECT t.token_id, t.owner_pk, t.issuer_pk, t.first_event_id, t.is_burned,
                t.minted_block, t.minted_tx, t.burned_block, t.burned_tx,
                t.token_metadata_uri, t.token_private_metadata_commit, e.metadata_uri
         FROM tokens t
         JOIN events e ON e.event_id = t.first_event_id
         WHERE t.first_event_id = $1
           AND ($2::boolean OR NOT t.is_burned)
         ORDER BY t.token_id ASC`,
        [req.params.eventId, includeBurned],
      );
      res.json(rows.map(normaliseToken));
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
    metadataURI:    row.metadata_uri,
    minted:         Number(row.minted),
    createdBlock:   row.created_block ? Number(row.created_block) : null,
    createdTx:      row.created_tx,
    deactivatedBlock: row.deactivated_block ? Number(row.deactivated_block) : null,
  };
}
