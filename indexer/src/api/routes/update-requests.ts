import { Router } from 'express';
import type { Pool } from 'pg';

const STATUSES = ['pending', 'dismissed', 'burned', 'reissued'];

// Credential update requests (requestCredentialUpdate in poap.compact): an
// issuer's tooling lists the pending ones for its tokens, a holder's wallet
// checks what happened to its own. Only the token and a commitment are
// public — the request's content travels off-chain, encrypted to the issuer.
export function updateRequestsRouter(db: Pool): Router {
  const router = Router();

  // GET /api/credential-update-requests — by request block ascending,
  // optionally scoped to one issuer, one holder pseudonym and/or one status.
  router.get('/', async (req, res) => {
    try {
      const issuerPk = typeof req.query.issuerPk === 'string' ? req.query.issuerPk : undefined;
      const ownerPk = typeof req.query.ownerPk === 'string' ? req.query.ownerPk : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      if (status !== undefined && !STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
      }
      const { rows } = await db.query(
        `${SELECT}
         WHERE ($1::text IS NULL OR t.issuer_pk = $1)
           AND ($2::text IS NULL OR t.owner_pk = $2)
           AND ($3::text IS NULL OR r.status = $3)
         ORDER BY r.requested_block ASC, r.token_id ASC`,
        [issuerPk ?? null, ownerPk ?? null, status ?? null],
      );
      res.json(rows.map(normaliseUpdateRequest));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  // GET /api/credential-update-requests/:tokenId — the token's latest request
  router.get('/:tokenId', async (req, res) => {
    try {
      const tokenId = Number(req.params.tokenId);
      if (!Number.isSafeInteger(tokenId) || tokenId < 0) return res.status(400).json({ error: 'invalid tokenId' });
      const { rows } = await db.query(`${SELECT} WHERE r.token_id = $1`, [tokenId]);
      if (!rows.length) return res.status(404).json({ error: 'update request not found' });
      res.json(normaliseUpdateRequest(rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  return router;
}

const SELECT = `
  SELECT r.token_id, r.payload_commit, r.status, r.requested_block, r.requested_tx,
         r.closed_block, r.closed_tx, r.reissued_token_id, t.owner_pk, t.issuer_pk, t.first_event_id
  FROM credential_update_requests r
  JOIN tokens t ON t.token_id = r.token_id`;

function normaliseUpdateRequest(row: Record<string, unknown>) {
  return {
    tokenId:        Number(row.token_id),
    ownerPk:        row.owner_pk,
    issuerPk:       row.issuer_pk,
    eventId:        row.first_event_id,
    payloadCommit:  row.payload_commit,
    status:         row.status,
    requestedBlock: row.requested_block ? Number(row.requested_block) : null,
    requestedTx:    row.requested_tx,
    // Set once the request leaves the ledger (dismissed, burned or reissued).
    closedBlock:    row.closed_block ? Number(row.closed_block) : null,
    closedTx:       row.closed_tx ?? null,
    // For 'reissued': the token that replaced this one (reissueCredential).
    reissuedTokenId: row.reissued_token_id != null ? Number(row.reissued_token_id) : null,
  };
}
