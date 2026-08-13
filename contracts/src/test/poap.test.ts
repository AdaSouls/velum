import { describe, it, expect } from '@jest/globals';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  PoapSimulator,
  ADMIN_SK,
  USER1_SK,
  USER2_SK,
  ISSUER1_SK,
  ISSUER2_SK,
  makeEventId,
} from './poap-simulator.js';

setNetworkId('undeployed');

const EVENT_A = makeEventId(1);
const EVENT_B = makeEventId(2);
const EVENT_C = makeEventId(3);

// ── createEvent ───────────────────────────────────────────────────────────────

describe('POAP contract — createEvent', () => {
  it('admin can create an event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const state = sim.createEvent(EVENT_A, 100n, 0n, true);
    expect(state.events.member(EVENT_A)).toBe(true);
    const ev = state.events.lookup(EVENT_A);
    expect(ev.maxSupply).toBe(100n);
    expect(ev.minted).toBe(0n);
    expect(ev.isActive).toBe(true);
    expect(ev.isPublicMint).toBe(true);
    expect(ev.metadataURI).toBe('ipfs://test-metadata');
  });

  it('stores a custom metadataURI and preserves it across mint/deactivate updates', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://bafy-event-a-metadata');
    expect(sim.getLedger().events.lookup(EVENT_A).metadataURI).toBe('ipfs://bafy-event-a-metadata');

    // minted counter update (mintTokenInternal rebuilds EventRecord) must not drop it
    const afterMint = sim.asUser(USER1_SK).claimOrUpdate(EVENT_A, true);
    expect(afterMint.events.lookup(EVENT_A).metadataURI).toBe('ipfs://bafy-event-a-metadata');

    // deactivation (also rebuilds EventRecord) must not drop it either
    const afterDeactivate = sim.asUser(ADMIN_SK).deactivateEvent(EVENT_A);
    expect(afterDeactivate.events.lookup(EVENT_A).metadataURI).toBe('ipfs://bafy-event-a-metadata');
  });

  it('any wallet can create an event — permissionless, no registration required', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const user1Pk = sim.asUser(USER1_SK).getCallerPk();
    expect(() => sim.createEvent(EVENT_A, 100n, 0n, true)).not.toThrow();
    expect(sim.getLedger().events.lookup(EVENT_A).organizer).toEqual(user1Pk);
  });

  it('registered issuer can create an event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();

    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 50n, 0n, true);

    const ev = sim.getLedger().events.lookup(EVENT_A);
    expect(ev.maxSupply).toBe(50n);
    expect(ev.organizer).toEqual(issuer1Pk);
  });

  it('creating the same event twice throws', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    expect(() => sim.createEvent(EVENT_A, 50n, 0n, true)).toThrow();
  });

  it('a deactivated issuer can still create events — the registry is a badge, not a gate', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();

    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    sim.asUser(ADMIN_SK).deactivateIssuer(issuer1Pk);
    expect(sim.getLedger().issuers.lookup(issuer1Pk).isActive).toBe(false);

    sim.asUser(ISSUER1_SK);
    expect(() => sim.createEvent(EVENT_A, 100n, 0n, true)).not.toThrow();
  });
});

// ── Pause / Unpause ───────────────────────────────────────────────────────────

describe('POAP contract — pause / unpause', () => {
  it('admin can pause and unpause', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.pause();
    expect(() => sim.createEvent(EVENT_A, 100n, 0n, true)).toThrow();
    sim.unpause();
    // should succeed after unpausing
    expect(() => sim.createEvent(EVENT_A, 100n, 0n, true)).not.toThrow();
  });

  it('non-admin cannot pause', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.asUser(USER1_SK);
    expect(() => sim.pause()).toThrow();
  });

  it('claimOrUpdate is blocked while paused', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.pause();
    sim.asUser(USER1_SK);
    expect(() => sim.claimOrUpdate(EVENT_A, false)).toThrow();
  });
});

// ── mintToken via claimOrUpdate ───────────────────────────────────────────────

