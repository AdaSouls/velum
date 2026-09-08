-- AdaSouls POAP Indexer — initial schema

CREATE TABLE IF NOT EXISTS indexer_cursor (
  id           INTEGER PRIMARY KEY DEFAULT 1,
  last_block   BIGINT  NOT NULL DEFAULT 0,
  last_state   TEXT,                          -- hex-encoded ContractState for diff on restart
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO indexer_cursor (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS issuers (
  issuer_pk         TEXT    PRIMARY KEY,      -- hex of organizer Bytes[32]
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  registered_block  BIGINT,
  registered_tx     TEXT,
  deactivated_block BIGINT,
  deactivated_tx    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  event_id          TEXT    PRIMARY KEY,      -- hex of Bytes[32]
  issuer_pk         TEXT    NOT NULL REFERENCES issuers(issuer_pk),
  max_supply        BIGINT  NOT NULL,
  expiration        BIGINT  NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_public_mint    BOOLEAN NOT NULL DEFAULT TRUE,
  metadata_uri      TEXT    NOT NULL DEFAULT '', -- off-chain JSON (name/description/image/…), e.g. "ipfs://<CID>"
  minted            BIGINT  NOT NULL DEFAULT 0,
  -- hex of the EventRecord.privateAttributesRoot Merkle root (see
  -- proveAttributeMembership in poap.compact); all-zero = no private
  -- attributes committed. Informational only — the indexer never sees the
  -- attribute values or the disclosure proofs made against this root.
  private_attributes_root TEXT NOT NULL DEFAULT '',
  created_block     BIGINT,
  created_tx        TEXT,
  deactivated_block BIGINT,
  deactivated_tx    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tokens (
  token_id                      BIGINT  PRIMARY KEY,
  owner_pk                      TEXT    NOT NULL,         -- hex of Bytes[32]
  issuer_pk                     TEXT    NOT NULL REFERENCES issuers(issuer_pk),
  -- Column name kept as first_event_id for API stability even though, since every claim now
  -- mints a brand-new token, it's really just "the event" — there's no longer a "later" event
  -- to distinguish it from.
  first_event_id                TEXT    NOT NULL REFERENCES events(event_id),
  token_metadata_uri            TEXT    NOT NULL DEFAULT '', -- off-chain JSON for this specific token
  token_private_metadata_commit TEXT    NOT NULL DEFAULT '', -- hex of Bytes[32] persistentCommit, all-zero = none
  is_burned                     BOOLEAN NOT NULL DEFAULT FALSE,
  minted_block                  BIGINT,
  minted_tx                     TEXT,
  burned_block                  BIGINT,
  burned_tx                     TEXT,
  created_at                    TIMESTAMPTZ DEFAULT NOW()
);

-- Selective disclosure: nullifiers spent via proveAttributeMembershipOnce (the
-- single-use variant only — see handleDisclosures in poap-state.ts). By
-- design this table carries no eventId/fieldId/holder columns: the contract
-- never discloses them, so the indexer has nothing to store for them.
CREATE TABLE IF NOT EXISTS disclosure_nullifiers (
  nullifier   TEXT    PRIMARY KEY,      -- hex of Bytes[32]
  spent_block BIGINT,
  spent_tx    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent upgrade path for columns added after the initial table creation (CREATE TABLE IF
-- NOT EXISTS above is a no-op against an already-initialized table).
ALTER TABLE events ADD COLUMN IF NOT EXISTS metadata_uri TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS private_attributes_root TEXT NOT NULL DEFAULT '';
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS token_metadata_uri TEXT NOT NULL DEFAULT '';
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS token_private_metadata_commit TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS tokens_owner_pk_idx  ON tokens(owner_pk);
CREATE INDEX IF NOT EXISTS tokens_issuer_pk_idx ON tokens(issuer_pk);
CREATE INDEX IF NOT EXISTS tokens_first_event_id_idx ON tokens(first_event_id);
CREATE INDEX IF NOT EXISTS events_issuer_pk_idx ON events(issuer_pk);
