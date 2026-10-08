import { Router } from 'express';
import type { Pool } from 'pg';

// Credential requests (publishCredentialRequest in poap.compact): a verifier's
// question of up to four conditions about one holder's credential, answered
// all together by proveCredentialAttributes. A holder's wallet lists the ones
// addressed to its pseudonym; a verifier's tooling lists the ones it asked.
// Public by design: the pinned question, never the hidden answers.
export function credentialRequestsRouter(db: Pool): Router {
  const router = Router();

  // GET /api/credential-requests — list, optionally scoped to one verifier,
  // one recipient pseudonym and/or one event.
  router.get('/', async (req, res) => {
    try {
      const verifierPk = typeof req.query.verifierPk === 'string' ? req.query.verifierPk : undefined;
      const recipientPk = typeof req.query.recipientPk === 'string' ? req.query.recipientPk : undefined;
      const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : undefined;
      const { rows } = await db.query(
        `${SELECT}
         WHERE ($1::text IS NULL OR verifier_pk = $1)
           AND ($2::text IS NULL OR recipient_pk = $2)
           AND ($3::text IS NULL OR event_id = $3)
         ORDER BY published_block ASC`,
        [verifierPk ?? null, recipientPk ?? null, eventId ?? null],
      );
      res.json(rows.map(normaliseCredentialRequest));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  // GET /api/credential-requests/:requestId — single request
  router.get('/:requestId', async (req, res) => {
    try {
      const { rows } = await db.query(`${SELECT} WHERE request_id = $1`, [req.params.requestId]);
      if (!rows.length) return res.status(404).json({ error: 'credential request not found' });
      res.json(normaliseCredentialRequest(rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  return router;
}

const SELECT = `
  SELECT request_id, verifier_pk, event_id, recipient_pk, conditions, published_block, published_tx
  FROM credential_requests`;

function normaliseCredentialRequest(row: Record<string, unknown>) {
  return {
    requestId:      row.request_id,
    verifierPk:     row.verifier_pk,
    eventId:        row.event_id,
    recipientPk:    row.recipient_pk,
    // The used conditions, in order: [{ slot, fieldId, setRoot }]. `slot` is
    // the position of the answer in proveCredentialAttributes' vectors.
    conditions:     row.conditions,
    publishedBlock: row.published_block ? Number(row.published_block) : null,
    publishedTx:    row.published_tx,
  };
}
