import type {
  RuleMod,
  ScoreContext,
  BidValidationContext,
} from '@spades/shared';

/**
 * Suicide Spades: Each team must bid a combined total of exactly 4.
 * First player bids 0-4, partner must bid the remainder to make 4.
 */
export const suicideSpadesMod: RuleMod = {
  id: 'suicide-spades',
  name: 'Suicide Spades',
  description:
    'Teams must bid exactly 4 combined. First player bids 0-4, partner bids the rest.',
  version: '1.0.0',
  type: 'rule',
  author: 'Spades Team',

  hooks: {
    onValidateBid: (context: BidValidationContext): BidValidationContext => {
      const { gameState, playerId, bid, isNil, isBlindNil } = context;

      // Don't allow nil in Suicide Spades
      if (isNil || isBlindNil) {
        return {
          ...context,
          isValid: false,
          errorMessage: 'Nil bids are not allowed in Suicide Spades',
        };
      }

      const player = gameState.players.find((p) => p.id === playerId);
      if (!player) return context;

      const teamPlayers = gameState.players.filter(
        (p) => p.team === player.team
      );
      const teamBids =
        gameState.currentRound?.bids.filter((b) =>
          teamPlayers.some((tp) => tp.id === b.playerId)
        ) || [];

      if (teamBids.length === 0) {
        // First bidder on team: must bid 0-4
        if (bid < 0 || bid > 4) {
          return {
            ...context,
            isValid: false,
            errorMessage: 'First team bidder must bid 0-4 in Suicide Spades',
          };
        }
      } else {
        // Second bidder: must complete the 4
        const partnerBid = teamBids[0].bid;
        const requiredBid = 4 - partnerBid;

        if (bid !== requiredBid) {
          return {
            ...context,
            isValid: false,
            errorMessage: `Must bid ${requiredBid} to make team total of 4`,
          };
        }
      }

      return context;
    },

    onCalculateScore: (context: ScoreContext): ScoreContext => {
      // In Suicide Spades, exact bid is required
      // Making exactly 4 tricks = 40 points
      // Under = lose 40 points
      // Over = lose 40 points (set)

      const { bid, tricks } = context;

      if (bid !== 4) {
        // Something went wrong with validation
        return context;
      }

      if (tricks === 4) {
        return {
          ...context,
          calculatedScore: 40,
          calculatedBags: 0,
        };
      } else {
        return {
          ...context,
          calculatedScore: -40,
          calculatedBags: 0,
        };
      }
    },

    modifyConfig: (config) => ({
      ...config,
      allowNil: false,
      allowBlindNil: false,
    }),
  },
};
