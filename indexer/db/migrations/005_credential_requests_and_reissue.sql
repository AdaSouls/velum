-- Multi-condition credential requests and atomic re-issue (publishCredentialRequest,
-- proveCredentialAttributes and reissueCredential in poap.compact).
--
-- Safe to run on every start.

-- A verifier's question of up to four conditions about ONE holder's credential, answered all
-- together in a single proof. Always addressed. `conditions` is a JSON array of the used
-- conditions, in the request's order: [{ "slot": 0, "fieldId": "<hex>", "setRoot": "<hex>" }, …].
-- `slot` is the condition's position in the on-chain Vector<4>, which is where its answer goes in
-- proveCredentialAttributes.
CREATE TABLE IF NOT EXISTS credential_requests (
  request_id      TEXT    PRIMARY KEY,      -- hex of Bytes[32]
  verifier_pk     TEXT    NOT NULL,         -- hex of Bytes[32] — caller_pk() of whoever published it
  event_id        TEXT    NOT NULL REFERENCES events(event_id),
  recipient_pk    TEXT    NOT NULL,         -- hex of Bytes[32] — the holder pseudonym that must answer
  conditions      JSONB   NOT NULL,
  published_block BIGINT,
  published_tx    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credential_requests_verifier_pk_idx ON credential_requests(verifier_pk);
CREATE INDEX IF NOT EXISTS credential_requests_recipient_pk_idx ON credential_requests(recipient_pk);
CREATE INDEX IF NOT EXISTS credential_requests_event_id_idx ON credential_requests(event_id);

-- reissueCredential burns a token and mints its replacement to the same holder in one transaction.
-- The new token points back at the one it replaces.
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS replaces_token_id BIGINT;

-- An update request closed by a re-issue: status 'reissued', with the replacement token.
-- ('burned' now only means a revocation or a self-burn.)
ALTER TABLE credential_update_requests ADD COLUMN IF NOT EXISTS reissued_token_id BIGINT;
