import {
  type GameState,
  type GameConfig,
  type Card,
  type PlayerId,
  type Position,
  type ClientGameState,
  type RoundEffect,
  type ScoreHistoryEntry,
  processAction,
  DEFAULT_GAME_CONFIG,
  type GameAction,
  type ActionResult,
  type SideEffect,
} from '@spades/shared';
import { hookExecutor } from '../mods/hook-executor.js';

export interface RoundBidData {
  roundNumber: number;
  playerId: PlayerId;
  position: Position;
  bid: number;
  isNil: boolean;
  isBlindNil: boolean;
  tricksWon: number;
}

export class GameInstance {
  private state: GameState;
  private config: GameConfig;
  private playerHands = new Map<PlayerId, Card[]>();
  private modState = new Map<string, unknown>();
  private teamNames: {
    team1: string;
    team2: string;
    startButton?: string;
  } | null = null;
  private roundEffects: RoundEffect[] = [];
  private roundBids: RoundBidData[] = [];
  private scoreHistory: ScoreHistoryEntry[] = [
    { round: 0, team1Score: 0, team2Score: 0 },
  ];

  constructor(
    initialState: GameState,
    config: GameConfig = DEFAULT_GAME_CONFIG
  ) {
    this.state = initialState;
    this.config = config;
  }

  getState(): GameState {
    return this.state;
  }

  getConfig(): GameConfig {
    return this.config;
  }

  getPlayerHand(playerId: PlayerId): Card[] {
    return this.playerHands.get(playerId) ?? [];
  }

  getModState(modId: string): unknown {
    return this.modState.get(modId);
  }

  getRoundEffects(): RoundEffect[] {
    return this.roundEffects;
  }

  getScoreHistory(): ScoreHistoryEntry[] {
    return this.scoreHistory;
  }

  getRoundBids(): RoundBidData[] {
    return this.roundBids;
  }

  getTeamNames(): {
    team1: string;
    team2: string;
    startButton?: string;
  } | null {
    return this.teamNames;
  }

  setTeamNames(names: {
    team1: string;
    team2: string;
    startButton?: string;
  }): void {
    this.teamNames = names;
  }

  setModState(modId: string, state: unknown): void {
    this.modState.set(modId, state);
  }

  dispatch(action: GameAction): ActionResult {
    const result = processAction(this.state, action, this.config);

    if (result.valid) {
      this.state = result.state;

      // Update player hands cache from side effects
      if (result.sideEffects) {
        for (const effect of result.sideEffects) {
          if (effect.type === 'DEAL_HANDS') {
            for (const [playerId, hand] of Object.entries(effect.hands)) {
              this.playerHands.set(playerId, hand);
            }
          }
        }
      }
    }

    return result;
  }

