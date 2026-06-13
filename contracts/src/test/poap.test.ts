import { describe, it, expect } from '@jest/globals';
import { networkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { PoapSimulator, ADMIN_SK, USER1_SK, USER2_SK, makeEventId } from './poap-simulator.js';

setNetworkId(networkId.undeployed);

const EVENT_A = makeEventId(1);
const EVENT_B = makeEventId(2);

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
  });

  it('non-admin cannot create an event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.asUser(USER1_SK);
    expect(() => sim.createEvent(EVENT_A, 100n, 0n, true)).toThrow();
  });

  it('creating the same event twice throws', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    expect(() => sim.createEvent(EVENT_A, 50n, 0n, true)).toThrow();
  });
});

describe('POAP contract — mintToken (via claimOrUpdate)', () => {
  it('new user mints a token and supply increments', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK);
    const state = sim.claimOrUpdate(EVENT_A, false);

    expect(state.totalSupply).toBe(1n);
    expect(state.tokenOwner.member(0n)).toBe(true);
    expect(state.tokenFirstEvent.lookup(0n)).toEqual(EVENT_A);
    expect(state.events.lookup(EVENT_A).minted).toBe(1n);

    const ps = sim.getPrivateState();
    expect(ps.token).toBeDefined();
    expect(ps.token!.tokenId).toBe(0n);
    expect(ps.token!.attendance.eventIds).toHaveLength(1);
    expect(ps.token!.attendance.isSoulbound).toBe(false);
  });

  it('second claim on different event updates token without new mint', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.createEvent(EVENT_B, 100n, 0n, true);

    sim.asUser(USER1_SK);
    sim.claimOrUpdate(EVENT_A, false);
    const supplyAfterMint = sim.getLedger().totalSupply;

    // Second claim: should update, not re-mint
    sim.claimOrUpdate(EVENT_B, false);
    const supplyAfterUpdate = sim.getLedger().totalSupply;

    expect(supplyAfterMint).toBe(1n);
    expect(supplyAfterUpdate).toBe(1n); // unchanged

    const ps = sim.getPrivateState();
    expect(ps.token!.attendance.eventIds).toHaveLength(2);
  });

  it('claim fails on inactive event', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);
    sim.deactivateEvent(EVENT_A);

    sim.asUser(USER1_SK);
    expect(() => sim.claimOrUpdate(EVENT_A, false)).toThrow();
  });

  it('claim fails when max supply is reached', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 1n, 0n, true); // supply = 1

    sim.asUser(USER1_SK);
    sim.claimOrUpdate(EVENT_A, false); // token 0 minted

    sim.asUser(USER2_SK);
    expect(() => sim.claimOrUpdate(EVENT_A, false)).toThrow();
  });

  it('soulbound flag is stored in private state', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK);
    sim.claimOrUpdate(EVENT_A, true); // soulbound = true

    const ps = sim.getPrivateState();
    expect(ps.token!.attendance.isSoulbound).toBe(true);
  });

  it('two different users each get their own token', () => {
    const sim = new PoapSimulator(ADMIN_SK);
    sim.createEvent(EVENT_A, 100n, 0n, true);

    sim.asUser(USER1_SK);
    sim.claimOrUpdate(EVENT_A, false);
    const user1Ps = sim.getPrivateState();
    const tokenIdUser1 = user1Ps.token!.tokenId;

    sim.asUser(USER2_SK);
    sim.claimOrUpdate(EVENT_A, false);
    const user2Ps = sim.getPrivateState();
    const tokenIdUser2 = user2Ps.token!.tokenId;

    expect(tokenIdUser1).not.toBe(tokenIdUser2);
    expect(sim.getLedger().totalSupply).toBe(2n);
  });
});
