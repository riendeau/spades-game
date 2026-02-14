import type {
  GameState,
  GameConfig,
  Card,
  PlayerId,
  ClientGameState,
  RoundSummary,
  processAction,
  DEFAULT_GAME_CONFIG,
  type GameAction,
  type ActionResult,
  type SideEffect,
} from '@spades/shared';

export class GameInstance {
  private state: GameState;
  private config: GameConfig;
  private playerHands = new Map<PlayerId, Card[]>();

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
    return this.playerHands.get(playerId) || [];
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

      // Also sync hands from state
      for (const player of this.state.players) {
        if (player.hand.length > 0) {
          this.playerHands.set(player.id, player.hand);
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

    return {
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
    };
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

      // If trick ended, collect it
      if (this.state.phase === 'trick-end') {
        const collectResult = this.dispatch({ type: 'COLLECT_TRICK' });

        // If round ended, process scoring
        const phaseAfterCollect = this.getState().phase;
        let endRoundSideEffects: SideEffect[] = [];
        if (phaseAfterCollect === 'round-end') {
          const endRoundResult = this.dispatch({ type: 'END_ROUND' });
          endRoundSideEffects = endRoundResult.sideEffects || [];
        }

        return {
          ...result,
          state: this.state,
          sideEffects: [
            ...(result.sideEffects || []),
            ...(collectResult.sideEffects || []),
            ...endRoundSideEffects,
          ],
        };
      }
    }

    return result;
  }

  startNextRound(): ActionResult {
    const nextResult = this.dispatch({ type: 'START_NEXT_ROUND' });
    if (!nextResult.valid) return nextResult;

    return this.dispatch({ type: 'DEAL_CARDS' });
  }

  isPlayerTurn(playerId: PlayerId): boolean {
    const player = this.state.players.find((p) => p.id === playerId);
    return player?.position === this.state.currentPlayerPosition;
  }

  getPlayerByPosition(position: number): PlayerId | undefined {
    return this.state.players.find((p) => p.position === position)?.id;
  }
}
