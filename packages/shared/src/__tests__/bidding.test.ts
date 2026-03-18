import { describe, it, expect } from 'vitest';
import {
  validateBid,
  getNextBidder,
  allBidsComplete,
  createBid,
  getTeamTotalBid,
} from '../game-logic/bidding';
import {
  createInitialGameState,
  createRoundState,
  DEFAULT_GAME_CONFIG,
} from '../types/game-state';
import type { GameState, GameConfig } from '../types/game-state';
import type { Player, PlayerBid, Position } from '../types/player';

function makePlayer(id: string, position: Position): Player {
  return {
    id,
    nickname: `Player ${position}`,
    position,
    team: position % 2 === 0 ? 'team1' : 'team2',
    hand: [],
    connected: true,
    ready: true,
  };
}

function makeBiddingState(overrides?: {
  bids?: PlayerBid[];
  dealerPosition?: Position;
  currentPlayerPosition?: Position;
}): GameState {
  const state = createInitialGameState('test');
  state.phase = 'bidding';
  state.players = [
    makePlayer('p0', 0),
    makePlayer('p1', 1),
    makePlayer('p2', 2),
    makePlayer('p3', 3),
  ];
  state.currentRound = createRoundState(1);
  state.currentRound.bids = overrides?.bids ?? [];
  state.dealerPosition = overrides?.dealerPosition ?? 0;
  state.currentPlayerPosition = overrides?.currentPlayerPosition ?? 1;
  return state;
}

