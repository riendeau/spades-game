import { describe, it, expect } from 'vitest';
import { processAction, canTransition } from '../state-machine/game-machine';
import { createInitialGameState, DEFAULT_GAME_CONFIG } from '../types/game-state';

describe('Game State Machine', () => {
  describe('canTransition', () => {
    it('should allow waiting -> ready', () => {
      expect(canTransition('waiting', 'ready')).toBe(true);
    });

    it('should allow ready -> dealing', () => {
      expect(canTransition('ready', 'dealing')).toBe(true);
    });

    it('should allow dealing -> bidding', () => {
      expect(canTransition('dealing', 'bidding')).toBe(true);
    });

    it('should not allow waiting -> playing', () => {
      expect(canTransition('waiting', 'playing')).toBe(false);
    });

    it('should not allow game-end to anything', () => {
      expect(canTransition('game-end', 'waiting')).toBe(false);
      expect(canTransition('game-end', 'playing')).toBe(false);
    });
  });

  describe('PLAYER_JOIN', () => {
    it('should add player to waiting game', () => {
      const state = createInitialGameState('test-room');
      const result = processAction(state, {
        type: 'PLAYER_JOIN',
        playerId: 'p1',
        nickname: 'Player 1'
      });

      expect(result.valid).toBe(true);
      expect(result.state.players).toHaveLength(1);
      expect(result.state.players[0].nickname).toBe('Player 1');
      expect(result.state.players[0].position).toBe(0);
      expect(result.state.players[0].team).toBe('team1');
    });

    it('should assign correct teams to players', () => {
      let state = createInitialGameState('test-room');

      for (let i = 0; i < 4; i++) {
        const result = processAction(state, {
          type: 'PLAYER_JOIN',
          playerId: `p${i}`,
          nickname: `Player ${i}`
        });
        state = result.state;
      }

      expect(state.players[0].team).toBe('team1');
      expect(state.players[1].team).toBe('team2');
      expect(state.players[2].team).toBe('team1');
      expect(state.players[3].team).toBe('team2');
    });

    it('should reject join when game is full', () => {
      let state = createInitialGameState('test-room');

      for (let i = 0; i < 4; i++) {
        const result = processAction(state, {
          type: 'PLAYER_JOIN',
          playerId: `p${i}`,
          nickname: `Player ${i}`
        });
        state = result.state;
      }

      const result = processAction(state, {
        type: 'PLAYER_JOIN',
        playerId: 'p5',
        nickname: 'Player 5'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('full');
    });
  });

  describe('PLAYER_READY', () => {
    it('should mark player as ready', () => {
      let state = createInitialGameState('test-room');
      state = processAction(state, {
        type: 'PLAYER_JOIN',
        playerId: 'p1',
        nickname: 'Player 1'
      }).state;

      const result = processAction(state, {
        type: 'PLAYER_READY',
        playerId: 'p1'
      });

      expect(result.valid).toBe(true);
      expect(result.state.players[0].ready).toBe(true);
    });

    it('should transition to ready phase when all 4 players are ready', () => {
      let state = createInitialGameState('test-room');

      // Add 4 players
      for (let i = 0; i < 4; i++) {
        state = processAction(state, {
          type: 'PLAYER_JOIN',
          playerId: `p${i}`,
          nickname: `Player ${i}`
        }).state;
      }

      // Ready all but one
      for (let i = 0; i < 3; i++) {
        state = processAction(state, {
          type: 'PLAYER_READY',
          playerId: `p${i}`
        }).state;
        expect(state.phase).toBe('waiting');
      }

      // Ready last player
      const result = processAction(state, {
        type: 'PLAYER_READY',
        playerId: 'p3'
      });

      expect(result.valid).toBe(true);
      expect(result.state.phase).toBe('ready');
    });
  });

  describe('DEAL_CARDS', () => {
    it('should deal 13 cards to each player', () => {
      let state = createInitialGameState('test-room');

      // Setup: add and ready 4 players
      for (let i = 0; i < 4; i++) {
        state = processAction(state, {
          type: 'PLAYER_JOIN',
          playerId: `p${i}`,
          nickname: `Player ${i}`
        }).state;
        state = processAction(state, {
          type: 'PLAYER_READY',
          playerId: `p${i}`
        }).state;
      }

      // Start game
      state = processAction(state, { type: 'START_GAME' }).state;

      // Deal cards
      const result = processAction(state, { type: 'DEAL_CARDS' });

      expect(result.valid).toBe(true);
      expect(result.state.phase).toBe('bidding');
      result.state.players.forEach(player => {
        expect(player.hand).toHaveLength(13);
      });
    });
  });

  describe('MAKE_BID', () => {
    function setupBiddingGame() {
      let state = createInitialGameState('test-room');

      for (let i = 0; i < 4; i++) {
        state = processAction(state, {
          type: 'PLAYER_JOIN',
          playerId: `p${i}`,
          nickname: `Player ${i}`
        }).state;
        state = processAction(state, {
          type: 'PLAYER_READY',
          playerId: `p${i}`
        }).state;
      }

      state = processAction(state, { type: 'START_GAME' }).state;
      state = processAction(state, { type: 'DEAL_CARDS' }).state;

      return state;
    }

    it('should allow valid bid from current player', () => {
      const state = setupBiddingGame();
      const currentPlayer = state.players.find(
        p => p.position === state.currentPlayerPosition
      );

      const result = processAction(state, {
        type: 'MAKE_BID',
        playerId: currentPlayer!.id,
        bid: 3,
        isNil: false,
        isBlindNil: false
      });

      expect(result.valid).toBe(true);
      expect(result.state.currentRound?.bids).toHaveLength(1);
    });

    it('should reject bid from wrong player', () => {
      const state = setupBiddingGame();
      const wrongPlayer = state.players.find(
        p => p.position !== state.currentPlayerPosition
      );

      const result = processAction(state, {
        type: 'MAKE_BID',
        playerId: wrongPlayer!.id,
        bid: 3,
        isNil: false,
        isBlindNil: false
      });

      expect(result.valid).toBe(false);
    });

    it('should transition to playing phase after all bids', () => {
      let state = setupBiddingGame();

      // All 4 players bid
      for (let i = 0; i < 4; i++) {
        const currentPlayer = state.players.find(
          p => p.position === state.currentPlayerPosition
        );
        state = processAction(state, {
          type: 'MAKE_BID',
          playerId: currentPlayer!.id,
          bid: 3,
          isNil: false,
          isBlindNil: false
        }).state;
      }

      expect(state.phase).toBe('playing');
      expect(state.currentRound?.bids).toHaveLength(4);
    });

    it('should allow blind nil bid from current player', () => {
      const state = setupBiddingGame();
      const currentPlayer = state.players.find(
        p => p.position === state.currentPlayerPosition
      );

      const result = processAction(state, {
        type: 'MAKE_BID',
        playerId: currentPlayer!.id,
        bid: 0,
        isNil: false,
        isBlindNil: true
      });

      expect(result.valid).toBe(true);
      expect(result.state.currentRound?.bids).toHaveLength(1);
      expect(result.state.currentRound?.bids[0].isBlindNil).toBe(true);
      expect(result.state.currentRound?.bids[0].bid).toBe(0);
    });

    it('should transition to playing after mix of blind nil and regular bids', () => {
      let state = setupBiddingGame();

      // First player bids blind nil
      const firstPlayer = state.players.find(
        p => p.position === state.currentPlayerPosition
      );
      state = processAction(state, {
        type: 'MAKE_BID',
        playerId: firstPlayer!.id,
        bid: 0,
        isNil: false,
        isBlindNil: true
      }).state;

      expect(state.phase).toBe('bidding');

      // Remaining 3 players bid normally
      for (let i = 0; i < 3; i++) {
        const currentPlayer = state.players.find(
          p => p.position === state.currentPlayerPosition
        );
        state = processAction(state, {
          type: 'MAKE_BID',
          playerId: currentPlayer!.id,
          bid: 3,
          isNil: false,
          isBlindNil: false
        }).state;
      }

      expect(state.phase).toBe('playing');
      expect(state.currentRound?.bids).toHaveLength(4);
      expect(state.currentRound?.bids[0].isBlindNil).toBe(true);
    });
  });
});