describe('POAP contract — mintToken (via claimOrUpdate)', () => {
  it('new user mints a token and supply increments', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    const adminPk = sim.getCallerPk();

    sim.asUser(USER1_SK);
    const state = sim.claimOrUpdate(EVENT_A, false);

    expect(state.totalSupply).toBe(1n);
    expect(state.tokenOwner.member(0n)).toBe(true);
    expect(state.tokenFirstEvent.lookup(0n)).toEqual(EVENT_A);
    expect(state.events.lookup(EVENT_A).minted).toBe(1n);

    const ps = sim.getPrivateState();
    const adminPkHex = Buffer.from(adminPk).toString('hex');
    expect(ps.tokens[adminPkHex]).toBeDefined();
    expect(ps.tokens[adminPkHex].tokenId).toBe(0n);
    expect(ps.tokens[adminPkHex].attendance.eventIds).toHaveLength(1);
    expect(ps.tokens[adminPkHex].attendance.isSoulbound).toBe(false);
  });

  it('second claim on different event updates token without new mint', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.createEvent(EVENT_B, 100n, 0n, true);

    sim.asUser(USER1_SK);
    sim.claimOrUpdate(EVENT_A, false);
    const supplyAfterMint = sim.getLedger().totalSupply;

    sim.claimOrUpdate(EVENT_B, false);
    const supplyAfterUpdate = sim.getLedger().totalSupply;

    expect(supplyAfterMint).toBe(1n);
    expect(supplyAfterUpdate).toBe(1n); // no new token

    const adminPkHex = Buffer.from(sim.asUser(ADMIN_SK).getCallerPk()).toString('hex');
    sim.asUser(USER1_SK);
    expect(sim.getPrivateState().tokens[adminPkHex].attendance.eventIds).toHaveLength(2);
  });

  it('attending the same event twice is rejected', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK);
    sim.claimOrUpdate(EVENT_A, false);
    expect(() => sim.claimOrUpdate(EVENT_A, false)).toThrow();
  });

  it('claim fails on inactive event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.deactivateEvent(EVENT_A);

    sim.asUser(USER1_SK);
    expect(() => sim.claimOrUpdate(EVENT_A, false)).toThrow();
  });

  it('event organizer can deactivate their own event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);

    // Issuer deactivates their own event
    sim.deactivateEvent(EVENT_A);
    expect(sim.getLedger().events.lookup(EVENT_A).isActive).toBe(false);
  });

  it('claim fails when max supply is reached', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 1n, 0n, true);

    sim.asUser(USER1_SK).claimOrUpdate(EVENT_A, false);
    sim.asUser(USER2_SK);
    expect(() => sim.claimOrUpdate(EVENT_A, false)).toThrow();
  });

  it('soulbound flag is stored in private state', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    const adminPkHex = Buffer.from(sim.getCallerPk()).toString('hex');

    sim.asUser(USER1_SK).claimOrUpdate(EVENT_A, true);

    expect(sim.getPrivateState().tokens[adminPkHex].attendance.isSoulbound).toBe(true);
  });

  it('two different users each get their own token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK).claimOrUpdate(EVENT_A, false);
    const adminPkHex = Buffer.from(sim.asUser(ADMIN_SK).getCallerPk()).toString('hex');

    sim.asUser(USER1_SK);
    const tokenIdUser1 = sim.getPrivateState().tokens[adminPkHex].tokenId;

    sim.asUser(USER2_SK).claimOrUpdate(EVENT_A, false);
    const tokenIdUser2 = sim.getPrivateState().tokens[adminPkHex].tokenId;

    expect(tokenIdUser1).not.toBe(tokenIdUser2);
    expect(sim.getLedger().totalSupply).toBe(2n);
  });
});

// ── mintTo (organizer push-mint) ──────────────────────────────────────────────

