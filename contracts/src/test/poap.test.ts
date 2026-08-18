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

    // minted counter update (mintTokenTo rebuilds EventRecord) must not drop it
    const afterMint = sim.asUser(USER1_SK).claim(EVENT_A, true);
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

  it('claim is blocked while paused', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.pause();
    sim.asUser(USER1_SK);
    expect(() => sim.claim(EVENT_A, false)).toThrow();
  });
});

// ── claim: mint-every-time ────────────────────────────────────────────────────

describe('POAP contract — claim (mints a new token every time)', () => {
  it('new user claims an event and gets a token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK);
    const state = sim.claim(EVENT_A, false);

    expect(state.totalSupply).toBe(1n);
    expect(state.tokenOwner.member(0n)).toBe(true);
    expect(state.tokenEvent.lookup(0n)).toEqual(EVENT_A);
    expect(state.events.lookup(EVENT_A).minted).toBe(1n);

    const ps = sim.getPrivateState();
    const eventAHex = Buffer.from(EVENT_A).toString('hex');
    expect(ps.tokens[eventAHex]).toBeDefined();
    expect(ps.tokens[eventAHex].tokenId).toBe(0n);
    expect(ps.tokens[eventAHex].isSoulbound).toBe(false);
  });

  it('claiming a second event from the SAME issuer mints a SEPARATE new token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.createEvent(EVENT_B, 100n, 0n, true);

    sim.asUser(USER1_SK);
    sim.claim(EVENT_A, false);
    const supplyAfterFirst = sim.getLedger().totalSupply;

    sim.claim(EVENT_B, false);
    const supplyAfterSecond = sim.getLedger().totalSupply;

    expect(supplyAfterFirst).toBe(1n);
    expect(supplyAfterSecond).toBe(2n); // a brand-new token, not a reused one

    const state = sim.getLedger();
    expect(state.tokenEvent.lookup(0n)).toEqual(EVENT_A);
    expect(state.tokenEvent.lookup(1n)).toEqual(EVENT_B);
    // Same wallet, same issuer for both events → same holder pseudonym on both tokens
    expect(state.tokenOwner.lookup(0n)).toEqual(state.tokenOwner.lookup(1n));
  });

  it('claiming the same event twice is rejected', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK);
    sim.claim(EVENT_A, false);
    expect(() => sim.claim(EVENT_A, false)).toThrow();
  });

  it('claim fails on inactive event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.deactivateEvent(EVENT_A);

    sim.asUser(USER1_SK);
    expect(() => sim.claim(EVENT_A, false)).toThrow();
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

    sim.asUser(USER1_SK).claim(EVENT_A, false);
    sim.asUser(USER2_SK);
    expect(() => sim.claim(EVENT_A, false)).toThrow();
  });

  it('soulbound flag is stored in private state', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    const eventAHex = Buffer.from(EVENT_A).toString('hex');

    sim.asUser(USER1_SK).claim(EVENT_A, true);

    expect(sim.getPrivateState().tokens[eventAHex].isSoulbound).toBe(true);
  });

  it('two different users each get their own token for the same event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);

    const user1Owner = sim.asUser(USER1_SK).claim(EVENT_A, false).tokenOwner.lookup(0n);
    const user2Owner = sim.asUser(USER2_SK).claim(EVENT_A, false).tokenOwner.lookup(1n);

    expect(user1Owner).not.toEqual(user2Owner);
    expect(sim.getLedger().totalSupply).toBe(2n);
  });

  it('claim mints with the event metadata inherited on the token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://event-a-badge');

    sim.asUser(USER1_SK);
    const state = sim.claim(EVENT_A, false);

    expect(state.tokenMetadataURI.lookup(0n)).toBe('ipfs://event-a-badge');
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
    // store, and what the recipient's own claim() would look for.
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
    expect(() => sim.asUser(USER1_SK).claim(EVENT_A, false)).toThrow();
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

  it('push-mint fails if the recipient already claimed this SAME event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    sim.createEvent(EVENT_A, 100n, 0n, false);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK).mintTo(EVENT_A, user1Pk);
    expect(() => sim.mintTo(EVENT_A, user1Pk)).toThrow();
  });

  it('a recipient already push-minted for one event can still be push-minted for a DIFFERENT event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    sim.createEvent(EVENT_A, 100n, 0n, false);
    sim.createEvent(EVENT_B, 100n, 0n, false);
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK).mintTo(EVENT_A, user1Pk);
    // Old model blocked this (one token per issuer); new model allows it —
    // each event is independent.
    expect(() => sim.mintTo(EVENT_B, user1Pk)).not.toThrow();
    expect(sim.getLedger().totalSupply).toBe(2n);
  });

  it('organizer can push a personalized tokenMetadataURI, independent of the event default', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    sim.createEvent(EVENT_A, 100n, 0n, false, 'ipfs://event-a-badge');
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    const state = sim
      .asUser(ADMIN_SK)
      .mintTo(EVENT_A, user1Pk, 'ipfs://user1-personalized-badge');

    expect(state.tokenMetadataURI.lookup(0n)).toBe('ipfs://user1-personalized-badge');
    // The event's own metadata is untouched.
    expect(state.events.lookup(EVENT_A).metadataURI).toBe('ipfs://event-a-badge');
  });

  it('claiming a self-service event later does not interact with an unrelated push-minted token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    sim.createEvent(EVENT_A, 100n, 0n, false); // organizer-only
    sim.createEvent(EVENT_B, 100n, 0n, true); // public
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);

    sim.asUser(ADMIN_SK).mintTo(EVENT_A, user1Pk);
    expect(sim.getLedger().totalSupply).toBe(1n);

    // USER1 independently claims EVENT_B — a brand-new, unrelated token,
    // no reconciliation step involved (there isn't one anymore).
    const state = sim.asUser(USER1_SK).claim(EVENT_B, false);
    expect(state.totalSupply).toBe(2n);
    expect(state.tokenEvent.lookup(0n)).toEqual(EVENT_A);
    expect(state.tokenEvent.lookup(1n)).toEqual(EVENT_B);

    const eventBHex = Buffer.from(EVENT_B).toString('hex');
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
    sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(ISSUER2_SK).createEvent(EVENT_B, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(EVENT_A, false);
    const stateA = sim.getLedger();
    sim.asUser(USER1_SK).claim(EVENT_B, false);
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
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.createEvent(EVENT_B, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(EVENT_A, false);
    sim.asUser(USER1_SK).claim(EVENT_B, false);

    const state = sim.getLedger();
    expect(state.tokenOwner.lookup(0n)).toEqual(state.tokenOwner.lookup(1n));
  });
});

