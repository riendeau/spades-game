import type { Card, ClientGameState } from '@spades/shared';
import { RANK_VALUES } from '@spades/shared';

export interface SluffInfo {
  targetPlayerId: string; // player who played the next-higher lead-suit card
}

/**
 * Detects whether a card play qualifies as a "sluff" — a nil bidder safely
 * ducking under a low lead-suit card with no spade threat.
 *
 * Returns SluffInfo identifying the target card to tuck under, or null.
 */
export function detectSluff(
  plays: { playerId: string; card: Card }[],
  newPlayIndex: number,
  gameState: ClientGameState
): SluffInfo | null {
  const round = gameState.currentRound;
  if (!round) return null;

  const play = plays[newPlayIndex];
  if (!play) return null;

  // 1. Must not be leading
  if (newPlayIndex === 0) return null;

  // 2. Player must have bid nil or blind nil
  const bid = round.bids.find((b) => b.playerId === play.playerId);
  if (!bid || (!bid.isNil && !bid.isBlindNil)) return null;

  // 3. Player must not have won any tricks yet
  if ((round.tricksWon[play.playerId] ?? 0) > 0) return null;

  // 4. Get lead suit
  const leadSuit = round.currentTrick.leadSuit;
  if (!leadSuit) return null;

  // 5. If lead suit isn't spades, no spade may have been played on this trick
  const priorPlays = plays.slice(0, newPlayIndex);
  if (leadSuit !== 'spades') {
    if (priorPlays.some((p) => p.card.suit === 'spades')) return null;
  }

  // 6. All prior lead-suit cards must have rank value <= 5
  const priorLeadSuitPlays = priorPlays.filter((p) => p.card.suit === leadSuit);
  if (priorLeadSuitPlays.length === 0) return null;

  const maxLeadRank = Math.max(
    ...priorLeadSuitPlays.map((p) => RANK_VALUES[p.card.rank])
  );
  if (maxLeadRank > 5) return null;

  // 7. Played card must follow suit
  if (play.card.suit !== leadSuit) return null;

  // 8. Find the next-higher lead-suit card (smallest rank still greater than played card)
  const playedRank = RANK_VALUES[play.card.rank];
  let targetPlay: (typeof priorPlays)[number] | null = null;
  let targetRank = Infinity;

  for (const prior of priorLeadSuitPlays) {
    const rank = RANK_VALUES[prior.card.rank];
    if (rank > playedRank && rank < targetRank) {
      targetRank = rank;
      targetPlay = prior;
    }
  }

  // If played card is higher than all lead-suit cards, no sluff
  if (!targetPlay) return null;

  return { targetPlayerId: targetPlay.playerId };
}
