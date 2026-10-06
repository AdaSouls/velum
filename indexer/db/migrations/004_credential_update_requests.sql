-- Credential update requests: a holder asks the token's issuer to re-issue a credential, e.g.
-- because an identity document behind one of its attributes changed (requestCredentialUpdate in
-- poap.compact). The ledger only keeps PENDING requests (tokenId → payload commitment); this table
-- also keeps how each one was closed, so a holder's wallet can tell "dismissed" from "re-issued".
--
-- One row per token: filing again after a dismissal reopens the same row. The request's content
-- (which document, the new number) is off-chain, encrypted to the issuer; payload_commit is what
-- the issuer checks that envelope against.
--
-- status: 'pending'   — on the ledger now.
--         'dismissed' — removed by dismissCredentialUpdate (issuer or admin).
--         'burned'    — removed because the token was burned: the issuer re-issuing (burn, then
--                       mintTo the updated credential), a revocation, or a self-burn.
--
-- Safe to run on every start.
CREATE TABLE IF NOT EXISTS credential_update_requests (
  token_id        BIGINT  PRIMARY KEY REFERENCES tokens(token_id),
  payload_commit  TEXT    NOT NULL,         -- hex of Bytes[32]
  status          TEXT    NOT NULL,         -- 'pending' | 'dismissed' | 'burned'
  requested_block BIGINT,
  requested_tx    TEXT,
  closed_block    BIGINT,
  closed_tx       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credential_update_requests_status_idx ON credential_update_requests(status);