describe('POAP contract — mintTo (organizer push-mint)', () => {
  it('event organizer can push-mint to a recipient', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, false); // not public mint

    // The recipient's mintTo target is their per-issuer holder pseudonym,
    // not their global caller pk — that's what tokenOwner will actually
    // store, and what the recipient's own claimOrUpdate will look for.
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(issuer1Pk);
    const state = sim.asUser(ISSUER1_SK).mintTo(EVENT_A, user1Pk);

    expect(state.totalSupply).toBe(1n);
    expect(state.tokenOwner.lookup(0n)).toEqual(user1Pk);
    expect(state.tokenIssuer.lookup(0n)).toEqual(issuer1Pk);
    expect(state.events.lookup(EVENT_A).minted).toBe(1n);
  });

  it('admin can push-mint for any event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    sim.createEvent(EVENT_A, 100n, 0n, false);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    const state = sim.asUser(ADMIN_SK).mintTo(EVENT_A, user1Pk);
    expect(state.tokenOwner.lookup(0n)).toEqual(user1Pk);
  });

  it('push-mint succeeds even though self-service claim is blocked for the same non-public event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    sim.createEvent(EVENT_A, 100n, 0n, false);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    // Self-service claim has no path when isPublicMint is false.
    expect(() => sim.asUser(USER1_SK).claimOrUpdate(EVENT_A, false)).toThrow();
    // The organizer can still mint it directly.
    expect(() => sim.asUser(ADMIN_SK).mintTo(EVENT_A, user1Pk)).not.toThrow();
  });

  it('non-organizer, non-admin cannot push-mint', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    sim.createEvent(EVENT_A, 100n, 0n, false);
    const user2Pk = sim.asUser(USER2_SK).getHolderPk(adminPk);

    sim.asUser(USER1_SK);
    expect(() => sim.mintTo(EVENT_A, user2Pk)).toThrow();
  });

  it('push-mint fails on inactive event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    sim.createEvent(EVENT_A, 100n, 0n, false);
    sim.deactivateEvent(EVENT_A);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK);
    expect(() => sim.mintTo(EVENT_A, user1Pk)).toThrow();
  });

  it('push-mint fails when max supply is reached', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    sim.createEvent(EVENT_A, 1n, 0n, false);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);
    const user2Pk = sim.asUser(USER2_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK).mintTo(EVENT_A, user1Pk);
    expect(() => sim.mintTo(EVENT_A, user2Pk)).toThrow();
  });

  it('push-mint fails if the recipient already has a token for that issuer', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    sim.createEvent(EVENT_A, 100n, 0n, false);
    sim.createEvent(EVENT_B, 100n, 0n, false);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK).mintTo(EVENT_A, user1Pk);
    expect(() => sim.mintTo(EVENT_B, user1Pk)).toThrow();
  });

  it('push-minted recipient reconciles on next claimOrUpdate instead of minting a duplicate token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    sim.createEvent(EVENT_A, 100n, 0n, false);
    sim.createEvent(EVENT_B, 100n, 0n, true);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK).mintTo(EVENT_A, user1Pk);
    expect(sim.getLedger().totalSupply).toBe(1n);

    // USER1's wallet has no local record of this token — it was minted by
    // the organizer, not claimed — so claimOrUpdate must reconcile rather
    // than mint a second token for the same issuer.
    const state = sim.asUser(USER1_SK).claimOrUpdate(EVENT_B, false);
    expect(state.totalSupply).toBe(1n);
    expect(state.tokenOwner.lookup(0n)).toEqual(user1Pk);

    const adminPkHex = Buffer.from(adminPk).toString('hex');
    sim.asUser(USER1_SK);
    const ps = sim.getPrivateState();
    expect(ps.tokens[adminPkHex].tokenId).toBe(0n);
    expect(ps.tokens[adminPkHex].attendance.eventIds).toEqual([EVENT_B]);
  });

  it('after reconciliation, subsequent claims use the fast private-cache path', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    sim.createEvent(EVENT_A, 100n, 0n, false);
    sim.createEvent(EVENT_B, 100n, 0n, true);
    sim.createEvent(EVENT_C, 100n, 0n, true);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK).mintTo(EVENT_A, user1Pk);
    sim.asUser(USER1_SK).claimOrUpdate(EVENT_B, false); // reconciles
    const state = sim.claimOrUpdate(EVENT_C, false); // fast path

    expect(state.totalSupply).toBe(1n); // still one token, never re-minted
    const adminPkHex = Buffer.from(adminPk).toString('hex');
    sim.asUser(USER1_SK);
    expect(sim.getPrivateState().tokens[adminPkHex].attendance.eventIds).toHaveLength(2);
  });
});

