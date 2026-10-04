import { Router } from 'express';
import type { Pool } from 'pg';

// Disclosure requests are what a holder's wallet reads to know what it's
// being asked to prove (eventId/fieldId/setRoot) before building a real
// Merkle path — see publishDisclosureRequest / proveAttributeMembership in
// poap.compact. This data is meant to be public: it's the pinned question,
// never the hidden answer (value/rand never appear here or on-chain).
export function disclosuresRouter(db: Pool): Router {
  const router = Router();

  // GET /api/disclosure-requests — list, optionally scoped to one verifier
  // (e.g. so a verifier's own tooling can list what it has already asked)
  // and/or to one recipient (so a holder's wallet can list the requests
  // addressed to its pseudonym).
  router.get('/', async (req, res) => {
    try {
      const verifierPk = typeof req.query.verifierPk === 'string' ? req.query.verifierPk : undefined;
      const recipientPk = typeof req.query.recipientPk === 'string' ? req.query.recipientPk : undefined;
      const { rows } = await db.query(
        `SELECT request_id, verifier_pk, event_id, field_id, set_root, recipient_pk, published_block, published_tx
         FROM disclosure_requests
         WHERE ($1::text IS NULL OR verifier_pk = $1)
           AND ($2::text IS NULL OR recipient_pk = $2)
         ORDER BY published_block ASC`,
        [verifierPk ?? null, recipientPk ?? null],
      );
      res.json(rows.map(normaliseDisclosureRequest));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  // GET /api/disclosure-requests/:requestId — single request
  router.get('/:requestId', async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT request_id, verifier_pk, event_id, field_id, set_root, recipient_pk, published_block, published_tx
         FROM disclosure_requests
         WHERE request_id = $1`,
        [req.params.requestId],
      );
      if (!rows.length) return res.status(404).json({ error: 'disclosure request not found' });
      res.json(normaliseDisclosureRequest(rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  return router;
}

function normaliseDisclosureRequest(row: Record<string, unknown>) {
  return {
    requestId:      row.request_id,
    verifierPk:     row.verifier_pk,
    eventId:        row.event_id,
    fieldId:        row.field_id,
    setRoot:        row.set_root,
    // null = open request (any holder of the event may answer).
    recipientPk:    row.recipient_pk ?? null,
    publishedBlock: row.published_block ? Number(row.published_block) : null,
    publishedTx:    row.published_tx,
  };
}
