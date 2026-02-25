import type { RoundSummary, TeamRoundResult } from '../types/events.js';
import type { GameState, GameConfig } from '../types/game-state.js';
import type {
  TeamId,
  PlayerId,
  PlayerBid,
  TeamScore,
} from '../types/player.js';
export interface ScoreCalculation {
  baseScore: number;
  bags: number;
  bagPenalty: number;
  nilBonus: number;
  totalScore: number;
}

export function calculateRoundScore(
  bid: number,
  tricks: number,
  nilBids: PlayerBid[],
  playerTricks: Record<PlayerId, number>
): ScoreCalculation {
  let baseScore = 0;
  let bags = 0;
  let nilBonus = 0;

  // Handle nil bids first
  for (const nilBid of nilBids) {
    const tricksTaken = playerTricks[nilBid.playerId] || 0;
    const nilValue = nilBid.isBlindNil ? 200 : 100;

    if (tricksTaken === 0) {
      // Successful nil
      nilBonus += nilValue;
    } else {
      // Failed nil
      nilBonus -= nilValue;
    }
  }

  // Calculate non-nil team score
  // If all players bid nil, bid would be 0
  if (bid === 0 && nilBids.length === 2) {
    // Both players bid nil, no base score calculation needed
  } else if (tricks >= bid) {
    // Made bid
    bags = tricks - bid;
    baseScore = bid * 10 + bags;
  } else {
    // Set (didn't make bid)
    baseScore = -bid * 10;
  }

  return {
    baseScore,
    bags,
    bagPenalty: 0,
    nilBonus,
    totalScore: baseScore + nilBonus,
  };
}

export function updateTeamScore(
  currentScore: TeamScore,
  roundCalculation: ScoreCalculation,
  config: GameConfig
): TeamScore {
  const newBags = currentScore.bags + roundCalculation.bags;
  let bagPenalty = 0;

  if (newBags >= config.bagPenaltyThreshold) {
    bagPenalty = config.bagPenalty;
  }

  const bageOverflow =
    newBags >= config.bagPenaltyThreshold
      ? newBags - config.bagPenaltyThreshold
      : 0;

  return {
    ...currentScore,
    score: currentScore.score + roundCalculation.totalScore - bagPenalty,
    bags: newBags >= config.bagPenaltyThreshold ? bageOverflow : newBags,
    roundBid: 0,
    roundTricks: 0,
  };
}

export function createRoundSummary(
  gameState: GameState,
  playerTricks: Record<PlayerId, number>,
  config: GameConfig
): RoundSummary {
  const round = gameState.currentRound!;

  const createTeamResult = (teamId: TeamId): TeamRoundResult => {
    const teamPlayers = gameState.players.filter((p) => p.team === teamId);
    const teamBids = round.bids.filter((b) =>
      teamPlayers.some((p) => p.id === b.playerId)
    );

    const nilBids = teamBids.filter((b) => b.isNil || b.isBlindNil);
    const regularBid = teamBids
      .filter((b) => !b.isNil && !b.isBlindNil)
      .reduce((sum, b) => sum + b.bid, 0);

    const teamTricks = teamPlayers.reduce(
      (sum, p) => sum + (playerTricks[p.id] || 0),
      0
    );

    const scoreCalc = calculateRoundScore(
      regularBid,
      teamTricks,
      nilBids,
      playerTricks
    );

    const nilResults = nilBids.map((nb) => ({
      playerId: nb.playerId,
      isBlindNil: nb.isBlindNil,
      succeeded: (playerTricks[nb.playerId] || 0) === 0,
      points:
        (playerTricks[nb.playerId] || 0) === 0
          ? nb.isBlindNil
            ? 200
            : 100
          : -(nb.isBlindNil ? 200 : 100),
    }));

    const currentTeamScore = gameState.scores[teamId];
    const newBags = currentTeamScore.bags + scoreCalc.bags;

    return {
      bid: regularBid,
      tricks: teamTricks,
      points: scoreCalc.totalScore,
      bags: scoreCalc.bags,
      bagPenalty: newBags >= config.bagPenaltyThreshold,
      nilResults,
    };
  };

  return {
    roundNumber: round.roundNumber,
    team1: createTeamResult('team1'),
    team2: createTeamResult('team2'),
  };
}

export function checkGameEnd(
  scores: GameState['scores'],
  winningScore: number
): 'team1' | 'team2' | null {
  const team1Score = scores.team1.score;
  const team2Score = scores.team2.score;

  if (team1Score >= winningScore && team2Score >= winningScore) {
    // Both teams over winning score, higher score wins
    return team1Score > team2Score
      ? 'team1'
      : team2Score > team1Score
        ? 'team2'
        : null;
  }

  if (team1Score >= winningScore) return 'team1';
  if (team2Score >= winningScore) return 'team2';

  return null;
}
