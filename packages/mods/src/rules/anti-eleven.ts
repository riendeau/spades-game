import type {
  RuleMod,
  BidValidationContext,
  RoundEndContext,
  RoundEndResult,
} from '@spades/shared';

interface AntiElevenState {
  disablementChance: number; // 0.0 to 1.0
  disablementOccurredThisRound: boolean;
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
    onValidateBid: (context: BidValidationContext): BidValidationContext => {
      const { currentBids, bid, isNil, modState } = context;

      // Only apply to 4th bidder
      if (currentBids.length !== 3) {
        return context;
      }

      // Calculate current table bid
      const tableBid = currentBids.reduce(
        (sum, b) => sum + (b.isNil || b.isBlindNil ? 0 : b.bid),
        0
      );

      // If table already >= 11, skip check entirely (requirement 4)
      if (tableBid >= 11) {
        return context;
      }

      // Calculate what total would be with this bid
      const proposedBid = isNil ? 0 : bid;
      const proposedTotal = tableBid + proposedBid;

      // Only apply to bids that would make total exactly 11
      if (proposedTotal !== 11) {
        return context;
      }

      // Get current disablement chance (default 0%)
      const state = (modState || {}) as AntiElevenState;
      const chance = state.disablementChance || 0;

      // Randomly decide whether to disable based on current chance
      const shouldDisable = Math.random() < chance;

      if (shouldDisable) {
        return {
          ...context,
          disabledBids: [bid],
          modState: {
            ...state,
            disablementOccurredThisRound: true,
          },
        };
      }

      return context;
    },

    onRoundEnd: (context: RoundEndContext): RoundEndResult => {
      const { roundSummary, modState } = context;
      const state = (modState || {}) as AntiElevenState;

      // Calculate total table bid
      const totalBid = roundSummary.team1.bid + roundSummary.team2.bid;

      // Only react to exactly 11
      if (totalBid !== 11) {
        return { modState: { ...state, disablementOccurredThisRound: false } };
      }

      // If disablement occurred, reset chance to 0%
      if (state.disablementOccurredThisRound) {
        return {
          modState: {
            disablementChance: 0,
            disablementOccurredThisRound: false,
          },
        };
      }

      // Otherwise, increase chance by 10%
      const newChance = Math.min(1.0, (state.disablementChance || 0) + 0.1);
      return {
        modState: {
          disablementChance: newChance,
          disablementOccurredThisRound: false,
        },
      };
    },
  },
};
