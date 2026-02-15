import type {
  RuleMod,
  ScoreContext,
  CalculateDisabledBidsContext,
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
    onCalculateDisabledBids: (
      context: CalculateDisabledBidsContext
    ): CalculateDisabledBidsContext => {
      const { gameState, playerId, currentBids, disabledBids } = context;

      const player = gameState.players.find((p) => p.id === playerId);
      if (!player) return context;

      const teamPlayers = gameState.players.filter(
        (p) => p.team === player.team
      );
      const teamBids = currentBids.filter((b) =>
        teamPlayers.some((tp) => tp.id === b.playerId)
      );

      if (teamBids.length === 0) {
        // First bidder on team: disable bids > 4
        const disabled = [5, 6, 7, 8, 9, 10, 11, 12, 13];
        return {
          ...context,
          disabledBids: [...disabledBids, ...disabled],
        };
      } else {
        // Second bidder: must complete to exactly 4
        const partnerBid = teamBids[0].bid;
        const requiredBid = 4 - partnerBid;

        // Disable all bids except the required one
        const disabled = Array.from({ length: 13 }, (_, i) => i + 1).filter(
          (bid) => bid !== requiredBid
        );

        return {
          ...context,
          disabledBids: [...disabledBids, ...disabled],
        };
      }
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
