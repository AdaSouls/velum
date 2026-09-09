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
  buildMerklePath,
} from './poap-simulator.js';

setNetworkId('undeployed');

// These are LABELS now, not raw eventIds — createEvent derives the real
// on-chain eventId as hash(organizerPk, label) (see event_key in
// poap.compact, the fix for the confirmed event-ID-squatting
// vulnerability). Each test captures createEvent's return value (the real
// derived id) into a local `eventA`/`eventB`/`eventC` and uses THAT for
// every subsequent lookup/claim/etc. — never the raw label constant.
const EVENT_A = makeEventId(1);
const EVENT_B = makeEventId(2);
const EVENT_C = makeEventId(3);

// ── createEvent ───────────────────────────────────────────────────────────────

describe('POAP contract — createEvent', () => {
  it('admin can create an event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    const state = sim.getLedger();
    expect(state.events.member(eventA)).toBe(true);
    const ev = state.events.lookup(eventA);
    expect(ev.maxSupply).toBe(100n);
    expect(ev.minted).toBe(0n);
    expect(ev.isActive).toBe(true);
    expect(ev.isPublicMint).toBe(true);
    expect(ev.metadataURI).toBe('ipfs://test-metadata');
  });

  it('createEvent returns the same id computeEventId predicts off-chain', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    expect(eventA).toEqual(PoapSimulator.computeEventId(adminPk, EVENT_A));
  });

  it('stores a custom metadataURI and preserves it across mint/deactivate updates', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://bafy-event-a-metadata');
    expect(sim.getLedger().events.lookup(eventA).metadataURI).toBe('ipfs://bafy-event-a-metadata');

    // minted counter update (mintTokenTo rebuilds EventRecord) must not drop it
    const afterMint = sim.asUser(USER1_SK).claim(eventA, true);
    expect(afterMint.events.lookup(eventA).metadataURI).toBe('ipfs://bafy-event-a-metadata');

    // deactivation (also rebuilds EventRecord) must not drop it either
    const afterDeactivate = sim.asUser(ADMIN_SK).deactivateEvent(eventA);
    expect(afterDeactivate.events.lookup(eventA).metadataURI).toBe('ipfs://bafy-event-a-metadata');
  });

  it('any wallet can create an event — permissionless, no registration required', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const user1Pk = sim.asUser(USER1_SK).getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    expect(sim.getLedger().events.lookup(eventA).organizer).toEqual(user1Pk);
  });

  it('registered issuer can create an event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();

    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    const eventA = sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 50n, 0n, true);

    const ev = sim.getLedger().events.lookup(eventA);
    expect(ev.maxSupply).toBe(50n);
    expect(ev.organizer).toEqual(issuer1Pk);
  });

  it('creating the same event twice throws', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    expect(() => sim.createEvent(EVENT_A, 50n, 0n, true)).toThrow();
  });

  it('the same label from two DIFFERENT organizers does not collide — no squatting', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventAAsAdmin = sim.createEvent(EVENT_A, 100n, 0n, true);
    const eventAAsUser1 = sim.asUser(USER1_SK).createEvent(EVENT_A, 50n, 0n, true);

    expect(eventAAsAdmin).not.toEqual(eventAAsUser1);
    expect(sim.getLedger().events.lookup(eventAAsAdmin).maxSupply).toBe(100n);
    expect(sim.getLedger().events.lookup(eventAAsUser1).maxSupply).toBe(50n);
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

  it('claim is blocked while paused', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.pause();
    sim.asUser(USER1_SK);
    expect(() => sim.claim(eventA, false)).toThrow();
  });
});

// ── claim: mint-every-time ────────────────────────────────────────────────────