  toClientState(): ClientGameState {
    const tricksWon: Record<PlayerId, number> = {};
    this.state.players.forEach((p) => {
      tricksWon[p.id] = 0;
    });

    if (this.state.currentRound) {
      for (const trick of this.state.currentRound.tricks) {
        if (trick.winner) {
          tricksWon[trick.winner]++;
        }
      }
    }

    const result: ClientGameState = {
      id: this.state.id,
      phase: this.state.phase,
      players: this.state.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        position: p.position,
        team: p.team,
        cardCount: p.hand.length,
        connected: p.connected,
        ready: p.ready,
      })),
      scores: this.state.scores,
      currentRound: this.state.currentRound
        ? {
            roundNumber: this.state.currentRound.roundNumber,
            bids: this.state.currentRound.bids,
            currentTrick: {
              plays: this.state.currentRound.currentTrick.plays,
              leadSuit: this.state.currentRound.currentTrick.leadSuit,
            },
            tricksWon,
            spadesBroken: this.state.currentRound.spadesBroken,
          }
        : null,
      dealerPosition: this.state.dealerPosition,
      currentPlayerPosition: this.state.currentPlayerPosition,
      winningScore: this.state.winningScore,
      teamNames: this.teamNames ?? undefined,
    };

    // Calculate disabled bids for current bidder
    if (this.state.phase === 'bidding') {
      const currentBids = this.state.currentRound?.bids ?? [];
      const currentPlayer = this.state.players.find(
        (p) => p.position === this.state.currentPlayerPosition
      );

      if (currentPlayer) {
        const disabledBidsContext = hookExecutor.executeCalculateDisabledBids({
          gameState: this.state,
          config: this.config,
          playerId: currentPlayer.id,
          currentBids,
          modState: this.getModState('anti-eleven'),
          disabledBids: [],
        });

        if (disabledBidsContext.disabledBids.length > 0) {
          result.disabledBids = disabledBidsContext.disabledBids;
        }

        // Update mod state if changed
        if (disabledBidsContext.modState !== undefined) {
          this.setModState('anti-eleven', disabledBidsContext.modState);
        }
      }
    }

    return result;
  }

  addPlayer(playerId: PlayerId, nickname: string): ActionResult {
    return this.dispatch({
      type: 'PLAYER_JOIN',
      playerId,
      nickname,
    });
  }

  removePlayer(playerId: PlayerId): ActionResult {
    return this.dispatch({
      type: 'PLAYER_LEAVE',
      playerId,
    });
  }

  setPlayerReady(playerId: PlayerId): ActionResult {
    return this.dispatch({
      type: 'PLAYER_READY',
      playerId,
    });
  }

  reconnectPlayer(playerId: PlayerId): ActionResult {
    return this.dispatch({
      type: 'PLAYER_RECONNECT',
      playerId,
    });
  }

  disconnectPlayer(playerId: PlayerId): ActionResult {
    return this.dispatch({
      type: 'PLAYER_DISCONNECT',
      playerId,
    });
  }

  startGame(): ActionResult {
    const startResult = this.dispatch({ type: 'START_GAME' });
    if (!startResult.valid) return startResult;

    return this.dispatch({ type: 'DEAL_CARDS' });
  }

  makeBid(
    playerId: PlayerId,
    bid: number,
    isNil = false,
    isBlindNil = false
  ): ActionResult {
    return this.dispatch({
      type: 'MAKE_BID',
      playerId,
      bid,
      isNil,
      isBlindNil,
    });
  }

  playCard(playerId: PlayerId, card: Card): ActionResult {
    // Validate card is in hand
    const hand = this.playerHands.get(playerId);
    if (!hand?.some((c) => c.suit === card.suit && c.rank === card.rank)) {
      return {
        state: this.state,
        valid: false,
        error: 'Card not in hand',
      };
    }

    const result = this.dispatch({
      type: 'PLAY_CARD',
      playerId,
      card,
    });

    if (result.valid) {
      // Update local hand cache
      const newHand = hand.filter(
        (c) => !(c.suit === card.suit && c.rank === card.rank)
      );
      this.playerHands.set(playerId, newHand);
    }

    return result;
  }

  // Dispatches COLLECT_TRICK (and END_ROUND if the round is over). Must only
  // be called when the game is in the 'trick-end' phase — i.e. after playCard()
  // has returned a result containing a TRICK_COMPLETE side effect.
  collectTrick(): ActionResult {
    const collectResult = this.dispatch({ type: 'COLLECT_TRICK' });

    // If round ended, process scoring and run mod hooks
    let endRoundSideEffects: SideEffect[] = [];
    if (this.getState().phase === 'round-end') {
      // Capture bid and trick data before END_ROUND
      const bids = this.state.currentRound!.bids;
      const roundNumber = this.state.currentRound!.roundNumber;

      const playerTricksWon: Record<PlayerId, number> = {};
      for (const p of this.state.players) {
        playerTricksWon[p.id] = 0;
      }
      for (const trick of this.state.currentRound!.tricks) {
        if (trick.winner) {
          playerTricksWon[trick.winner]++;
        }
      }

      const endRoundResult = this.dispatch({ type: 'END_ROUND' });
      endRoundSideEffects = endRoundResult.sideEffects ?? [];

      const roundSummary = endRoundSideEffects.find(
        (e): e is Extract<SideEffect, { type: 'ROUND_COMPLETE' }> =>
          e.type === 'ROUND_COMPLETE'
      )?.summary;

      if (roundSummary) {
        this.scoreHistory.push({
          round: roundSummary.roundNumber,
          team1Score: this.state.scores.team1.score,
          team2Score: this.state.scores.team2.score,
        });

        // Record all player bids for this round
        for (const bid of bids) {
          const player = this.state.players.find((p) => p.id === bid.playerId)!;
          this.roundBids.push({
            roundNumber,
            playerId: bid.playerId,
            position: player.position,
            bid: bid.bid,
            isNil: bid.isNil,
            isBlindNil: bid.isBlindNil,
            tricksWon: playerTricksWon[bid.playerId] ?? 0,
          });
        }

        this.roundEffects = [];

        for (const modId of hookExecutor.getAllModIds()) {
          const hookResult = hookExecutor.executeRoundEnd(
            {
              gameState: this.state,
              config: this.config,
              roundSummary,
              modState: this.getModState(modId),
            },
            modId
          );

          if (hookResult.modState !== undefined) {
            this.setModState(modId, hookResult.modState);
          }

          if (hookResult.effects) {
            this.roundEffects.push(...hookResult.effects);
          }
        }
      }
    }

    return {
      ...collectResult,
      state: this.state,
      sideEffects: [
        ...(collectResult.sideEffects ?? []),
        ...endRoundSideEffects,
      ],
    };
  }

  startNextRound(): ActionResult {
    const nextResult = this.dispatch({ type: 'START_NEXT_ROUND' });
    if (!nextResult.valid) return nextResult;

    return this.dispatch({ type: 'DEAL_CARDS' });
  }

  replacePlayer(playerId: PlayerId, nickname: string): ActionResult {
    return this.dispatch({
      type: 'PLAYER_REPLACE',
      playerId,
      nickname,
    });
  }

  movePlayerToSeat(playerId: PlayerId, newPosition: Position): ActionResult {
    return this.dispatch({
      type: 'PLAYER_CHANGE_SEAT',
      playerId,
      newPosition,
    });
  }

  isPlayerTurn(playerId: PlayerId): boolean {
    const player = this.state.players.find((p) => p.id === playerId);
    return player?.position === this.state.currentPlayerPosition;
  }

  getPlayerByPosition(position: number): PlayerId | undefined {
    return this.state.players.find((p) => p.position === position)?.id;
  }
}