// ── Holder pseudonym unlinkability ────────────────────────────────────────────

describe('POAP contract — per-issuer holder pseudonym', () => {
  it('the same wallet gets different, uncorrelatable tokenOwner values for different issuers', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    const issuer2Pk = sim.asUser(ISSUER2_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    sim.asUser(ADMIN_SK).registerIssuer(issuer2Pk);
    sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(ISSUER2_SK).createEvent(EVENT_B, 100n, 0n, true);

    sim.asUser(USER1_SK).claimOrUpdate(EVENT_A, false);
    const stateA = sim.getLedger();
    sim.asUser(USER1_SK).claimOrUpdate(EVENT_B, false);
    const stateB = sim.getLedger();

    const ownerForIssuer1 = stateA.tokenOwner.lookup(0n);
    const ownerForIssuer2 = stateB.tokenOwner.lookup(1n);
    // Same real wallet (USER1), two different on-chain pseudonyms — an
    // observer cannot tell these two tokens belong to the same holder.
    expect(ownerForIssuer1).not.toEqual(ownerForIssuer2);
  });

  it('the same wallet+issuer pair always derives the same holder pk (needed for reconciliation)', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const first = sim.asUser(USER1_SK).getHolderPk(adminPk);
    const second = sim.asUser(USER1_SK).getHolderPk(adminPk);
    expect(first).toEqual(second);
  });
});

// ── Private metadata: commit / reveal ─────────────────────────────────────────

describe('POAP contract — private metadata commit/reveal', () => {
  const NO_PRIVATE_METADATA = new Uint8Array(32);

  it('event with no private part uses an all-zero commitment', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://public-only', NO_PRIVATE_METADATA);
    expect(sim.getLedger().events.lookup(EVENT_A).privateMetadataCommit).toEqual(NO_PRIVATE_METADATA);
  });

  it('reveal succeeds when the value+rand match the on-chain commitment', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    // Stand-in for a hash of {"neighborhood":"Palermo"} computed off-chain.
    const value = new Uint8Array(32).fill(7);
    const rand = new Uint8Array(32).fill(9);
    const commit = PoapSimulator.computePrivateMetadataCommit(value, rand);

    sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://buenos-aires-general', commit);
    expect(sim.getLedger().eventRevealedMetadata.member(EVENT_A)).toBe(false);

    const state = sim.revealPrivateMetadata(EVENT_A, value, rand);
    expect(state.eventRevealedMetadata.member(EVENT_A)).toBe(true);
    expect(state.eventRevealedMetadata.lookup(EVENT_A)).toEqual(value);
  });

  it('reveal fails with the wrong value', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const value = new Uint8Array(32).fill(7);
    const rand = new Uint8Array(32).fill(9);
    const commit = PoapSimulator.computePrivateMetadataCommit(value, rand);
    sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://buenos-aires-general', commit);

    const wrongValue = new Uint8Array(32).fill(1); // e.g. "Recoleta" instead of "Palermo"
    expect(() => sim.revealPrivateMetadata(EVENT_A, wrongValue, rand)).toThrow();
  });

  it('reveal is permissionless — anyone who knows the opening can reveal, no caller check', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const value = new Uint8Array(32).fill(7);
    const rand = new Uint8Array(32).fill(9);
    const commit = PoapSimulator.computePrivateMetadataCommit(value, rand);
    sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://buenos-aires-general', commit);

    // A token holder with no admin/organizer role can still reveal, as long
    // as they were told the (value, rand) opening off-chain.
    const state = sim.asUser(USER1_SK).revealPrivateMetadata(EVENT_A, value, rand);
    expect(state.eventRevealedMetadata.lookup(EVENT_A)).toEqual(value);
  });
});