describe('POAP contract — claim (mints a new token every time)', () => {
  it('new user claims an event and gets a token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK);
    const state = sim.claim(eventA, false);

    expect(state.totalSupply).toBe(1n);
    expect(state.tokenOwner.member(0n)).toBe(true);
    expect(state.tokenEvent.lookup(0n)).toEqual(eventA);
    expect(state.events.lookup(eventA).minted).toBe(1n);

    const ps = sim.getPrivateState();
    const eventAHex = Buffer.from(eventA).toString('hex');
    expect(ps.tokens[eventAHex]).toBeDefined();
    expect(ps.tokens[eventAHex].tokenId).toBe(0n);
    expect(ps.tokens[eventAHex].isSoulbound).toBe(false);
  });

  it('claiming a second event from the SAME issuer mints a SEPARATE new token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    const eventB = sim.createEvent(EVENT_B, 100n, 0n, true);

    sim.asUser(USER1_SK);
    sim.claim(eventA, false);
    const supplyAfterFirst = sim.getLedger().totalSupply;

    sim.claim(eventB, false);
    const supplyAfterSecond = sim.getLedger().totalSupply;

    expect(supplyAfterFirst).toBe(1n);
    expect(supplyAfterSecond).toBe(2n); // a brand-new token, not a reused one

    const state = sim.getLedger();
    expect(state.tokenEvent.lookup(0n)).toEqual(eventA);
    expect(state.tokenEvent.lookup(1n)).toEqual(eventB);
    // Same wallet, same issuer for both events → same holder pseudonym on both tokens
    expect(state.tokenOwner.lookup(0n)).toEqual(state.tokenOwner.lookup(1n));
  });

  it('claiming the same event twice is rejected', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK);
    sim.claim(eventA, false);
    expect(() => sim.claim(eventA, false)).toThrow();
  });

  it('claim fails on inactive event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.deactivateEvent(eventA);

    sim.asUser(USER1_SK);
    expect(() => sim.claim(eventA, false)).toThrow();
  });

  it('a reactivated event can be claimed again', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.deactivateEvent(eventA);
    sim.reactivateEvent(eventA);
    expect(sim.getLedger().events.lookup(eventA).isActive).toBe(true);

    sim.asUser(USER1_SK);
    expect(() => sim.claim(eventA, false)).not.toThrow();
  });

  it('event organizer can deactivate their own event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    const eventA = sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);

    // Issuer deactivates their own event
    sim.deactivateEvent(eventA);
    expect(sim.getLedger().events.lookup(eventA).isActive).toBe(false);
  });

  it('claim fails when max supply is reached', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 1n, 0n, true);

    sim.asUser(USER1_SK).claim(eventA, false);
    sim.asUser(USER2_SK);
    expect(() => sim.claim(eventA, false)).toThrow();
  });

  it('claim fails once the event has expired', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    // expiration = 1 (block time unit) — any real block time is >= 1, so
    // blockTimeLt(1) is false and mintTokenTo's expiration check fails.
    const eventA = sim.createEvent(EVENT_A, 100n, 1n, true);

    sim.asUser(USER1_SK);
    expect(() => sim.claim(eventA, false)).toThrow();
  });

  it('expiration = 0 means no expiration — claim never fails on that account', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK);
    expect(() => sim.claim(eventA, false)).not.toThrow();
  });

  it('soulbound flag is stored in private state', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    const eventAHex = Buffer.from(eventA).toString('hex');

    sim.asUser(USER1_SK).claim(eventA, true);

    expect(sim.getPrivateState().tokens[eventAHex].isSoulbound).toBe(true);
  });

  it('two different users each get their own token for the same event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);

    const user1Owner = sim.asUser(USER1_SK).claim(eventA, false).tokenOwner.lookup(0n);
    const user2Owner = sim.asUser(USER2_SK).claim(eventA, false).tokenOwner.lookup(1n);

    expect(user1Owner).not.toEqual(user2Owner);
    expect(sim.getLedger().totalSupply).toBe(2n);
  });

  it('claim mints with the event metadata inherited on the token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://event-a-badge');

    sim.asUser(USER1_SK);
    const state = sim.claim(eventA, false);

    expect(state.tokenMetadataURI.lookup(0n)).toBe('ipfs://event-a-badge');
  });
});

// ── mintTo (organizer push-mint) ──────────────────────────────────────────────

