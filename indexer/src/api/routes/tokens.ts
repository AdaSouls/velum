import { Router } from 'express';
import type { Pool } from 'pg';

export function tokensRouter(db: Pool): Router {
  const router = Router();

  // GET /api/tokens/owner/:ownerPk — all non-burned tokens for a wallet (by owner pk hex)
  router.get('/owner/:ownerPk', async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT t.token_id, t.owner_pk, t.issuer_pk, t.first_event_id, t.is_burned,
                t.minted_block, t.minted_tx, t.burned_block, t.burned_tx,
                t.token_metadata_uri, t.token_private_metadata_commit, e.metadata_uri
         FROM tokens t
         JOIN events e ON e.event_id = t.first_event_id
         WHERE t.owner_pk = $1
         ORDER BY t.token_id ASC`,
        [req.params.ownerPk],
      );
      res.json(rows.map(normaliseToken));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  // GET /api/tokens/:tokenId — single token
  router.get('/:tokenId', async (req, res) => {
    try {
      const tokenId = Number(req.params.tokenId);
      if (!Number.isFinite(tokenId)) return res.status(400).json({ error: 'invalid tokenId' });
      const { rows } = await db.query(
        `SELECT t.token_id, t.owner_pk, t.issuer_pk, t.first_event_id, t.is_burned,
                t.minted_block, t.minted_tx, t.burned_block, t.burned_tx,
                t.token_metadata_uri, t.token_private_metadata_commit, e.metadata_uri
         FROM tokens t
         JOIN events e ON e.event_id = t.first_event_id
         WHERE t.token_id = $1`,
        [tokenId],
      );
      if (!rows.length) return res.status(404).json({ error: 'token not found' });
      res.json(normaliseToken(rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  // GET /api/tokens/:tokenId/attendance
  // No longer a meaningful concept: every claim mints a brand-new token, so a
  // token maps to exactly one event (see GET /api/tokens/:tokenId's
  // firstEventId) — there's nothing left to look up separately.
  router.get('/:tokenId/attendance', (_req, res) => {
    res.status(410).json({
      error: 'gone — a token now maps to exactly one event',
      note:  'see firstEventId on GET /api/tokens/:tokenId instead',
    });
  });

  return router;
}

export function normaliseToken(row: Record<string, unknown>) {
  return {
    tokenId:      Number(row.token_id),
    ownerPk:      row.owner_pk,
    issuerPk:     row.issuer_pk,
    firstEventId: row.first_event_id,
    isBurned:     row.is_burned,
    mintedBlock:  row.minted_block ? Number(row.minted_block) : null,
    mintedTx:     row.minted_tx,
    burnedBlock:  row.burned_block ? Number(row.burned_block) : null,
    burnedTx:     row.burned_tx,
    // This token's own metadata (inherited from the event at claim time, or
    // personalized per-recipient via mintTo) — prefer this over metadataURI
    // for rendering the actual badge.
    tokenMetadataURI:           row.token_metadata_uri ?? null,
    tokenPrivateMetadataCommit: row.token_private_metadata_commit ?? null,
    // The parent event's own metadata, for context (e.g. "part of event X").
    metadataURI:  row.metadata_uri ?? null,
  };
}
