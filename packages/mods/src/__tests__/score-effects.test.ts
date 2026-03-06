declare const process: { env: Record<string, string | undefined> };

import type { RoundEndContext, RoundSummary } from '@spades/shared';
import { createInitialGameState, DEFAULT_GAME_CONFIG } from '@spades/shared';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scoreEffectsMod } from '../rules/score-effects.js';

function makeContext(team1Score: number, team2Score: number): RoundEndContext {
  const state = createInitialGameState('test');
  state.scores.team1.score = team1Score;
  state.scores.team2.score = team2Score;

  const roundSummary: RoundSummary = {
    roundNumber: 1,
    team1: {
      bid: 4,
      tricks: 4,
      points: 40,
      bags: 0,
      bagPenalty: 0,
      nilResults: [],
    },
    team2: {
      bid: 4,
      tricks: 4,
      points: 40,
      bags: 0,
      bagPenalty: 0,
      nilResults: [],
    },
  };

  return {
    gameState: state,
    config: DEFAULT_GAME_CONFIG,
    roundSummary,
    modState: undefined,
  };
}

describe('scoreEffectsMod', () => {
  const onRoundEnd = scoreEffectsMod.hooks.onRoundEnd!;
  let originalEnv: string | undefined;

  // Set production mode so tests exercise the score-matching logic
  // (dev mode fires a random effect every round instead)
  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('returns bowling-strike effect when team1 score is 345', () => {
    const result = onRoundEnd(makeContext(345, 100));
    expect(result.effects).toEqual([{ id: 'bowling-strike', teamId: 'team1' }]);
  });

  it('returns bowling-strike effect when team2 score is 345', () => {
    const result = onRoundEnd(makeContext(100, 345));
    expect(result.effects).toEqual([{ id: 'bowling-strike', teamId: 'team2' }]);
  });

  it('returns fake-victory effect when team1 score is 245', () => {
    const result = onRoundEnd(makeContext(245, 100));
    expect(result.effects).toEqual([{ id: 'fake-victory', teamId: 'team1' }]);
  });

  it('returns fake-victory effect when team2 score is 245', () => {
    const result = onRoundEnd(makeContext(100, 245));
    expect(result.effects).toEqual([{ id: 'fake-victory', teamId: 'team2' }]);
  });

  it('returns no effects for non-trigger scores', () => {
    const result = onRoundEnd(makeContext(200, 300));
    expect(result.effects).toBeUndefined();
  });

  it('returns effects for both teams if both hit triggers', () => {
    const result = onRoundEnd(makeContext(345, 245));
    expect(result.effects).toEqual([
      { id: 'bowling-strike', teamId: 'team1' },
      { id: 'fake-victory', teamId: 'team2' },
    ]);
  });

  it('returns empty result (no modState) for non-trigger scores', () => {
    const result = onRoundEnd(makeContext(100, 100));
    expect(result).toEqual({});
  });
});