describe('bidding', () => {
  describe('validateBid', () => {
    it('should accept a valid numeric bid', () => {
      const state = makeBiddingState({ currentPlayerPosition: 1 });
      const result = validateBid(
        state,
        'p1',
        4,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(true);
    });

    it('should reject bid when not in bidding phase', () => {
      const state = makeBiddingState();
      state.phase = 'playing';
      const result = validateBid(
        state,
        'p1',
        4,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBe('Not in bidding phase');
    });

    it('should reject bid from unknown player', () => {
      const state = makeBiddingState();
      const result = validateBid(
        state,
        'unknown',
        4,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBe('Player not found');
    });

    it("should reject bid when it is not the player's turn", () => {
      const state = makeBiddingState({ currentPlayerPosition: 1 });
      const result = validateBid(
        state,
        'p2',
        4,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBe('Not your turn to bid');
    });

    it('should reject bid from player who already bid', () => {
      const state = makeBiddingState({
        currentPlayerPosition: 1,
        bids: [{ playerId: 'p1', bid: 3, isNil: false, isBlindNil: false }],
      });
      const result = validateBid(
        state,
        'p1',
        4,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBe('Player already bid');
    });

    it('should reject nil bid when config disallows nil', () => {
      const state = makeBiddingState({ currentPlayerPosition: 1 });
      const config: GameConfig = { ...DEFAULT_GAME_CONFIG, allowNil: false };
      const result = validateBid(state, 'p1', 0, true, false, config);
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBe('Nil bids not allowed');
    });

    it('should accept nil bid when config allows nil', () => {
      const state = makeBiddingState({ currentPlayerPosition: 1 });
      const result = validateBid(
        state,
        'p1',
        0,
        true,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(true);
    });

    it('should reject blind nil bid when config disallows it', () => {
      const state = makeBiddingState({ currentPlayerPosition: 1 });
      const config: GameConfig = {
        ...DEFAULT_GAME_CONFIG,
        allowBlindNil: false,
      };
      const result = validateBid(state, 'p1', 0, false, true, config);
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBe('Blind nil bids not allowed');
    });

    it('should accept blind nil bid when config allows it', () => {
      const state = makeBiddingState({ currentPlayerPosition: 1 });
      const result = validateBid(
        state,
        'p1',
        0,
        false,
        true,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(true);
    });

    it('should reject nil bid with non-zero amount', () => {
      const state = makeBiddingState({ currentPlayerPosition: 1 });
      const result = validateBid(
        state,
        'p1',
        3,
        true,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBe('Nil bid must be 0');
    });

    it('should reject blind nil bid with non-zero amount', () => {
      const state = makeBiddingState({ currentPlayerPosition: 1 });
      const result = validateBid(
        state,
        'p1',
        5,
        false,
        true,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBe('Nil bid must be 0');
    });

    it('should reject numeric bid below 1', () => {
      const state = makeBiddingState({ currentPlayerPosition: 1 });
      const result = validateBid(
        state,
        'p1',
        0,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBe('Bid must be between 1 and 13');
    });

    it('should reject numeric bid above 13', () => {
      const state = makeBiddingState({ currentPlayerPosition: 1 });
      const result = validateBid(
        state,
        'p1',
        14,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBe('Bid must be between 1 and 13');
    });

    it('should accept bid of exactly 1', () => {
      const state = makeBiddingState({ currentPlayerPosition: 1 });
      const result = validateBid(
        state,
        'p1',
        1,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(true);
    });

    it('should accept bid of exactly 13', () => {
      const state = makeBiddingState({ currentPlayerPosition: 1 });
      const result = validateBid(
        state,
        'p1',
        13,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(true);
    });

    it('should reject bid when team total would exceed 13', () => {
      // p1 (pos 1) has already bid 10, now p3 (pos 3, partner) tries to bid 4
      const state = makeBiddingState({
        currentPlayerPosition: 3,
        bids: [
          { playerId: 'p0', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p1', bid: 10, isNil: false, isBlindNil: false },
          { playerId: 'p2', bid: 2, isNil: false, isBlindNil: false },
        ],
      });
      const result = validateBid(
        state,
        'p3',
        4,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toContain('Team bids cannot exceed 13');
    });

    it('should accept bid when team total equals exactly 13', () => {
      const state = makeBiddingState({
        currentPlayerPosition: 3,
        bids: [
          { playerId: 'p0', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p1', bid: 10, isNil: false, isBlindNil: false },
          { playerId: 'p2', bid: 2, isNil: false, isBlindNil: false },
        ],
      });
      const result = validateBid(
        state,
        'p3',
        3,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(true);
    });

    it('should not restrict bid when partner has not bid yet', () => {
      // p1 (pos 1) bids first, partner p3 hasn't bid
      const state = makeBiddingState({
        currentPlayerPosition: 1,
      });
      const result = validateBid(
        state,
        'p1',
        13,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(true);
    });

    it('should not restrict bid when partner bid nil', () => {
      // p1 (pos 1) bid nil, p3 (pos 3, partner) should be unrestricted
      const state = makeBiddingState({
        currentPlayerPosition: 3,
        bids: [
          { playerId: 'p0', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p1', bid: 0, isNil: true, isBlindNil: false },
          { playerId: 'p2', bid: 2, isNil: false, isBlindNil: false },
        ],
      });
      const result = validateBid(
        state,
        'p3',
        13,
        false,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(true);
    });

    it('should allow nil bid even when partner bid 13', () => {
      const state = makeBiddingState({
        currentPlayerPosition: 3,
        bids: [
          { playerId: 'p0', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p1', bid: 13, isNil: false, isBlindNil: false },
          { playerId: 'p2', bid: 2, isNil: false, isBlindNil: false },
        ],
      });
      const result = validateBid(
        state,
        'p3',
        0,
        true,
        false,
        DEFAULT_GAME_CONFIG
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('getNextBidder', () => {
    it("should return position to dealer's left for first bid", () => {
      const state = makeBiddingState({ dealerPosition: 0 });
      expect(getNextBidder(state)).toBe(1);
    });

    it('should advance clockwise through positions', () => {
      const state = makeBiddingState({
        dealerPosition: 0,
        bids: [{ playerId: 'p1', bid: 3, isNil: false, isBlindNil: false }],
      });
      expect(getNextBidder(state)).toBe(2);
    });

    it('should wrap around past position 3', () => {
      const state = makeBiddingState({
        dealerPosition: 2,
        bids: [
          { playerId: 'p3', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p0', bid: 4, isNil: false, isBlindNil: false },
        ],
      });
      expect(getNextBidder(state)).toBe(1);
    });

    it('should return dealer position for last bid', () => {
      const state = makeBiddingState({
        dealerPosition: 0,
        bids: [
          { playerId: 'p1', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p2', bid: 4, isNil: false, isBlindNil: false },
          { playerId: 'p3', bid: 3, isNil: false, isBlindNil: false },
        ],
      });
      expect(getNextBidder(state)).toBe(0);
    });
  });

  describe('allBidsComplete', () => {
    it('should return false with no bids', () => {
      const state = makeBiddingState();
      expect(allBidsComplete(state)).toBe(false);
    });

    it('should return false with partial bids', () => {
      const state = makeBiddingState({
        bids: [
          { playerId: 'p1', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p2', bid: 4, isNil: false, isBlindNil: false },
        ],
      });
      expect(allBidsComplete(state)).toBe(false);
    });

    it('should return true when all 4 players have bid', () => {
      const state = makeBiddingState({
        bids: [
          { playerId: 'p1', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p2', bid: 4, isNil: false, isBlindNil: false },
          { playerId: 'p3', bid: 3, isNil: false, isBlindNil: false },
          { playerId: 'p0', bid: 2, isNil: false, isBlindNil: false },
        ],
      });
      expect(allBidsComplete(state)).toBe(true);
    });

    it('should return false when currentRound is null', () => {
      const state = makeBiddingState();
      state.currentRound = null;
      expect(allBidsComplete(state)).toBe(false);
    });
  });

  describe('createBid', () => {
    it('should create a normal bid', () => {
      const bid = createBid('p1', 5, false, false);
      expect(bid).toEqual({
        playerId: 'p1',
        bid: 5,
        isNil: false,
        isBlindNil: false,
      });
    });

    it('should force bid to 0 for nil', () => {
      const bid = createBid('p1', 3, true, false);
      expect(bid.bid).toBe(0);
      expect(bid.isNil).toBe(true);
    });

    it('should force bid to 0 for blind nil', () => {
      const bid = createBid('p1', 7, false, true);
      expect(bid.bid).toBe(0);
      expect(bid.isBlindNil).toBe(true);
    });
  });

  describe('getTeamTotalBid', () => {
    it('should sum bids for specified player IDs', () => {
      const bids: PlayerBid[] = [
        { playerId: 'p0', bid: 3, isNil: false, isBlindNil: false },
        { playerId: 'p1', bid: 4, isNil: false, isBlindNil: false },
        { playerId: 'p2', bid: 5, isNil: false, isBlindNil: false },
        { playerId: 'p3', bid: 2, isNil: false, isBlindNil: false },
      ];
      expect(getTeamTotalBid(bids, ['p0', 'p2'])).toBe(8);
      expect(getTeamTotalBid(bids, ['p1', 'p3'])).toBe(6);
    });

    it('should exclude nil bids from team total', () => {
      const bids: PlayerBid[] = [
        { playerId: 'p0', bid: 0, isNil: true, isBlindNil: false },
        { playerId: 'p2', bid: 5, isNil: false, isBlindNil: false },
      ];
      expect(getTeamTotalBid(bids, ['p0', 'p2'])).toBe(5);
    });

    it('should exclude blind nil bids from team total', () => {
      const bids: PlayerBid[] = [
        { playerId: 'p0', bid: 0, isNil: false, isBlindNil: true },
        { playerId: 'p2', bid: 4, isNil: false, isBlindNil: false },
      ];
      expect(getTeamTotalBid(bids, ['p0', 'p2'])).toBe(4);
    });

    it('should return 0 when both teammates bid nil', () => {
      const bids: PlayerBid[] = [
        { playerId: 'p0', bid: 0, isNil: true, isBlindNil: false },
        { playerId: 'p2', bid: 0, isNil: false, isBlindNil: true },
      ];
      expect(getTeamTotalBid(bids, ['p0', 'p2'])).toBe(0);
    });

    it('should return 0 for empty bids array', () => {
      expect(getTeamTotalBid([], ['p0', 'p2'])).toBe(0);
    });
  });
});