describe('POAP contract — mintTo (organizer push-mint)', () => {
  it('event organizer can push-mint to a recipient', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    const eventA = sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, false); // not public mint

    // The recipient's mintTo target is their per-issuer holder pseudonym,
    // not their global caller pk — that's what tokenOwner will actually
    // store, and what the recipient's own claim() would look for.
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(issuer1Pk);
    const state = sim.asUser(ISSUER1_SK).mintTo(eventA, user1Pk);

    expect(state.totalSupply).toBe(1n);
    expect(state.tokenOwner.lookup(0n)).toEqual(user1Pk);
    expect(state.tokenIssuer.lookup(0n)).toEqual(issuer1Pk);
    expect(state.events.lookup(eventA).minted).toBe(1n);
  });

  it('admin can push-mint for any event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, false);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    const state = sim.asUser(ADMIN_SK).mintTo(eventA, user1Pk);
    expect(state.tokenOwner.lookup(0n)).toEqual(user1Pk);
  });

  it('push-mint succeeds even though self-service claim is blocked for the same non-public event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, false);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    // Self-service claim has no path when isPublicMint is false.
    expect(() => sim.asUser(USER1_SK).claim(eventA, false)).toThrow();
    // The organizer can still mint it directly.
    expect(() => sim.asUser(ADMIN_SK).mintTo(eventA, user1Pk)).not.toThrow();
  });

  it('non-organizer, non-admin cannot push-mint', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, false);
    const user2Pk = sim.asUser(USER2_SK).getHolderPk(adminPk);

    sim.asUser(USER1_SK);
    expect(() => sim.mintTo(eventA, user2Pk)).toThrow();
  });

  it('push-mint fails on inactive event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, false);
    sim.deactivateEvent(eventA);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK);
    expect(() => sim.mintTo(eventA, user1Pk)).toThrow();
  });

  it('push-mint fails when max supply is reached', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 1n, 0n, false);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);
    const user2Pk = sim.asUser(USER2_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK).mintTo(eventA, user1Pk);
    expect(() => sim.mintTo(eventA, user2Pk)).toThrow();
  });

  it('push-mint fails once the event has expired', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 100n, 1n, false);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK);
    expect(() => sim.mintTo(eventA, user1Pk)).toThrow();
  });

  it('push-mint fails once the issuer has been deactivated', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    const eventA = sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, false);
    sim.asUser(ADMIN_SK).deactivateIssuer(issuer1Pk);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(issuer1Pk);

    sim.asUser(ISSUER1_SK);
    expect(() => sim.mintTo(eventA, user1Pk)).toThrow();
  });

  it('push-mint fails if the recipient already claimed this SAME event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, false);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK).mintTo(eventA, user1Pk);
    expect(() => sim.mintTo(eventA, user1Pk)).toThrow();
  });

  it('a recipient already push-minted for one event can still be push-minted for a DIFFERENT event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, false);
    const eventB = sim.createEvent(EVENT_B, 100n, 0n, false);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK).mintTo(eventA, user1Pk);
    // Old model blocked this (one token per issuer); new model allows it —
    // each event is independent.
    expect(() => sim.mintTo(eventB, user1Pk)).not.toThrow();
    expect(sim.getLedger().totalSupply).toBe(2n);
  });

  it('organizer can push a personalized tokenMetadataURI, independent of the event default', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, false, 'ipfs://event-a-badge');
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    const state = sim
      .asUser(ADMIN_SK)
      .mintTo(eventA, user1Pk, 'ipfs://user1-personalized-badge');

    expect(state.tokenMetadataURI.lookup(0n)).toBe('ipfs://user1-personalized-badge');
    // The event's own metadata is untouched.
    expect(state.events.lookup(eventA).metadataURI).toBe('ipfs://event-a-badge');
  });

  it('claiming a self-service event later does not interact with an unrelated push-minted token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, false); // organizer-only
    const eventB = sim.createEvent(EVENT_B, 100n, 0n, true); // public
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK).mintTo(eventA, user1Pk);
    expect(sim.getLedger().totalSupply).toBe(1n);

    // USER1 independently claims EVENT_B — a brand-new, unrelated token,
    // no reconciliation step involved (there isn't one anymore).
    const state = sim.asUser(USER1_SK).claim(eventB, false);
    expect(state.totalSupply).toBe(2n);
    expect(state.tokenEvent.lookup(0n)).toEqual(eventA);
    expect(state.tokenEvent.lookup(1n)).toEqual(eventB);

    const eventBHex = Buffer.from(eventB).toString('hex');
    const ps = sim.getPrivateState();
    // USER1's private cache only knows about the event it actually claimed
    // itself — it was never told about the push-minted EVENT_A token.
    expect(ps.tokens[eventBHex].tokenId).toBe(1n);
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
    const eventA = sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    const eventB = sim.asUser(ISSUER2_SK).createEvent(EVENT_B, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(eventA, false);
    const stateA = sim.getLedger();
    sim.asUser(USER1_SK).claim(eventB, false);
    const stateB = sim.getLedger();

    const ownerForIssuer1 = stateA.tokenOwner.lookup(0n);
    const ownerForIssuer2 = stateB.tokenOwner.lookup(1n);
    // Same real wallet (USER1), two different on-chain pseudonyms — an
    // observer cannot tell these two tokens belong to the same holder.
    expect(ownerForIssuer1).not.toEqual(ownerForIssuer2);
  });

  it('the same wallet+issuer pair always derives the same holder pk (needed for the dedup check)', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const first = sim.asUser(USER1_SK).getHolderPk(adminPk);
    const second = sim.asUser(USER1_SK).getHolderPk(adminPk);
    expect(first).toEqual(second);
  });

  it('two tokens from the SAME issuer still share the same holder pseudonym', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    const eventB = sim.createEvent(EVENT_B, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(eventA, false);
    sim.asUser(USER1_SK).claim(eventB, false);

    const state = sim.getLedger();
    expect(state.tokenOwner.lookup(0n)).toEqual(state.tokenOwner.lookup(1n));
  });
});

// ── Metadata: commit / reveal (event-level) ───────────────────────────────────

