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
  minted            BIGINT  NOT NULL DEFAULT 0,
  created_block     BIGINT,
  created_tx        TEXT,
  deactivated_block BIGINT,
  deactivated_tx    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tokens (
  token_id          BIGINT  PRIMARY KEY,
  owner_pk          TEXT    NOT NULL,         -- hex of Bytes[32]
  issuer_pk         TEXT    NOT NULL REFERENCES issuers(issuer_pk),
  first_event_id    TEXT    NOT NULL REFERENCES events(event_id),
  is_burned         BOOLEAN NOT NULL DEFAULT FALSE,
  minted_block      BIGINT,
  minted_tx         TEXT,
  burned_block      BIGINT,
  burned_tx         TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tokens_owner_pk_idx  ON tokens(owner_pk);
CREATE INDEX IF NOT EXISTS tokens_issuer_pk_idx ON tokens(issuer_pk);
CREATE INDEX IF NOT EXISTS events_issuer_pk_idx ON events(issuer_pk);