// ── Metadata: commit / reveal (event-level) ───────────────────────────────────

describe('POAP contract — event private metadata commit/reveal', () => {
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

// ── Metadata: commit / reveal (per-token) ─────────────────────────────────────

describe('POAP contract — per-token private metadata commit/reveal', () => {
  it('claim() sets tokenPrivateMetadataCommit from the event default (no private part → all-zero)', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true, 'ipfs://event-a-badge');

    sim.asUser(USER1_SK);
    const state = sim.claim(EVENT_A, false);

    expect(state.tokenPrivateMetadataCommit.lookup(0n)).toEqual(new Uint8Array(32));
  });

  it('mintTo() can assign a hidden per-token commitment (e.g. a numbered edition)', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const editionNumber = new Uint8Array(32);
    editionNumber[31] = 1; // "edition #1", as a stand-in digest
    const rand = new Uint8Array(32).fill(3);
    const commit = PoapSimulator.computePrivateMetadataCommit(editionNumber, rand);

    sim.createEvent(EVENT_A, 100n, 0n, false, 'ipfs://event-a-badge');
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);
    const state = sim
      .asUser(ADMIN_SK)
      .mintTo(EVENT_A, user1Pk, 'ipfs://event-a-badge', commit);

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

    sim.createEvent(EVENT_A, 100n, 0n, false, 'ipfs://event-a-badge');
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);
    sim.asUser(ADMIN_SK).mintTo(EVENT_A, user1Pk, 'ipfs://event-a-badge', commit);

    const state = sim.asUser(USER1_SK).revealPrivateTokenMetadata(0n, editionNumber, rand);
    expect(state.tokenRevealedMetadata.lookup(0n)).toEqual(editionNumber);
    // The event itself was never given private metadata — unaffected.
    expect(state.eventRevealedMetadata.member(EVENT_A)).toBe(false);
  });

  it('token reveal fails with the wrong value', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const adminPk = sim.getCallerPk();
    const value = new Uint8Array(32).fill(5);
    const rand = new Uint8Array(32).fill(6);
    const commit = PoapSimulator.computePrivateMetadataCommit(value, rand);

    sim.createEvent(EVENT_A, 100n, 0n, false, 'ipfs://event-a-badge');
    const user1Pk = sim.asUser(USER1_SK).getHolderPk(adminPk);
    sim.asUser(ADMIN_SK).mintTo(EVENT_A, user1Pk, 'ipfs://event-a-badge', commit);

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

    sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(ISSUER2_SK).createEvent(EVENT_B, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(EVENT_A, false);
    sim.asUser(USER1_SK).claim(EVENT_B, false);

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

    sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(ISSUER1_SK).createEvent(EVENT_B, 100n, 0n, true);
    sim.asUser(ISSUER2_SK).createEvent(EVENT_C, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(EVENT_A, false); // issuer1
    sim.asUser(USER1_SK).claim(EVENT_C, false); // issuer2
    sim.asUser(USER1_SK).claim(EVENT_B, false); // issuer1 again — SEPARATE token now

    expect(sim.getLedger().totalSupply).toBe(3n); // one token per claim, not per issuer

    const ps = sim.getPrivateState();
    const eventAHex = Buffer.from(EVENT_A).toString('hex');
    const eventBHex = Buffer.from(EVENT_B).toString('hex');
    const eventCHex = Buffer.from(EVENT_C).toString('hex');
    expect(ps.tokens[eventAHex].tokenId).toBe(0n);
    expect(ps.tokens[eventCHex].tokenId).toBe(1n);
    expect(ps.tokens[eventBHex].tokenId).toBe(2n);
  });
});