describe('POAP contract — event private metadata commit/reveal', () => {
  const NO_PRIVATE_METADATA = new Uint8Array(32);

  it('event with no private part uses an all-zero commitment', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://public-only', NO_PRIVATE_METADATA);
    expect(sim.getLedger().events.lookup(eventA).privateMetadataCommit).toEqual(NO_PRIVATE_METADATA);
  });

  it('revealing an event with no private part throws (all-zero sentinel rejected)', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://public-only', NO_PRIVATE_METADATA);
    expect(() => sim.revealPrivateMetadata(eventA, new Uint8Array(32), new Uint8Array(32))).toThrow(
      'Event has no private metadata',
    );
  });

  it('reveal succeeds when the value+rand match the on-chain commitment', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    // Stand-in for a hash of {"neighborhood":"Palermo"} computed off-chain.
    const value = new Uint8Array(32).fill(7);
    const rand = new Uint8Array(32).fill(9);
    const commit = PoapSimulator.computePrivateMetadataCommit(value, rand);

    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://buenos-aires-general', commit);
    expect(sim.getLedger().eventRevealedMetadata.member(eventA)).toBe(false);

    const state = sim.revealPrivateMetadata(eventA, value, rand);
    expect(state.eventRevealedMetadata.member(eventA)).toBe(true);
    expect(state.eventRevealedMetadata.lookup(eventA)).toEqual(value);
  });

  it('reveal fails with the wrong value', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const value = new Uint8Array(32).fill(7);
    const rand = new Uint8Array(32).fill(9);
    const commit = PoapSimulator.computePrivateMetadataCommit(value, rand);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://buenos-aires-general', commit);

    const wrongValue = new Uint8Array(32).fill(1); // e.g. "Recoleta" instead of "Palermo"
    expect(() => sim.revealPrivateMetadata(eventA, wrongValue, rand)).toThrow();
  });

  it('reveal is permissionless — anyone who knows the opening can reveal, no caller check', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const value = new Uint8Array(32).fill(7);
    const rand = new Uint8Array(32).fill(9);
    const commit = PoapSimulator.computePrivateMetadataCommit(value, rand);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://buenos-aires-general', commit);

    // A token holder with no admin/organizer role can still reveal, as long
    // as they were told the (value, rand) opening off-chain.
    const state = sim.asUser(USER1_SK).revealPrivateMetadata(eventA, value, rand);
    expect(state.eventRevealedMetadata.lookup(eventA)).toEqual(value);
  });
});

// ── Metadata: commit / reveal (per-token) ─────────────────────────────────────

describe('POAP contract — per-token private metadata commit/reveal', () => {
  it('claim() sets tokenPrivateMetadataCommit from the event default (no private part → all-zero)', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://event-a-badge');

    sim.asUser(USER1_SK);
    const state = sim.claim(eventA, false);

    expect(state.tokenPrivateMetadataCommit.lookup(0n)).toEqual(new Uint8Array(32));
  });

  it('revealing a token with no private part throws (all-zero sentinel rejected)', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://event-a-badge');
    sim.asUser(USER1_SK).claim(eventA, false);

    expect(() => sim.revealPrivateTokenMetadata(0n, new Uint8Array(32), new Uint8Array(32))).toThrow(
      'Token has no private metadata',
    );
  });

  it('mintTo() can assign a hidden per-token commitment (e.g. a numbered edition)', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const editionNumber = new Uint8Array(32);
    editionNumber[31] = 1; // "edition #1", as a stand-in digest
    const rand = new Uint8Array(32).fill(3);
    const commit = PoapSimulator.computePrivateMetadataCommit(editionNumber, rand);

    const eventA = sim.createEvent(EVENT_A, 100n, 0n, false, 'ipfs://event-a-badge');
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);
    const state = sim
      .asUser(ADMIN_SK)
      .mintTo(eventA, user1Pk, 'ipfs://event-a-badge', commit);

    expect(state.tokenPrivateMetadataCommit.lookup(0n)).toEqual(commit);
    expect(state.tokenRevealedMetadata.member(0n)).toBe(false);
  });

  it('revealing a token commitment records it in tokenRevealedMetadata, independent of the event-level reveal', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const editionNumber = new Uint8Array(32);
    editionNumber[31] = 1;
    const rand = new Uint8Array(32).fill(3);
    const commit = PoapSimulator.computePrivateMetadataCommit(editionNumber, rand);

    const eventA = sim.createEvent(EVENT_A, 100n, 0n, false, 'ipfs://event-a-badge');
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);
    sim.asUser(ADMIN_SK).mintTo(eventA, user1Pk, 'ipfs://event-a-badge', commit);

    const state = sim.asUser(USER1_SK).revealPrivateTokenMetadata(0n, editionNumber, rand);
    expect(state.tokenRevealedMetadata.lookup(0n)).toEqual(editionNumber);
    // The event itself was never given private metadata — unaffected.
    expect(state.eventRevealedMetadata.member(eventA)).toBe(false);
  });

  it('token reveal fails with the wrong value', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const value = new Uint8Array(32).fill(5);
    const rand = new Uint8Array(32).fill(6);
    const commit = PoapSimulator.computePrivateMetadataCommit(value, rand);

    const eventA = sim.createEvent(EVENT_A, 100n, 0n, false, 'ipfs://event-a-badge');
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);
    sim.asUser(ADMIN_SK).mintTo(eventA, user1Pk, 'ipfs://event-a-badge', commit);

    const wrongValue = new Uint8Array(32).fill(9);
    expect(() => sim.revealPrivateTokenMetadata(0n, wrongValue, rand)).toThrow();
  });
});

