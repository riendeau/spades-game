import { describe, it, expect } from 'vitest';
import { processAction, canTransition } from '../state-machine/game-machine';
import { createInitialGameState } from '../types/game-state';

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
        nickname: 'Player 1',
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
          nickname: `Player ${i}`,
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
          nickname: `Player ${i}`,
        });
        state = result.state;
      }

      const result = processAction(state, {
        type: 'PLAYER_JOIN',
        playerId: 'p5',
        nickname: 'Player 5',
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
        nickname: 'Player 1',
      }).state;

      const result = processAction(state, {
        type: 'PLAYER_READY',
        playerId: 'p1',
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
          nickname: `Player ${i}`,
        }).state;
      }

      // Ready all but one
      for (let i = 0; i < 3; i++) {
        state = processAction(state, {
          type: 'PLAYER_READY',
          playerId: `p${i}`,
        }).state;
        expect(state.phase).toBe('waiting');
      }

      // Ready last player
      const result = processAction(state, {
        type: 'PLAYER_READY',
        playerId: 'p3',
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
          nickname: `Player ${i}`,
        }).state;
        state = processAction(state, {
          type: 'PLAYER_READY',
          playerId: `p${i}`,
        }).state;
      }

      // Start game
      state = processAction(state, { type: 'START_GAME' }).state;

      // Deal cards
      const result = processAction(state, { type: 'DEAL_CARDS' });

      expect(result.valid).toBe(true);
      expect(result.state.phase).toBe('bidding');
      result.state.players.forEach((player) => {
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
          nickname: `Player ${i}`,
        }).state;
        state = processAction(state, {
          type: 'PLAYER_READY',
          playerId: `p${i}`,
        }).state;
      }

      state = processAction(state, { type: 'START_GAME' }).state;
      state = processAction(state, { type: 'DEAL_CARDS' }).state;

      return state;
    }

    it('should allow valid bid from current player', () => {
      const state = setupBiddingGame();
      const currentPlayer = state.players.find(
        (p) => p.position === state.currentPlayerPosition
      );

      const result = processAction(state, {
        type: 'MAKE_BID',
        playerId: currentPlayer!.id,
        bid: 3,
        isNil: false,
        isBlindNil: false,
      });

      expect(result.valid).toBe(true);
      expect(result.state.currentRound?.bids).toHaveLength(1);
    });

    it('should reject bid from wrong player', () => {
      const state = setupBiddingGame();
      const wrongPlayer = state.players.find(
        (p) => p.position !== state.currentPlayerPosition
      );

      const result = processAction(state, {
        type: 'MAKE_BID',
        playerId: wrongPlayer!.id,
        bid: 3,
        isNil: false,
        isBlindNil: false,
      });

      expect(result.valid).toBe(false);
    });

    it('should transition to playing phase after all bids', () => {
      let state = setupBiddingGame();

      // All 4 players bid
      for (let i = 0; i < 4; i++) {
        const currentPlayer = state.players.find(
          (p) => p.position === state.currentPlayerPosition
        );
        state = processAction(state, {
          type: 'MAKE_BID',
          playerId: currentPlayer!.id,
          bid: 3,
          isNil: false,
          isBlindNil: false,
        }).state;
      }

      expect(state.phase).toBe('playing');
      expect(state.currentRound?.bids).toHaveLength(4);
    });

    it('should allow blind nil bid from current player', () => {
      const state = setupBiddingGame();
      const currentPlayer = state.players.find(
        (p) => p.position === state.currentPlayerPosition
      );

      const result = processAction(state, {
        type: 'MAKE_BID',
        playerId: currentPlayer!.id,
        bid: 0,
        isNil: false,
        isBlindNil: true,
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
        (p) => p.position === state.currentPlayerPosition
      );
      state = processAction(state, {
        type: 'MAKE_BID',
        playerId: firstPlayer!.id,
        bid: 0,
        isNil: false,
        isBlindNil: true,
      }).state;

      expect(state.phase).toBe('bidding');

      // Remaining 3 players bid normally
      for (let i = 0; i < 3; i++) {
        const currentPlayer = state.players.find(
          (p) => p.position === state.currentPlayerPosition
        );
        state = processAction(state, {
          type: 'MAKE_BID',
          playerId: currentPlayer!.id,
          bid: 3,
          isNil: false,
          isBlindNil: false,
        }).state;
      }

      expect(state.phase).toBe('playing');
      expect(state.currentRound?.bids).toHaveLength(4);
      expect(state.currentRound?.bids[0].isBlindNil).toBe(true);
    });
  });

  describe('PLAYER_LEAVE', () => {
    it('should remove player in waiting phase', () => {
      let state = createInitialGameState('test-room');

      for (let i = 0; i < 3; i++) {
        state = processAction(state, {
          type: 'PLAYER_JOIN',
          playerId: `p${i}`,
          nickname: `Player ${i}`,
        }).state;
      }

      const result = processAction(state, {
        type: 'PLAYER_LEAVE',
        playerId: 'p1',
      });

      expect(result.valid).toBe(true);
      expect(result.state.players).toHaveLength(2);
      expect(result.state.players.map((p) => p.id)).toEqual(['p0', 'p2']);
    });

    it('should preserve seat selections when a player leaves', () => {
      let state = createInitialGameState('test-room');

      // Add 3 players (positions 0, 1, 2)
      for (let i = 0; i < 3; i++) {
        state = processAction(state, {
          type: 'PLAYER_JOIN',
          playerId: `p${i}`,
          nickname: `Player ${i}`,
        }).state;
      }

      // Player 2 moves to seat 3
      state = processAction(state, {
        type: 'PLAYER_CHANGE_SEAT',
        playerId: 'p2',
        newPosition: 3,
      }).state;
      expect(state.players.find((p) => p.id === 'p2')!.position).toBe(3);

      // Player 1 leaves — player 2 should keep seat 3
      const result = processAction(state, {
        type: 'PLAYER_LEAVE',
        playerId: 'p1',
      });

      expect(result.valid).toBe(true);
      expect(result.state.players).toHaveLength(2);

      const p0 = result.state.players.find((p) => p.id === 'p0')!;
      const p2 = result.state.players.find((p) => p.id === 'p2')!;
      expect(p0.position).toBe(0);
      expect(p0.team).toBe('team1');
      expect(p2.position).toBe(3);
      expect(p2.team).toBe('team2');
    });
  });

  describe('PLAYER_REPLACE', () => {
    function setupBiddingGame() {
      let state = createInitialGameState('test-room');

      for (let i = 0; i < 4; i++) {
        state = processAction(state, {
          type: 'PLAYER_JOIN',
          playerId: `p${i}`,
          nickname: `Player ${i}`,
        }).state;
        state = processAction(state, {
          type: 'PLAYER_READY',
          playerId: `p${i}`,
        }).state;
      }

      state = processAction(state, { type: 'START_GAME' }).state;
      state = processAction(state, { type: 'DEAL_CARDS' }).state;
      return state;
    }

    it('should replace a disconnected player', () => {
      let state = setupBiddingGame();

      // Disconnect player
      state = processAction(state, {
        type: 'PLAYER_DISCONNECT',
        playerId: 'p2',
      }).state;
      expect(state.players[2].connected).toBe(false);

      // Replace player
      const result = processAction(state, {
        type: 'PLAYER_REPLACE',
        playerId: 'p2',
        nickname: 'NewPlayer',
      });

      expect(result.valid).toBe(true);
      expect(result.state.players[2].connected).toBe(true);
      expect(result.state.players[2].nickname).toBe('NewPlayer');
      // Should keep same position and team
      expect(result.state.players[2].position).toBe(2);
      expect(result.state.players[2].team).toBe('team1');
    });

    it('should reject replacing a connected player', () => {
      const state = setupBiddingGame();

      const result = processAction(state, {
        type: 'PLAYER_REPLACE',
        playerId: 'p1',
        nickname: 'NewPlayer',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('still connected');
    });

    it('should reject replacing a non-existent player', () => {
      const state = setupBiddingGame();

      const result = processAction(state, {
        type: 'PLAYER_REPLACE',
        playerId: 'nonexistent',
        nickname: 'NewPlayer',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should work during playing phase', () => {
      let state = setupBiddingGame();

      // Make all bids in correct order (starting from dealer+1)
      for (let i = 0; i < 4; i++) {
        const pos = state.currentPlayerPosition;
        const player = state.players.find((p) => p.position === pos)!;
        state = processAction(state, {
          type: 'MAKE_BID',
          playerId: player.id,
          bid: 3,
          isNil: false,
          isBlindNil: false,
        }).state;
      }
      expect(state.phase).toBe('playing');

      // Disconnect and replace
      state = processAction(state, {
        type: 'PLAYER_DISCONNECT',
        playerId: 'p0',
      }).state;

      const result = processAction(state, {
        type: 'PLAYER_REPLACE',
        playerId: 'p0',
        nickname: 'Replacement',
      });

      expect(result.valid).toBe(true);
      expect(result.state.players[0].nickname).toBe('Replacement');
      expect(result.state.players[0].connected).toBe(true);
      expect(result.state.phase).toBe('playing');
    });
  });
});