// ── Burn ──────────────────────────────────────────────────────────────────────

describe('POAP contract — burn', () => {
  it('token owner can burn their token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(EVENT_A, false);
    sim.burn(0n);

    expect(sim.getLedger().burnedTokens.member(0n)).toBe(true);
    expect(sim.getLedger().burnedTokens.lookup(0n)).toBe(true);
  });

  it('non-owner cannot burn a token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(USER1_SK).claim(EVENT_A, false);

    sim.asUser(USER2_SK);
    expect(() => sim.burn(0n)).toThrow();
  });

  it('burning the same token twice throws', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(USER1_SK).claim(EVENT_A, false);
    sim.burn(0n);
    expect(() => sim.burn(0n)).toThrow();
  });

  it('burning one token does not affect another token for the same event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK).claim(EVENT_A, false); // token 0
    sim.asUser(USER2_SK).claim(EVENT_A, false); // token 1
    sim.asUser(USER1_SK);
    sim.burn(0n);

    expect(sim.getLedger().burnedTokens.member(0n)).toBe(true);
    expect(sim.getLedger().burnedTokens.member(1n)).toBe(false);
  });

  it("the event's organizer can revoke (burn) a token they issued, even though they don't own it", () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(USER1_SK).claim(EVENT_A, false);

    sim.asUser(ISSUER1_SK);
    expect(() => sim.burn(0n)).not.toThrow();
    expect(sim.getLedger().burnedTokens.member(0n)).toBe(true);
  });

  it('admin can revoke (burn) any token, regardless of issuer', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(USER1_SK).claim(EVENT_A, false);

    sim.asUser(ADMIN_SK);
    expect(() => sim.burn(0n)).not.toThrow();
    expect(sim.getLedger().burnedTokens.member(0n)).toBe(true);
  });

  it('a third party — not owner, not organizer, not admin — still cannot burn', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    const issuer1Pk = sim.asUser(ISSUER1_SK).getCallerPk();
    sim.asUser(ADMIN_SK).registerIssuer(issuer1Pk);
    sim.asUser(ISSUER1_SK).createEvent(EVENT_A, 100n, 0n, true);
    sim.asUser(USER1_SK).claim(EVENT_A, false);

    sim.asUser(USER2_SK);
    expect(() => sim.burn(0n)).toThrow();
  });
});