// ── Multi-issuer ──────────────────────────────────────────────────────────────

describe('POAP contract — multi-issuer', () => {
  it('user gets separate tokens for different issuers', () => {
    const sim = new PoapSimulator(ADMIN_SK);

    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    const issuer2Pk = sim.asUser(ISSUER2_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    sim.asUser(ADMIN_SK).registerIssuer(issuer2Pk);

    const eventA = sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    const eventB = sim.asUser(ISSUER2_SK).createEvent(EVENT_B, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(eventA, false);
    sim.asUser(USER1_SK).claim(eventB, false);

    expect(sim.getLedger().totalSupply).toBe(2n);
    expect(sim.getLedger().tokenIssuer.lookup(0n)).toEqual(issuer1Pk);
    expect(sim.getLedger().tokenIssuer.lookup(1n)).toEqual(issuer2Pk);
  });

  it('claiming multiple events from the same issuer mints one token per event', () => {
    const sim = new PoapSimulator(ADMIN_SK);

    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    const issuer2Pk = sim.asUser(ISSUER2_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    sim.asUser(ADMIN_SK).registerIssuer(issuer2Pk);

    const eventA = sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    const eventB = sim.asUser(ISSUER1_SK).createEvent(EVENT_B, 100n, 0n, true);
    const eventC = sim.asUser(ISSUER2_SK).createEvent(EVENT_C, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(eventA, false); // issuer1
    sim.asUser(USER1_SK).claim(eventC, false); // issuer2
    sim.asUser(USER1_SK).claim(eventB, false); // issuer1 again — SEPARATE token now

    expect(sim.getLedger().totalSupply).toBe(3n); // one token per claim, not per issuer

    const ps = sim.getPrivateState();
    const eventAHex = Buffer.from(eventA).toString('hex');
    const eventBHex = Buffer.from(eventB).toString('hex');
    const eventCHex = Buffer.from(eventC).toString('hex');
    expect(ps.tokens[eventAHex].tokenId).toBe(0n);
    expect(ps.tokens[eventCHex].tokenId).toBe(1n);
    expect(ps.tokens[eventBHex].tokenId).toBe(2n);
  });
});

// ── Burn ──────────────────────────────────────────────────────────────────────

describe('POAP contract — burn', () => {
  it('token owner can burn their token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(eventA, false);
    sim.burn(0n);

    expect(sim.getLedger().burnedTokens.member(0n)).toBe(true);
    expect(sim.getLedger().burnedTokens.lookup(0n)).toBe(true);
  });

  it('non-owner cannot burn a token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(USER1_SK).claim(eventA, false);

    sim.asUser(USER2_SK);
    expect(() => sim.burn(0n)).toThrow();
  });

  it('burning the same token twice throws', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(USER1_SK).claim(eventA, false);
    sim.burn(0n);
    expect(() => sim.burn(0n)).toThrow();
  });

  it('burning one token does not affect another token for the same event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(eventA, false); // token 0
    sim.asUser(USER2_SK).claim(eventA, false); // token 1
    sim.asUser(USER1_SK);
    sim.burn(0n);

    expect(sim.getLedger().burnedTokens.member(0n)).toBe(true);
    expect(sim.getLedger().burnedTokens.member(1n)).toBe(false);
  });

  it('a self-burn frees the (holder, event) slot — the same wallet can claim again', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(eventA, false);
    sim.burn(0n);

    expect(() => sim.asUser(USER1_SK).claim(eventA, false)).not.toThrow();
    expect(sim.getLedger().totalSupply).toBe(2n); // a fresh token, not the burned one
  });

  it("an issuer/admin revocation does NOT free the slot — permanent exclusion", () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(eventA, false);
    sim.asUser(ADMIN_SK).burn(0n);

    expect(() => sim.asUser(USER1_SK).claim(eventA, false)).toThrow();
  });

  it("the event's organizer can revoke (burn) a token they issued, even though they don't own it", () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    const eventA = sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(USER1_SK).claim(eventA, false);

    sim.asUser(ISSUER1_SK);
    expect(() => sim.burn(0n)).not.toThrow();
    expect(sim.getLedger().burnedTokens.member(0n)).toBe(true);
  });

  it('admin can revoke (burn) any token, regardless of issuer', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    const eventA = sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(USER1_SK).claim(eventA, false);

    sim.asUser(ADMIN_SK);
    expect(() => sim.burn(0n)).not.toThrow();
    expect(sim.getLedger().burnedTokens.member(0n)).toBe(true);
  });

  it('a third party — not owner, not organizer, not admin — still cannot burn', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    const eventA = sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(USER1_SK).claim(eventA, false);

    sim.asUser(USER2_SK);
    expect(() => sim.burn(0n)).toThrow();
  });
});