// ── Multi-issuer ──────────────────────────────────────────────────────────────

describe('POAP contract — multi-issuer', () => {
  it('user gets separate tokens for different issuers', () => {
    const sim = new PoapSimulator(ADMIN_SK);

    // Register issuer1 and issuer2
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    const issuer2Pk = sim.asUser(ISSUER2_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    sim.asUser(ADMIN_SK).registerIssuer(issuer2Pk);

    // Each issuer creates an event
    sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(ISSUER2_SK).createEvent(EVENT_B, 100n, 0n, true);

    // USER1 claims both events
    sim.asUser(USER1_SK).claimOrUpdate(EVENT_A, false);
    sim.asUser(USER1_SK).claimOrUpdate(EVENT_B, false);

    const ps = sim.getPrivateState();
    const issuer1Key = Buffer.from(issuer1Pk).toString('hex');
    const issuer2Key = Buffer.from(issuer2Pk).toString('hex');

    // Two separate tokens, one per issuer
    expect(ps.tokens[issuer1Key]).toBeDefined();
    expect(ps.tokens[issuer2Key]).toBeDefined();
    expect(ps.tokens[issuer1Key].tokenId).not.toBe(ps.tokens[issuer2Key].tokenId);
    expect(sim.getLedger().totalSupply).toBe(2n);
  });

  it('updating issuer1 token does not affect issuer2 token', () => {
    const sim = new PoapSimulator(ADMIN_SK);

    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    const issuer2Pk = sim.asUser(ISSUER2_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    sim.asUser(ADMIN_SK).registerIssuer(issuer2Pk);

    sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(ISSUER1_SK).createEvent(EVENT_B, 100n, 0n, true);
    sim.asUser(ISSUER2_SK).createEvent(EVENT_C, 100n, 0n, true);

    sim.asUser(USER1_SK).claimOrUpdate(EVENT_A, false); // mints for issuer1
    sim.asUser(USER1_SK).claimOrUpdate(EVENT_C, false); // mints for issuer2
    sim.asUser(USER1_SK).claimOrUpdate(EVENT_B, false); // updates issuer1 token

    const ps = sim.getPrivateState();
    const i1 = Buffer.from(issuer1Pk).toString('hex');
    const i2 = Buffer.from(issuer2Pk).toString('hex');

    expect(ps.tokens[i1].attendance.eventIds).toHaveLength(2);
    expect(ps.tokens[i2].attendance.eventIds).toHaveLength(1);
    expect(sim.getLedger().totalSupply).toBe(2n); // still 2 tokens
  });
});

// ── Burn ──────────────────────────────────────────────────────────────────────

describe('POAP contract — burn', () => {
  it('token owner can burn their token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK).claimOrUpdate(EVENT_A, false);
    sim.burn(0n);

    expect(sim.getLedger().burnedTokens.member(0n)).toBe(true);
    expect(sim.getLedger().burnedTokens.lookup(0n)).toBe(true);
  });

  it('non-owner cannot burn a token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(USER1_SK).claimOrUpdate(EVENT_A, false);

    sim.asUser(USER2_SK);
    expect(() => sim.burn(0n)).toThrow();
  });

  it('burning the same token twice throws', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(USER1_SK).claimOrUpdate(EVENT_A, false);
    sim.burn(0n);
    expect(() => sim.burn(0n)).toThrow();
  });

  it('cannot update a burned token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.createEvent(EVENT_B, 100n, 0n, true);

    sim.asUser(USER1_SK).claimOrUpdate(EVENT_A, false);
    sim.burn(0n);

    // Tries to update the now-burned token
    expect(() => sim.claimOrUpdate(EVENT_B, false)).toThrow();
  });
});
