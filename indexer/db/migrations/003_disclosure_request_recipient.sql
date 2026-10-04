-- Addressed disclosure requests: publishDisclosureRequest takes a `recipient`, the holder
-- pseudonym (tokens.owner_pk) that must answer. NULL = open request, any holder of the event may
-- answer. Public on-chain like the rest of the request.
--
-- Safe to run on every start.
ALTER TABLE disclosure_requests ADD COLUMN IF NOT EXISTS recipient_pk TEXT;

CREATE INDEX IF NOT EXISTS disclosure_requests_recipient_pk_idx ON disclosure_requests(recipient_pk);
