import type {
  RuleMod,
  CalculateDisabledBidsContext,
  RoundEndContext,
  RoundEndResult,
} from '@spades/shared';

interface AntiElevenState {
  disablementChance: number; // 0.0 to 1.0
  shouldDisableThisTurn?: boolean; // Decision made when turn starts
  disabledBid: number | null; // Which specific bid is disabled
}

/**
 * Anti-11 Mod: Occasionally prevents 4th bidder from bidding
 * a value that would bring the total table bid to exactly 11.
 *
 * - Starts at 0% chance
 * - After each round with total bid = 11, chance increases 10%
 * - When disablement fires, chance resets to 0%
 * - If total >= 11 before 4th bidder, no check performed
 *
 * The two chance adjustments deliberately live in different hooks:
 *
 * - The **reset** happens in `onCalculateDisabledBids`, at the moment the
 *   decision is made. It cannot happen in `onRoundEnd` keyed off the round's
 *   total, because a round we fired on can never total 11 — blocking that is
 *   the whole point — so such a check is unreachable. Firing is also visible
 *   to the player immediately, so that's when the odds are genuinely spent.
 * - The **increase** must stay in `onRoundEnd`. `onCalculateDisabledBids` runs
 *   for the 4th bidder *before* their bid exists, and `getDisabledBids()` bails
 *   out once the phase leaves `bidding`, so this hook never observes a
 *   completed four-bid set.
 *
 * Note the asymmetry in why that split is safe: `getDisabledBids()` is called
 * repeatedly per turn (every `toClientState()` plus the `makeBid()`
 * enforcement check), so only an idempotent write belongs there. Setting the
 * chance to 0 survives that; the `+10%` increment would not, and gets the
 * once-per-round guarantee of `onRoundEnd` instead.
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

      // If any existing bid is nil/blind nil, skip entirely
      if (currentBids.some((b) => b.isNil || b.isBlindNil)) {
        return context;
      }

      // Calculate current table bid
      const tableBid = currentBids.reduce((sum, b) => sum + b.bid, 0);

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
          // Firing spends the accumulated odds (see the note above on why the
          // reset can't live in onRoundEnd).
          disablementChance: shouldDisable ? 0 : chance,
          shouldDisableThisTurn: shouldDisable,
          disabledBid: shouldDisable ? disabledBid : null,
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
      const chance = state.disablementChance || 0;

      // Calculate total table bid
      const totalBid = roundSummary.team1.bid + roundSummary.team2.bid;

      // Only react to exactly 11 with no nil bids
      const hasNilBid =
        roundSummary.team1.nilResults.length > 0 ||
        roundSummary.team2.nilResults.length > 0;
      const isNaturalEleven = totalBid === 11 && !hasNilBid;

      return {
        modState: {
          disablementChance: isNaturalEleven
            ? Math.min(1.0, chance + 0.1)
            : chance,
          // Clear the turn decision so next round re-rolls.
          shouldDisableThisTurn: undefined,
          disabledBid: null,
        },
      };
    },
  },
};
