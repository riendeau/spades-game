import { antiElevenMod } from '@spades/mods';
import { createInitialGameState } from '@spades/shared';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../game/game-instance.js';
import { hookExecutor } from '../mods/hook-executor.js';

// Regression test: mod-disabled bids must be rejected server-side, not just
// greyed out in the client UI. A crafted or stale client can emit any bid.
describe('GameInstance disabled-bid enforcement', () => {
  beforeEach(() => {
    hookExecutor.setMods([antiElevenMod]);
  });

  afterEach(() => {
    hookExecutor.clearMods();
  });

  function setupBiddingGame(): {
    game: GameInstance;
    bidderIds: string[]; // player ids in bidding order
  } {
    const game = new GameInstance(createInitialGameState('TEST01'));
    for (let i = 0; i < 4; i++) {
      game.addPlayer(`p${i}`, `Player ${i}`);
    }
    for (let i = 0; i < 4; i++) {
      game.setPlayerReady(`p${i}`);
    }
    const startResult = game.startGame();
    expect(startResult.valid).toBe(true);
    expect(game.getState().phase).toBe('bidding');

    // Bidding order starts left of the (random) dealer.
    const dealer = game.getState().dealerPosition;
    const bidderIds = [0, 1, 2, 3].map((offset) => {
      const position = (dealer + 1 + offset) % 4;
      return game.getState().players.find((p) => p.position === position)!.id;
    });
    return { game, bidderIds };
  }

  function forceDisablement(game: GameInstance): void {
    // disablementChance 1 makes the mod's Math.random() check always fire,
    // so the 4th bidder's table-total-11 bid is deterministically disabled.
    game.setModState('anti-eleven', {
      disablementChance: 1,
      disablementOccurredThisRound: false,
      disabledBid: null,
    });
  }

  it('rejects a bid the anti-eleven mod has disabled', () => {
    const { game, bidderIds } = setupBiddingGame();

    // First three bids total 8, so the 4th bidder's "3" would make 11.
    expect(game.makeBid(bidderIds[0], 3).valid).toBe(true);
    expect(game.makeBid(bidderIds[1], 3).valid).toBe(true);
    expect(game.makeBid(bidderIds[2], 2).valid).toBe(true);

    forceDisablement(game);

    const blocked = game.makeBid(bidderIds[3], 3);
    expect(blocked.valid).toBe(false);
    expect(blocked.error).toBe('That bid is currently disabled by a game mod');
    // The rejected bid must not have advanced the game.
    expect(game.getState().phase).toBe('bidding');
    expect(game.getState().currentRound?.bids).toHaveLength(3);

    // Any other bid still goes through.
    const allowed = game.makeBid(bidderIds[3], 4);
    expect(allowed.valid).toBe(true);
    expect(game.getState().phase).toBe('playing');
  });

  it('makes the disablement decision once and reuses it across calls', () => {
    const { game, bidderIds } = setupBiddingGame();

    expect(game.makeBid(bidderIds[0], 3).valid).toBe(true);
    expect(game.makeBid(bidderIds[1], 3).valid).toBe(true);
    expect(game.makeBid(bidderIds[2], 2).valid).toBe(true);

    forceDisablement(game);

    // toClientState() is what normally triggers the decision (to grey out the
    // client's buttons); the enforcement path must then read the same cached
    // decision instead of re-rolling.
    const clientState = game.toClientState();
    expect(clientState.disabledBids).toEqual([3]);
    expect(game.getDisabledBids(bidderIds[3])).toEqual([3]);
    expect(game.makeBid(bidderIds[3], 3).valid).toBe(false);
  });

  it('does not report disabled bids for players out of turn', () => {
    const { game, bidderIds } = setupBiddingGame();

    expect(game.makeBid(bidderIds[0], 3).valid).toBe(true);
    expect(game.makeBid(bidderIds[1], 3).valid).toBe(true);
    expect(game.makeBid(bidderIds[2], 2).valid).toBe(true);

    forceDisablement(game);

    expect(game.getDisabledBids(bidderIds[0])).toEqual([]);
  });
});