// ── Selective Disclosure: privateAttributesRoot ────────────────────────────────

describe('POAP contract — privateAttributesRoot', () => {
  const NO_ATTRIBUTES = new Uint8Array(32);

  it('event with no attributes uses an all-zero root by default', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    expect(sim.getLedger().events.lookup(eventA).privateAttributesRoot).toEqual(NO_ATTRIBUTES);
  });

  it('createEvent stores a non-zero privateAttributesRoot', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const root = new Uint8Array(32).fill(42);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://event-a-badge', NO_ATTRIBUTES, root);
    expect(sim.getLedger().events.lookup(eventA).privateAttributesRoot).toEqual(root);
  });

  it('regression guard: minting (mintTokenTo rebuild) must not drop privateAttributesRoot', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const root = new Uint8Array(32).fill(42);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://event-a-badge', NO_ATTRIBUTES, root);
    sim.asUser(USER1_SK).claim(eventA, false);
    expect(sim.getLedger().events.lookup(eventA).privateAttributesRoot).toEqual(root);
  });

  it('regression guard: deactivateEvent rebuild must not drop privateAttributesRoot', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const root = new Uint8Array(32).fill(42);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://event-a-badge', NO_ATTRIBUTES, root);
    sim.deactivateEvent(eventA);
    expect(sim.getLedger().events.lookup(eventA).privateAttributesRoot).toEqual(root);
  });
});

// ── Selective Disclosure: publishDisclosureRequest + proveAttributeMembership ─
//
// Real end-to-end coverage using genuine Merkle paths built via
// buildMerklePath (poap-simulator.ts), which reimplements the confirmed
// on-chain algorithm rather than fabricating plausible-looking test data —
// see that helper's comment for the source references. If either side of
// this (the contract's assertions or buildMerklePath's algorithm) is wrong,
// these tests will fail — a mismatch on either end can't accidentally pass.
//
// SECURITY REGRESSION CONTEXT: an earlier version of this contract let the
// prover supply the expected set root directly as a circuit argument,
// which a security audit confirmed was exploitable — a prover could invent
// a one-member "set" containing exactly their own value and pass it off as
// a real answer to any question. The fix pins the question
// (event/field/set) on-chain via publishDisclosureRequest BEFORE anyone
// can prove against it. The tests marked "regression:" below specifically
// re-run the confirmed exploits and assert they are now rejected — do not
// weaken or remove these without re-reading the audit finding.

describe('POAP contract — publishDisclosureRequest', () => {
  const FIELD_LOCATION = new Uint8Array(32).fill(0xaa);
  const LABEL_1 = new Uint8Array(32).fill(0x01);

  it('publishing a request for a nonexistent event throws', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const setRoot = new Uint8Array(32).fill(0xff);
    expect(() => sim.publishDisclosureRequest(LABEL_1, EVENT_A, FIELD_LOCATION, setRoot)).toThrow();
  });

  it('the same verifier publishing the same label twice throws (no accidental overwrite)', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    const setRoot = new Uint8Array(32).fill(0xff);
    sim.publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, setRoot);
    expect(() => sim.publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, setRoot)).toThrow();
  });

  it('two different verifiers using the SAME label get different, independent requestIds — no squatting', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true);
    const setRoot = new Uint8Array(32).fill(0xff);

    const rid1 = sim.asUser(USER1_SK).publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, setRoot);
    const rid2 = sim.asUser(USER2_SK).publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, setRoot);
    expect(rid1).not.toEqual(rid2);
    // Both independently published and usable — USER2 publishing under the
    // same label did not overwrite or block USER1's request.
    expect(sim.getLedger().disclosureRequests.member(rid1)).toBe(true);
    expect(sim.getLedger().disclosureRequests.member(rid2)).toBe(true);
  });
});

