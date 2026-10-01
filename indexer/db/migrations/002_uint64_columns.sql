-- Compact Uint<64> goes up to 2^64 - 1; BIGINT is signed and stops at 2^63 - 1. createEvent is
-- permissionless and accepts any Uint<64> for maxSupply/expiration, so with BIGINT one such event
-- made every later insert fail and stalled indexing for the whole contract. NUMERIC(20,0) holds
-- the full range. minted is bounded by maxSupply, so it gets the same type.
--
-- Safe to run on every start: altering a column to the type it already has is a no-op.
ALTER TABLE events ALTER COLUMN max_supply TYPE NUMERIC(20,0);
ALTER TABLE events ALTER COLUMN expiration TYPE NUMERIC(20,0);
ALTER TABLE events ALTER COLUMN minted     TYPE NUMERIC(20,0);
