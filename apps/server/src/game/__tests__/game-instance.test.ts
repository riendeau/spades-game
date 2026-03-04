import {
  createInitialGameState,
  type GameState,
  type Card,
} from '@spades/shared';
import { describe, it, expect } from 'vitest';
import { GameInstance } from '../game-instance.js';

function createFourPlayerGame(): GameInstance {
  const state = createInitialGameState('test-room');
  const game = new GameInstance(state);

  for (let i = 0; i < 4; i++) {
    game.addPlayer(`p${i}`, `Player ${i}`);
  }
  for (let i = 0; i < 4; i++) {
    game.setPlayerReady(`p${i}`);
  }

  return game;
}

function startAndDeal(game: GameInstance): void {
  const result = game.startGame();
  if (!result.valid) throw new Error(`startGame failed: ${result.error}`);
}

function bidAll(game: GameInstance, bid = 3): void {
  for (let i = 0; i < 4; i++) {
    const pos = ((game.getState().dealerPosition + 1 + i) % 4) as 0 | 1 | 2 | 3;
    const player = game.getState().players.find((p) => p.position === pos)!;
    const result = game.makeBid(player.id, bid);
    if (!result.valid)
      throw new Error(`Bid failed for ${player.id}: ${result.error}`);
  }
}

describe('GameInstance', () => {
  describe('hand tracking', () => {
    it('should populate playerHands after dealing', () => {
      const game = createFourPlayerGame();
      startAndDeal(game);

      for (let i = 0; i < 4; i++) {
        const hand = game.getPlayerHand(`p${i}`);
        expect(hand).toHaveLength(13);
      }
    });

    it('should remove a played card from playerHands', () => {
      const game = createFourPlayerGame();
      startAndDeal(game);
      bidAll(game);

      const currentPos = game.getState().currentPlayerPosition;
      const player = game
        .getState()
        .players.find((p) => p.position === currentPos)!;
      const hand = game.getPlayerHand(player.id);
      const card = hand[0];

      // Find a card that is valid to play (any card works on first trick lead)
      // but must not be a spade (can't lead spades until broken)
      const nonSpade = hand.find((c) => c.suit !== 'spades');
      const cardToPlay = nonSpade ?? hand[0]; // fallback if all spades (extremely unlikely)

      const result = game.playCard(player.id, cardToPlay);
      expect(result.valid).toBe(true);

      const newHand = game.getPlayerHand(player.id);
      expect(newHand).toHaveLength(12);
      expect(
        newHand.some(
          (c) => c.suit === cardToPlay.suit && c.rank === cardToPlay.rank
        )
      ).toBe(false);
    });

    it('should reject playing a card not in hand', () => {
      const game = createFourPlayerGame();
      startAndDeal(game);
      bidAll(game);

      const currentPos = game.getState().currentPlayerPosition;
      const player = game
        .getState()
        .players.find((p) => p.position === currentPos)!;

      const fakeCard: Card = { suit: 'spades', rank: 'A' };
      const hand = game.getPlayerHand(player.id);
      const hasCard = hand.some(
        (c) => c.suit === fakeCard.suit && c.rank === fakeCard.rank
      );

      // If the player happens to have ace of spades, pick a different fake card
      const cardToReject: Card = hasCard
        ? { suit: 'diamonds', rank: '2' }
        : fakeCard;

      // Make sure this card isn't actually in hand
      const actuallyHas = hand.some(
        (c) => c.suit === cardToReject.suit && c.rank === cardToReject.rank
      );
      if (actuallyHas) return; // skip if unlucky with random deal

      const result = game.playCard(player.id, cardToReject);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Card not in hand');
    });

    it('should track hands correctly through a full trick', () => {
      const game = createFourPlayerGame();
      startAndDeal(game);
      bidAll(game);

      // Play 4 cards (one full trick)
      for (let i = 0; i < 4; i++) {
        const state = game.getState();
        const currentPos = state.currentPlayerPosition;
        const player = state.players.find((p) => p.position === currentPos)!;
        const hand = game.getPlayerHand(player.id);

        // Find a playable card
        let cardToPlay: Card;
        if (i === 0) {
          // Leader: pick non-spade
          cardToPlay = hand.find((c) => c.suit !== 'spades') ?? hand[0];
        } else {
          // Follower: must follow lead suit if possible
          const leadSuit = state.currentRound!.currentTrick.leadSuit;
          const suitCard = hand.find((c) => c.suit === leadSuit);
          cardToPlay =
            suitCard ?? hand.find((c) => c.suit !== 'spades') ?? hand[0];
        }

        const result = game.playCard(player.id, cardToPlay);
        expect(result.valid).toBe(true);
        expect(game.getPlayerHand(player.id)).toHaveLength(
          12 - (i === 0 ? 0 : 0)
        );
        // Each player should have exactly 12 cards after playing
        expect(game.getPlayerHand(player.id)).toHaveLength(12);
      }

      // All 4 players should have 12 cards
      for (let i = 0; i < 4; i++) {
        expect(game.getPlayerHand(`p${i}`)).toHaveLength(12);
      }
    });

    it('should update playerHands after startNextRound deals new cards', () => {
      const game = createFourPlayerGame();
      startAndDeal(game);
      bidAll(game);

      // Play all 13 tricks
      for (let trick = 0; trick < 13; trick++) {
        for (let play = 0; play < 4; play++) {
          const state = game.getState();
          const currentPos = state.currentPlayerPosition;
          const player = state.players.find((p) => p.position === currentPos)!;
          const hand = game.getPlayerHand(player.id);

          let cardToPlay: Card;
          if (play === 0) {
            cardToPlay = hand.find((c) => c.suit !== 'spades') ?? hand[0];
          } else {
            const leadSuit = state.currentRound!.currentTrick.leadSuit;
            const suitCard = hand.find((c) => c.suit === leadSuit);
            cardToPlay = suitCard ?? hand[0];
          }

          game.playCard(player.id, cardToPlay);
        }
        game.collectTrick();
      }

      // After 13 tricks, all hands should be empty
      for (let i = 0; i < 4; i++) {
        expect(game.getPlayerHand(`p${i}`)).toHaveLength(0);
      }

      // Start next round — hands should be repopulated
      expect(game.getState().phase).toBe('round-end');
      game.startNextRound();

      for (let i = 0; i < 4; i++) {
        expect(game.getPlayerHand(`p${i}`)).toHaveLength(13);
      }
    });
  });
});
