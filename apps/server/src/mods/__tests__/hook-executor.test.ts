import { createInitialGameState, DEFAULT_GAME_CONFIG } from '@spades/shared';
import type {
  RuleMod,
  ScoreContext,
  CalculateDisabledBidsContext,
  PlayValidationContext,
  CardPlayedContext,
  TrickCompleteContext,
  RoundEndContext,
  GameConfig,
} from '@spades/shared';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookExecutor } from '../hook-executor.js';

function makeMod(id: string, hooks: RuleMod['hooks'] = {}): RuleMod {
  return {
    id,
    name: id,
    description: `Test mod ${id}`,
    version: '1.0.0',
    type: 'rule',
    hooks,
  };
}

function makeScoreContext(overrides?: Partial<ScoreContext>): ScoreContext {
  return {
    gameState: createInitialGameState('test'),
    config: DEFAULT_GAME_CONFIG,
    teamId: 'team1',
    bid: 4,
    tricks: 4,
    nilBids: [],
    calculatedScore: 40,
    calculatedBags: 0,
    ...overrides,
  };
}

describe('HookExecutor', () => {
  let executor: HookExecutor;

  beforeEach(() => {
    executor = new HookExecutor();
  });

  describe('mod management', () => {
    it('should start with no mods', () => {
      expect(executor.getAllModIds()).toEqual([]);
    });

    it('should add mods via addMod', () => {
      executor.addMod(makeMod('mod-a'));
      executor.addMod(makeMod('mod-b'));
      expect(executor.getAllModIds()).toEqual(['mod-a', 'mod-b']);
    });

    it('should replace mods via setMods', () => {
      executor.addMod(makeMod('old'));
      executor.setMods([makeMod('new-a'), makeMod('new-b')]);
      expect(executor.getAllModIds()).toEqual(['new-a', 'new-b']);
    });

    it('should clear all mods', () => {
      executor.addMod(makeMod('mod-a'));
      executor.clearMods();
      expect(executor.getAllModIds()).toEqual([]);
    });
  });

  describe('executeCalculateScore', () => {
    it('should return context unchanged when no mods have the hook', () => {
      executor.addMod(makeMod('no-hook'));
      const ctx = makeScoreContext();
      const result = executor.executeCalculateScore(ctx);
      expect(result).toBe(ctx);
    });

    it('should pass context through a single mod', () => {
      const hook = vi.fn((ctx: ScoreContext) => ({
        ...ctx,
        calculatedScore: ctx.calculatedScore + 10,
      }));
      executor.addMod(makeMod('bonus', { onCalculateScore: hook }));

      const result = executor.executeCalculateScore(makeScoreContext());
      expect(hook).toHaveBeenCalledOnce();
      expect(result.calculatedScore).toBe(50);
    });

    it('should chain multiple mods in order', () => {
      executor.addMod(
        makeMod('double', {
          onCalculateScore: (ctx) => ({
            ...ctx,
            calculatedScore: ctx.calculatedScore * 2,
          }),
        })
      );
      executor.addMod(
        makeMod('plus-five', {
          onCalculateScore: (ctx) => ({
            ...ctx,
            calculatedScore: ctx.calculatedScore + 5,
          }),
        })
      );

      const result = executor.executeCalculateScore(
        makeScoreContext({ calculatedScore: 10 })
      );
      // 10 * 2 = 20, then 20 + 5 = 25
      expect(result.calculatedScore).toBe(25);
    });

    it('should skip mods without the hook', () => {
      executor.addMod(makeMod('no-hook'));
      executor.addMod(
        makeMod('has-hook', {
          onCalculateScore: (ctx) => ({ ...ctx, calculatedScore: 999 }),
        })
      );

      const result = executor.executeCalculateScore(makeScoreContext());
      expect(result.calculatedScore).toBe(999);
    });
  });

  describe('executeCalculateDisabledBids', () => {
    it('should accumulate disabled bids from multiple mods', () => {
      executor.addMod(
        makeMod('disable-5', {
          onCalculateDisabledBids: (ctx) => ({
            ...ctx,
            disabledBids: [...ctx.disabledBids, 5],
          }),
        })
      );
      executor.addMod(
        makeMod('disable-7', {
          onCalculateDisabledBids: (ctx) => ({
            ...ctx,
            disabledBids: [...ctx.disabledBids, 7],
          }),
        })
      );

      const ctx: CalculateDisabledBidsContext = {
        gameState: createInitialGameState('test'),
        config: DEFAULT_GAME_CONFIG,
        playerId: 'p1',
        currentBids: [],
        modState: undefined,
        disabledBids: [],
      };

      const result = executor.executeCalculateDisabledBids(ctx);
      expect(result.disabledBids).toEqual([5, 7]);
    });
  });

  describe('executeValidatePlay', () => {
    function makePlayContext(
      overrides?: Partial<PlayValidationContext>
    ): PlayValidationContext {
      return {
        gameState: createInitialGameState('test'),
        config: DEFAULT_GAME_CONFIG,
        playerId: 'p1',
        card: { suit: 'spades', rank: 'A' },
        hand: [{ suit: 'spades', rank: 'A' }],
        currentTrick: { plays: [], leadSuit: null },
        isValid: true,
        ...overrides,
      };
    }

    it('should pass through when all mods allow the play', () => {
      executor.addMod(
        makeMod('ok', {
          onValidatePlay: (ctx) => ctx,
        })
      );
      const result = executor.executeValidatePlay(makePlayContext());
      expect(result.isValid).toBe(true);
    });

    it('should stop at the first mod that rejects the play', () => {
      const secondHook = vi.fn((ctx: PlayValidationContext) => ctx);

      executor.addMod(
        makeMod('rejecter', {
          onValidatePlay: (ctx) => ({
            ...ctx,
            isValid: false,
            errorMessage: 'Blocked by mod',
          }),
        })
      );
      executor.addMod(makeMod('never-reached', { onValidatePlay: secondHook }));

      const result = executor.executeValidatePlay(makePlayContext());
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Blocked by mod');
      expect(secondHook).not.toHaveBeenCalled();
    });

    it('should continue to next mod when first mod allows the play', () => {
      const secondHook = vi.fn((ctx: PlayValidationContext) => ({
        ...ctx,
        isValid: false,
        errorMessage: 'Second mod rejects',
      }));

      executor.addMod(makeMod('allower', { onValidatePlay: (ctx) => ctx }));
      executor.addMod(makeMod('rejecter', { onValidatePlay: secondHook }));

      const result = executor.executeValidatePlay(makePlayContext());
      expect(secondHook).toHaveBeenCalledOnce();
      expect(result.isValid).toBe(false);
    });
  });

  describe('executeCardPlayed', () => {
    it('should chain card-played hooks', () => {
      const calls: string[] = [];
      executor.addMod(
        makeMod('a', {
          onCardPlayed: (ctx) => {
            calls.push('a');
            return ctx;
          },
        })
      );
      executor.addMod(
        makeMod('b', {
          onCardPlayed: (ctx) => {
            calls.push('b');
            return ctx;
          },
        })
      );

      const ctx: CardPlayedContext = {
        gameState: createInitialGameState('test'),
        config: DEFAULT_GAME_CONFIG,
        playerId: 'p1',
        card: { suit: 'hearts', rank: '5' },
      };

      executor.executeCardPlayed(ctx);
      expect(calls).toEqual(['a', 'b']);
    });
  });

  describe('executeTrickComplete', () => {
    it('should chain trick-complete hooks', () => {
      const calls: string[] = [];
      executor.addMod(
        makeMod('x', {
          onTrickComplete: (ctx) => {
            calls.push('x');
            return ctx;
          },
        })
      );
      executor.addMod(
        makeMod('y', {
          onTrickComplete: (ctx) => {
            calls.push('y');
            return ctx;
          },
        })
      );

      const ctx: TrickCompleteContext = {
        gameState: createInitialGameState('test'),
        config: DEFAULT_GAME_CONFIG,
        trick: {
          plays: [{ playerId: 'p1', card: { suit: 'hearts', rank: 'A' } }],
          leadSuit: 'hearts',
        },
        winnerId: 'p1',
      };

      executor.executeTrickComplete(ctx);
      expect(calls).toEqual(['x', 'y']);
    });
  });

  describe('executeRoundEnd', () => {
    function makeRoundEndContext(): RoundEndContext {
      return {
        gameState: createInitialGameState('test'),
        config: DEFAULT_GAME_CONFIG,
        roundSummary: {
          roundNumber: 1,
          team1: {
            bid: 4,
            tricks: 4,
            score: 40,
            bags: 0,
            bagPenalty: false,
            previousScore: 0,
            nilResults: [],
          },
          team2: {
            bid: 4,
            tricks: 4,
            score: 40,
            bags: 0,
            bagPenalty: false,
            previousScore: 0,
            nilResults: [],
          },
        },
        modState: undefined,
      };
    }

    it('should execute the hook for the specified mod only', () => {
      const hookA = vi.fn(() => ({ modState: 'from-a' }));
      const hookB = vi.fn(() => ({ modState: 'from-b' }));

      executor.addMod(makeMod('mod-a', { onRoundEnd: hookA }));
      executor.addMod(makeMod('mod-b', { onRoundEnd: hookB }));

      const result = executor.executeRoundEnd(makeRoundEndContext(), 'mod-a');
      expect(hookA).toHaveBeenCalledOnce();
      expect(hookB).not.toHaveBeenCalled();
      expect(result.modState).toBe('from-a');
    });

    it('should return empty object when mod not found', () => {
      executor.addMod(
        makeMod('mod-a', { onRoundEnd: () => ({ modState: 'x' }) })
      );
      const result = executor.executeRoundEnd(
        makeRoundEndContext(),
        'nonexistent'
      );
      expect(result).toEqual({});
    });

    it('should return empty object when mod has no onRoundEnd hook', () => {
      executor.addMod(makeMod('mod-no-hook'));
      const result = executor.executeRoundEnd(
        makeRoundEndContext(),
        'mod-no-hook'
      );
      expect(result).toEqual({});
    });
  });

  describe('modifyConfig', () => {
    it('should return config unchanged when no mods have the hook', () => {
      executor.addMod(makeMod('no-hook'));
      const config = { ...DEFAULT_GAME_CONFIG };
      const result = executor.modifyConfig(config);
      expect(result).toBe(config);
    });

    it('should allow a mod to modify config', () => {
      executor.addMod(
        makeMod('no-nil', {
          modifyConfig: (config) => ({ ...config, allowNil: false }),
        })
      );

      const result = executor.modifyConfig({ ...DEFAULT_GAME_CONFIG });
      expect(result.allowNil).toBe(false);
      expect(result.allowBlindNil).toBe(true); // unchanged
    });

    it('should chain config modifications from multiple mods', () => {
      executor.addMod(
        makeMod('no-nil', {
          modifyConfig: (config) => ({ ...config, allowNil: false }),
        })
      );
      executor.addMod(
        makeMod('high-score', {
          modifyConfig: (config) => ({ ...config, winningScore: 1000 }),
        })
      );

      const result = executor.modifyConfig({ ...DEFAULT_GAME_CONFIG });
      expect(result.allowNil).toBe(false);
      expect(result.winningScore).toBe(1000);
    });
  });
});
