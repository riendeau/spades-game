import type {
  RuleMod,
  CalculateDisabledBidsContext,
  RoundEndContext,
  RoundEndResult,
} from '@spades/shared';

interface AntiElevenState {
  disablementChance: number; // 0.0 to 1.0
  disablementOccurredThisRound: boolean;
  shouldDisableThisTurn?: boolean; // Decision made when turn starts
  disabledBid: number | null; // Which specific bid is disabled
}

/**
 * Anti-11 Mod: Occasionally prevents 4th bidder from bidding
 * a value that would bring the total table bid to exactly 11.
 *
 * - Starts at 0% chance
 * - After each round with total bid = 11, chance increases 10%
 * - When disablement occurs, chance resets to 0%
 * - If total >= 11 before 4th bidder, no check performed
 */
export const antiElevenMod: RuleMod = {
  id: 'anti-eleven',
  name: 'Anti-11',
  description:
    'Occasionally prevents the 4th bidder from making the table total equal 11.',
  version: '1.0.0',
  type: 'rule',
  author: 'Spades Team',

  hooks: {
    onCalculateDisabledBids: (
      context: CalculateDisabledBidsContext
    ): CalculateDisabledBidsContext => {
      const { currentBids, modState } = context;

      // Only apply to 4th bidder
      if (currentBids.length !== 3) {
        return context;
      }

      // Calculate current table bid
      const tableBid = currentBids.reduce(
        (sum, b) => sum + (b.isNil || b.isBlindNil ? 0 : b.bid),
        0
      );

      // If table already >= 11, skip check entirely
      if (tableBid >= 11) {
        return context;
      }

      const state = (modState || {}) as AntiElevenState;

      // Make disablement decision on first call for this turn
      if (state.shouldDisableThisTurn === undefined) {
        const chance = state.disablementChance || 0;
        const shouldDisable = Math.random() < chance;

        // Calculate which bid(s) would make total = 11
        const targetBid = 11 - tableBid;
        const disabledBid =
          targetBid >= 1 && targetBid <= 13 ? targetBid : null;

        // Store decision in modState
        const newState: AntiElevenState = {
          ...state,
          shouldDisableThisTurn: shouldDisable,
          disabledBid: shouldDisable ? disabledBid : null,
          disablementOccurredThisRound: shouldDisable,
        };

        const result = {
          ...context,
          modState: newState,
          disabledBids:
            shouldDisable && disabledBid !== null
              ? [...context.disabledBids, disabledBid]
              : context.disabledBids,
        };

        return result;
      }

      // Decision already made - just return stored result
      if (state.shouldDisableThisTurn && state.disabledBid !== null) {
        return {
          ...context,
          disabledBids: [...context.disabledBids, state.disabledBid],
        };
      }

      return context;
    },

    onRoundEnd: (context: RoundEndContext): RoundEndResult => {
      const { roundSummary, modState } = context;
      const state = (modState || {}) as AntiElevenState;

      // Calculate total table bid
      const totalBid = roundSummary.team1.bid + roundSummary.team2.bid;

      // Clear turn state
      const baseState = {
        shouldDisableThisTurn: undefined,
        disabledBid: null,
      };

      // Only react to exactly 11
      if (totalBid !== 11) {
        return {
          modState: {
            ...state,
            ...baseState,
            disablementOccurredThisRound: false,
          },
        };
      }

      // If disablement occurred, reset chance to 0%
      if (state.disablementOccurredThisRound) {
        return {
          modState: {
            disablementChance: 0,
            disablementOccurredThisRound: false,
            shouldDisableThisTurn: undefined,
            disabledBid: null,
          },
        };
      }

      // Otherwise, increase chance by 10%
      const newChance = Math.min(1.0, (state.disablementChance || 0) + 0.1);
      return {
        modState: {
          disablementChance: newChance,
          disablementOccurredThisRound: false,
          shouldDisableThisTurn: undefined,
          disabledBid: null,
        },
      };
    },
  },
};
