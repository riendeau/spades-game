import {
  allBidsComplete,
  getNextBidder,
  createBid,
} from '../game-logic/bidding.js';
import {
  createDeck,
  dealCards,
  removeCardFromHand,
} from '../game-logic/deck.js';
import {
  calculateRoundScore,
  updateTeamScore,
  checkGameEnd,
  createRoundSummary,
} from '../game-logic/scoring.js';
import {
  addPlayToTrick,
  isTrickComplete,
  determineTrickWinner,
} from '../game-logic/trick.js';
import type { Card } from '../types/card.js';
import type {
  GameState,
  GamePhase,
  GameConfig,
  Trick,
  createEmptyTrick,
  createRoundState,
} from '../types/game-state.js';
import { DEFAULT_GAME_CONFIG } from '../types/game-state.js';
import type { Player, PlayerId, Position, PlayerBid } from '../types/player.js';
import { getTeamForPosition } from '../types/player.js';

export type GameAction =
  | { type: 'PLAYER_JOIN'; playerId: PlayerId; nickname: string }
  | { type: 'PLAYER_LEAVE'; playerId: PlayerId }
  | { type: 'PLAYER_READY'; playerId: PlayerId }
  | { type: 'PLAYER_RECONNECT'; playerId: PlayerId }
  | { type: 'PLAYER_DISCONNECT'; playerId: PlayerId }
  | { type: 'START_GAME' }
  | { type: 'DEAL_CARDS' }
  | {
      type: 'MAKE_BID';
      playerId: PlayerId;
      bid: number;
      isNil: boolean;
      isBlindNil: boolean;
    }
  | { type: 'PLAY_CARD'; playerId: PlayerId; card: Card }
  | { type: 'COLLECT_TRICK' }
  | { type: 'END_ROUND' }
  | { type: 'START_NEXT_ROUND' };

export interface ActionResult {
  state: GameState;
  valid: boolean;
  error?: string;
  sideEffects?: SideEffect[];
}

export type SideEffect =
  | { type: 'DEAL_HANDS'; hands: Record<PlayerId, Card[]> }
  | { type: 'TRICK_COMPLETE'; winnerId: PlayerId; trickNumber: number }
  | { type: 'ROUND_COMPLETE'; summary: ReturnType<typeof createRoundSummary> }
  | { type: 'GAME_COMPLETE'; winner: 'team1' | 'team2' };

const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  waiting: ['ready'],
  ready: ['dealing'],
  dealing: ['bidding'],
  bidding: ['playing'],
  playing: ['trick-end', 'playing'],
  'trick-end': ['playing', 'round-end'],
  'round-end': ['dealing', 'game-end'],
  'game-end': [],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function processAction(
  state: GameState,
  action: GameAction,
  config: GameConfig = DEFAULT_GAME_CONFIG
): ActionResult {
  const newState = { ...state, lastActivity: Date.now() };

  switch (action.type) {
    case 'PLAYER_JOIN':
      return handlePlayerJoin(newState, action.playerId, action.nickname);

    case 'PLAYER_LEAVE':
      return handlePlayerLeave(newState, action.playerId);

    case 'PLAYER_READY':
      return handlePlayerReady(newState, action.playerId);

    case 'PLAYER_RECONNECT':
      return handlePlayerReconnect(newState, action.playerId);

    case 'PLAYER_DISCONNECT':
      return handlePlayerDisconnect(newState, action.playerId);

    case 'START_GAME':
      return handleStartGame(newState);

    case 'DEAL_CARDS':
      return handleDealCards(newState);

    case 'MAKE_BID':
      return handleMakeBid(
        newState,
        action.playerId,
        action.bid,
        action.isNil,
        action.isBlindNil,
        config
      );

    case 'PLAY_CARD':
      return handlePlayCard(newState, action.playerId, action.card, config);

    case 'COLLECT_TRICK':
      return handleCollectTrick(newState, config);

    case 'END_ROUND':
      return handleEndRound(newState, config);

    case 'START_NEXT_ROUND':
      return handleStartNextRound(newState);

    default:
      return { state, valid: false, error: 'Unknown action' };
  }
}

function handlePlayerJoin(
  state: GameState,
  playerId: PlayerId,
  nickname: string
): ActionResult {
  if (state.phase !== 'waiting') {
    return { state, valid: false, error: 'Game already started' };
  }

  if (state.players.length >= 4) {
    return { state, valid: false, error: 'Game is full' };
  }

  if (state.players.some((p) => p.id === playerId)) {
    return { state, valid: false, error: 'Player already in game' };
  }

  const position = state.players.length as Position;
  const team = getTeamForPosition(position);

  const newPlayer: Player = {
    id: playerId,
    nickname,
    position,
    team,
    hand: [],
    connected: true,
    ready: false,
  };

  return {
    state: {
      ...state,
      players: [...state.players, newPlayer],
    },
    valid: true,
  };
}