describe('POAP contract — proveAttributeMembership (selective disclosure)', () => {
  const FIELD_LOCATION = new Uint8Array(32).fill(0xaa);
  const NO_ATTRIBUTES = new Uint8Array(32);
  const LABEL_1 = new Uint8Array(32).fill(0x01);

  function setUpEventWithAttribute(sim: PoapSimulator, value: Uint8Array, rand: Uint8Array) {
    const adminPk = sim.getCallerPk();
    const eventA = PoapSimulator.computeEventId(adminPk, EVENT_A);
    const leaf = PoapSimulator.computeAttributeLeaf(eventA, FIELD_LOCATION, value, rand);
    const attr = buildMerklePath(leaf, 8);
    sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://event-a', NO_ATTRIBUTES, attr.rootBytes);
    return { eventA, attr };
  }

  it('accepts a genuinely valid proof: committed attribute that is a member of the PUBLISHED (pinned) set', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const value = new Uint8Array(32).fill(7); // e.g. a hash standing in for "Argentina"
    const rand = new Uint8Array(32).fill(9);
    const { eventA, attr } = setUpEventWithAttribute(sim, value, rand);
    const set = buildMerklePath(value, 16); // value is the sole member of this ad hoc set

    // The verifier — not the prover — publishes the question first.
    const requestId = sim.publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, set.rootBytes);

    expect(() => sim.proveAttributeMembership(
      requestId, value, rand,
      { leaf: attr.leaf, path: attr.path },
      { leaf: set.leaf, path: set.path },
    )).not.toThrow();
  });

  it('regression (C-1 fix): an unpublished/self-invented request is rejected — the prover cannot pin their own question', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const value = new Uint8Array(32).fill(0xee); // a value in NO legitimate set
    const rand = new Uint8Array(32).fill(9);
    const { attr } = setUpEventWithAttribute(sim, value, rand);
    const forgedSet = buildMerklePath(value, 16); // attacker's own one-member "set"

    // The exact exploit the audit confirmed: attacker invents a requestId
    // that was never published via publishDisclosureRequest.
    const forgedRequestId = new Uint8Array(32).fill(0x99);
    expect(() => sim.proveAttributeMembership(
      forgedRequestId, value, rand,
      { leaf: attr.leaf, path: attr.path },
      { leaf: forgedSet.leaf, path: forgedSet.path },
    )).toThrow('Unknown disclosure request');
  });

  it('regression: a real requestId whose PUBLISHED setRoot does not match the prover-supplied set path still fails', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const value = new Uint8Array(32).fill(0xee);
    const rand = new Uint8Array(32).fill(9);
    const { eventA, attr } = setUpEventWithAttribute(sim, value, rand);

    // Verifier publishes a request pinned to a REAL set that does NOT contain `value`.
    const legitimateSet = buildMerklePath(new Uint8Array(32).fill(3), 16);
    const requestId = sim.publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, legitimateSet.rootBytes);

    // Prover tries to substitute their own forged set path for the pinned one.
    const forgedSet = buildMerklePath(value, 16);
    expect(() => sim.proveAttributeMembership(
      requestId, value, rand,
      { leaf: attr.leaf, path: attr.path },
      { leaf: forgedSet.leaf, path: forgedSet.path }, // doesn't match req.setRoot
    )).toThrow('Value is not a member of the requested set');
  });

  it('rejects a wrong value/rand opening (does not match the committed attribute)', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const value = new Uint8Array(32).fill(7);
    const rand = new Uint8Array(32).fill(9);
    const { eventA, attr } = setUpEventWithAttribute(sim, value, rand);
    const set = buildMerklePath(value, 16);
    const requestId = sim.publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, set.rootBytes);

    const wrongValue = new Uint8Array(32).fill(1); // e.g. "Brazil" instead of "Argentina"
    expect(() => sim.proveAttributeMembership(
      requestId, wrongValue, rand,
      { leaf: attr.leaf, path: attr.path },
      { leaf: set.leaf, path: set.path },
    )).toThrow();
  });

  it('rejects a tampered attribute path (recomputed root does not match privateAttributesRoot)', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const value = new Uint8Array(32).fill(7);
    const rand = new Uint8Array(32).fill(9);
    const { eventA, attr } = setUpEventWithAttribute(sim, value, rand);
    const set = buildMerklePath(value, 16);
    const requestId = sim.publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, set.rootBytes);

    const tamperedPath = attr.path.map((entry, i) =>
      i === 0 ? { ...entry, sibling: { field: entry.sibling.field + 1n } } : entry,
    );
    expect(() => sim.proveAttributeMembership(
      requestId, value, rand,
      { leaf: attr.leaf, path: tamperedPath },
      { leaf: set.leaf, path: set.path },
    )).toThrow();
  });

  it('rejects when the value is not actually a member of the published set', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const value = new Uint8Array(32).fill(7);
    const rand = new Uint8Array(32).fill(9);
    const { eventA, attr } = setUpEventWithAttribute(sim, value, rand);

    // Published set built for a DIFFERENT value — value is genuinely not a member.
    const unrelatedValue = new Uint8Array(32).fill(3);
    const set = buildMerklePath(unrelatedValue, 16);
    const requestId = sim.publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, set.rootBytes);

    expect(() => sim.proveAttributeMembership(
      requestId, value, rand,
      { leaf: attr.leaf, path: attr.path },
      { leaf: set.leaf, path: set.path }, // set's own leaf, doesn't match `value`
    )).toThrow();
  });

  it('rejects when the event has no committed attributes (all-zero root sentinel rejected)', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const eventA = sim.createEvent(EVENT_A, 100n, 0n, true); // no attributes committed
    const value = new Uint8Array(32).fill(7);
    const rand = new Uint8Array(32).fill(9);
    const set = buildMerklePath(value, 16);
    const requestId = sim.publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, set.rootBytes);
    const attr = buildMerklePath(PoapSimulator.computeAttributeLeaf(eventA, FIELD_LOCATION, value, rand), 8);

    expect(() => sim.proveAttributeMembership(
      requestId, value, rand,
      { leaf: attr.leaf, path: attr.path },
      { leaf: set.leaf, path: set.path },
    )).toThrow('Event has no committed attributes');
  });

  it('never writes to usedDisclosures — the stateless path leaves no ledger footprint', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const value = new Uint8Array(32).fill(7);
    const rand = new Uint8Array(32).fill(9);
    const { eventA, attr } = setUpEventWithAttribute(sim, value, rand);
    const set = buildMerklePath(value, 16);
    const requestId = sim.publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, set.rootBytes);

    const before = sim.getLedger().usedDisclosures.size();
    sim.proveAttributeMembership(
      requestId, value, rand,
      { leaf: attr.leaf, path: attr.path },
      { leaf: set.leaf, path: set.path },
    );
    expect(sim.getLedger().usedDisclosures.size()).toBe(before);
  });
});

