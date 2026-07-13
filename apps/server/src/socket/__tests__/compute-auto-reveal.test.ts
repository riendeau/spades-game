import { describe, expect, it } from 'vitest';
import { computeAutoReveal } from '../handler.js';

// Shared by the seat-replacement (handleSelectSeat) and reconnect
// (handleReconnect) paths — see the "Card Reveal Semantics" note in
// CLAUDE.md. Covers the reconnect-path test cases from issue #230.
describe('computeAutoReveal', () => {
  it('does not reveal during bidding before the seat has viewed cards', () => {
    expect(computeAutoReveal('bidding', false)).toBe(false);
  });

  it('reveals during bidding once the seat has viewed cards (bid or See Cards)', () => {
    expect(computeAutoReveal('bidding', true)).toBe(true);
  });

  it('always reveals once bidding is over, regardless of hasViewedCards', () => {
    expect(computeAutoReveal('playing', false)).toBe(true);
    expect(computeAutoReveal('trick-end', false)).toBe(true);
    expect(computeAutoReveal('round-end', false)).toBe(true);
    expect(computeAutoReveal('game-end', false)).toBe(true);
  });

  it('does not reveal in pre-deal phases (irrelevant but should default false)', () => {
    expect(computeAutoReveal('waiting', false)).toBe(false);
    expect(computeAutoReveal('ready', false)).toBe(false);
    expect(computeAutoReveal('dealing', false)).toBe(false);
  });
});