function handlePlayerLeave(state: GameState, playerId: PlayerId): ActionResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { state, valid: false, error: 'Player not found' };
  }

  if (state.phase !== 'waiting') {
    // During game, just mark as disconnected
    return handlePlayerDisconnect(state, playerId);
  }

  // In waiting phase, remove player and reposition remaining players
  const remainingPlayers = state.players
    .filter((p) => p.id !== playerId)
    .map((p, idx) => ({
      ...p,
      position: idx as Position,
      team: getTeamForPosition(idx as Position),
    }));

  return {
    state: {
      ...state,
      players: remainingPlayers,
    },
    valid: true,
  };
}

function handlePlayerReady(state: GameState, playerId: PlayerId): ActionResult {
  if (state.phase !== 'waiting') {
    return { state, valid: false, error: 'Cannot ready during game' };
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { state, valid: false, error: 'Player not found' };
  }

  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...newPlayers[playerIndex], ready: true };

  const allReady = newPlayers.length === 4 && newPlayers.every((p) => p.ready);

  return {
    state: {
      ...state,
      players: newPlayers,
      phase: allReady ? 'ready' : 'waiting',
    },
    valid: true,
  };
}

function handlePlayerReconnect(
  state: GameState,
  playerId: PlayerId
): ActionResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { state, valid: false, error: 'Player not found' };
  }

  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...newPlayers[playerIndex], connected: true };

  return {
    state: { ...state, players: newPlayers },
    valid: true,
  };
}

function handlePlayerDisconnect(
  state: GameState,
  playerId: PlayerId
): ActionResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { state, valid: false, error: 'Player not found' };
  }

  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...newPlayers[playerIndex], connected: false };

  return {
    state: { ...state, players: newPlayers },
    valid: true,
  };
}

function handleStartGame(state: GameState): ActionResult {
  if (state.phase !== 'ready') {
    return { state, valid: false, error: 'Not all players ready' };
  }

  return {
    state: { ...state, phase: 'dealing' },
    valid: true,
  };
}

function handleDealCards(state: GameState): ActionResult {
  if (state.phase !== 'dealing') {
    return { state, valid: false, error: 'Not in dealing phase' };
  }

  const deck = createDeck();
  const hands = dealCards(deck);

  const newPlayers = state.players.map((player, idx) => ({
    ...player,
    hand: hands[idx],
  }));

  const roundNumber = state.currentRound
    ? state.currentRound.roundNumber + 1
    : 1;

  const handsRecord: Record<PlayerId, Card[]> = {};
  newPlayers.forEach((p) => {
    handsRecord[p.id] = p.hand;
  });

  return {
    state: {
      ...state,
      phase: 'bidding',
      players: newPlayers,
      currentRound: {
        roundNumber,
        bids: [],
        tricks: [],
        currentTrick: { plays: [], leadSuit: null, winner: null },
        spadesBroken: false,
      },
      currentPlayerPosition: ((state.dealerPosition + 1) % 4) as Position,
    },
    valid: true,
    sideEffects: [{ type: 'DEAL_HANDS', hands: handsRecord }],
  };
}

function handleMakeBid(
  state: GameState,
  playerId: PlayerId,
  bid: number,
  isNil: boolean,
  isBlindNil: boolean,
  config: GameConfig
): ActionResult {
  if (state.phase !== 'bidding') {
    return { state, valid: false, error: 'Not in bidding phase' };
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { state, valid: false, error: 'Player not found' };
  }

  if (player.position !== state.currentPlayerPosition) {
    return { state, valid: false, error: 'Not your turn' };
  }

  if (!state.currentRound) {
    return { state, valid: false, error: 'No active round' };
  }

  const newBid = createBid(playerId, bid, isNil, isBlindNil);
  const newBids = [...state.currentRound.bids, newBid];

  const allBidsDone = newBids.length === 4;
  const nextPosition = allBidsDone
    ? (((state.dealerPosition + 1) % 4) as Position)
    : (((state.currentPlayerPosition + 1) % 4) as Position);

  return {
    state: {
      ...state,
      phase: allBidsDone ? 'playing' : 'bidding',
      currentRound: {
        ...state.currentRound,
        bids: newBids,
      },
      currentPlayerPosition: nextPosition,
    },
    valid: true,
  };
}