describe('POAP contract — proveAttributeMembershipOnce (single-use disclosure)', () => {
  const FIELD_LOCATION = new Uint8Array(32).fill(0xaa);
  const NO_ATTRIBUTES = new Uint8Array(32);
  const LABEL_1 = new Uint8Array(32).fill(0x01);
  const LABEL_2 = new Uint8Array(32).fill(0x02);

  function setUp(sim: PoapSimulator) {
    const adminPk = sim.getCallerPk();
    const eventA = PoapSimulator.computeEventId(adminPk, EVENT_A);
    const value = new Uint8Array(32).fill(7);
    const rand = new Uint8Array(32).fill(9);
    const leaf = PoapSimulator.computeAttributeLeaf(eventA, FIELD_LOCATION, value, rand);
    const attr = buildMerklePath(leaf, 8);
    sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://event-a', NO_ATTRIBUTES, attr.rootBytes);
    const set = buildMerklePath(value, 16);
    return { eventA, value, rand, attr, set };
  }

  it('records a nullifier in usedDisclosures on first redemption', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const { eventA, value, rand, attr, set } = setUp(sim);
    const requestId = sim.publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, set.rootBytes);

    const state = sim.proveAttributeMembershipOnce(
      requestId, value, rand,
      { leaf: attr.leaf, path: attr.path },
      { leaf: set.leaf, path: set.path },
    );
    expect(state.usedDisclosures.size()).toBe(1n);
  });

  it('rejects redeeming the same published request twice from the same wallet', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const { eventA, value, rand, attr, set } = setUp(sim);
    const requestId = sim.publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, set.rootBytes);

    sim.proveAttributeMembershipOnce(
      requestId, value, rand,
      { leaf: attr.leaf, path: attr.path },
      { leaf: set.leaf, path: set.path },
    );
    expect(() => sim.proveAttributeMembershipOnce(
      requestId, value, rand,
      { leaf: attr.leaf, path: attr.path },
      { leaf: set.leaf, path: set.path },
    )).toThrow('Disclosure already redeemed for this request');
  });

  it('regression (H-1 fix): an unpublished/self-invented requestId is rejected — cannot manufacture fresh redemptions', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const { value, rand, attr, set } = setUp(sim);
    // Real exploit was: keep the predicate honest but vary requestId freely
    // to redeem indefinitely. Now requestId must reference a real,
    // previously-published request.
    for (let i = 0; i < 5; i++) {
      const forgedRequestId = new Uint8Array(32).fill(i + 1);
      expect(() => sim.proveAttributeMembershipOnce(
        forgedRequestId, value, rand,
        { leaf: attr.leaf, path: attr.path },
        { leaf: set.leaf, path: set.path },
      )).toThrow('Unknown disclosure request');
    }
    expect(sim.getLedger().usedDisclosures.size()).toBe(0n);
  });

  it('a genuinely different PUBLISHED request is a different nullifier — legitimately not blocked', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const { eventA, value, rand, attr, set } = setUp(sim);
    const requestId1 = sim.publishDisclosureRequest(LABEL_1, eventA, FIELD_LOCATION, set.rootBytes);
    const requestId2 = sim.publishDisclosureRequest(LABEL_2, eventA, FIELD_LOCATION, set.rootBytes);

    sim.proveAttributeMembershipOnce(
      requestId1, value, rand,
      { leaf: attr.leaf, path: attr.path },
      { leaf: set.leaf, path: set.path },
    );
    const state = sim.proveAttributeMembershipOnce(
      requestId2, value, rand,
      { leaf: attr.leaf, path: attr.path },
      { leaf: set.leaf, path: set.path },
    );
    expect(state.usedDisclosures.size()).toBe(2n);
  });
});