function handlePlayCard(
  state: GameState,
  playerId: PlayerId,
  card: Card,
  config: GameConfig
): ActionResult {
  if (state.phase !== 'playing') {
    return { state, valid: false, error: 'Not in playing phase' };
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { state, valid: false, error: 'Player not found' };
  }

  const player = state.players[playerIndex];
  if (player.position !== state.currentPlayerPosition) {
    return { state, valid: false, error: 'Not your turn' };
  }

  if (!state.currentRound) {
    return { state, valid: false, error: 'No active round' };
  }

  // Remove card from hand
  const newHand = removeCardFromHand(player.hand, card);
  if (newHand.length === player.hand.length) {
    return { state, valid: false, error: 'Card not in hand' };
  }

  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...player, hand: newHand };

  // Add play to trick
  const newTrick = addPlayToTrick(state.currentRound.currentTrick, {
    playerId,
    card,
  });

  // Check if spades are now broken
  const spadesBroken =
    state.currentRound.spadesBroken || card.suit === 'spades';

  const trickComplete = isTrickComplete(newTrick);
  const nextPosition = trickComplete
    ? state.currentPlayerPosition // Will be updated in COLLECT_TRICK
    : (((state.currentPlayerPosition + 1) % 4) as Position);

  const sideEffects: SideEffect[] = [];
  if (trickComplete && newTrick.winner) {
    sideEffects.push({
      type: 'TRICK_COMPLETE',
      winnerId: newTrick.winner,
      trickNumber: state.currentRound.tricks.length + 1,
    });
  }

  return {
    state: {
      ...state,
      phase: trickComplete ? 'trick-end' : 'playing',
      players: newPlayers,
      currentRound: {
        ...state.currentRound,
        currentTrick: newTrick,
        spadesBroken,
      },
      currentPlayerPosition: nextPosition,
    },
    valid: true,
    sideEffects,
  };
}

function handleCollectTrick(
  state: GameState,
  config: GameConfig
): ActionResult {
  if (state.phase !== 'trick-end') {
    return { state, valid: false, error: 'Not in trick-end phase' };
  }

  if (!state.currentRound) {
    return { state, valid: false, error: 'No active round' };
  }

  const completedTrick = state.currentRound.currentTrick;
  if (!completedTrick.winner) {
    return { state, valid: false, error: 'Trick has no winner' };
  }

  const winnerPlayer = state.players.find(
    (p) => p.id === completedTrick.winner
  );
  if (!winnerPlayer) {
    return { state, valid: false, error: 'Winner not found' };
  }

  const newTricks = [...state.currentRound.tricks, completedTrick];
  const isRoundOver = newTricks.length === 13;

  return {
    state: {
      ...state,
      phase: isRoundOver ? 'round-end' : 'playing',
      currentRound: {
        ...state.currentRound,
        tricks: newTricks,
        currentTrick: { plays: [], leadSuit: null, winner: null },
      },
      currentPlayerPosition: winnerPlayer.position,
    },
    valid: true,
  };
}

function handleEndRound(state: GameState, config: GameConfig): ActionResult {
  if (state.phase !== 'round-end') {
    return { state, valid: false, error: 'Not in round-end phase' };
  }

  if (!state.currentRound) {
    return { state, valid: false, error: 'No active round' };
  }

  // Calculate tricks won by each player
  const playerTricks: Record<PlayerId, number> = {};
  state.players.forEach((p) => {
    playerTricks[p.id] = 0;
  });

  for (const trick of state.currentRound.tricks) {
    if (trick.winner) {
      playerTricks[trick.winner]++;
    }
  }

  // Calculate scores for each team
  const calculateTeamScore = (teamId: 'team1' | 'team2') => {
    const teamPlayers = state.players.filter((p) => p.team === teamId);
    const teamBids = state.currentRound!.bids.filter((b) =>
      teamPlayers.some((p) => p.id === b.playerId)
    );
    const nilBids = teamBids.filter((b) => b.isNil || b.isBlindNil);
    const regularBid = teamBids
      .filter((b) => !b.isNil && !b.isBlindNil)
      .reduce((sum, b) => sum + b.bid, 0);
    const teamTricks = teamPlayers.reduce(
      (sum, p) => sum + playerTricks[p.id],
      0
    );

    return calculateRoundScore(
      regularBid,
      teamTricks,
      nilBids,
      playerTricks,
      config
    );
  };

  const team1Calc = calculateTeamScore('team1');
  const team2Calc = calculateTeamScore('team2');

  const newScores = {
    team1: updateTeamScore(state.scores.team1, team1Calc, config),
    team2: updateTeamScore(state.scores.team2, team2Calc, config),
  };

  const winner = checkGameEnd(newScores, state.winningScore);
  const summary = createRoundSummary(state, playerTricks, config);

  const sideEffects: SideEffect[] = [{ type: 'ROUND_COMPLETE', summary }];
  if (winner) {
    sideEffects.push({ type: 'GAME_COMPLETE', winner });
  }

  return {
    state: {
      ...state,
      phase: winner ? 'game-end' : 'round-end',
      scores: newScores,
      dealerPosition: ((state.dealerPosition + 1) % 4) as Position,
    },
    valid: true,
    sideEffects,
  };
}

function handleStartNextRound(state: GameState): ActionResult {
  if (state.phase !== 'round-end') {
    return { state, valid: false, error: 'Not in round-end phase' };
  }

  // Reset scores round tracking
  const newScores = {
    team1: { ...state.scores.team1, roundBid: 0, roundTricks: 0 },
    team2: { ...state.scores.team2, roundBid: 0, roundTricks: 0 },
  };

  // Clear player hands
  const newPlayers = state.players.map((p) => ({ ...p, hand: [] }));

  return {
    state: {
      ...state,
      phase: 'dealing',
      players: newPlayers,
      scores: newScores,
    },
    valid: true,
  };
}
