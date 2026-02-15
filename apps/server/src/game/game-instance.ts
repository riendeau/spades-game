import {
  type GameState,
  type GameConfig,
  type Card,
  type PlayerId,
  type ClientGameState,
  processAction,
  DEFAULT_GAME_CONFIG,
  type GameAction,
  type ActionResult,
  type SideEffect,
} from '@spades/shared';
import { hookExecutor } from '../mods/hook-executor.js';

export class GameInstance {
  private state: GameState;
  private config: GameConfig;
  private playerHands = new Map<PlayerId, Card[]>();
  private modState = new Map<string, unknown>();

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
    };

    // Calculate disabled bids for current bidder
    if (this.state.phase === 'bidding') {
      const currentBids = this.state.currentRound?.bids ?? [];
      const currentPlayer = this.state.players.find(
        (p) => p.position === this.state.currentPlayerPosition
      );
      const disabledBidsSet = new Set<number>();

      if (currentPlayer) {
        // Check each possible bid (1-13) against mod hooks
        for (let testBid = 1; testBid <= 13; testBid++) {
          const modContext = hookExecutor.executeValidateBid({
            gameState: this.state,
            config: this.config,
            playerId: currentPlayer.id,
            bid: testBid,
            isNil: false,
            isBlindNil: false,
            currentBids,
            modState: this.getModState('anti-eleven'),
            isValid: true,
          });

          if (modContext.disabledBids) {
            modContext.disabledBids.forEach((b) => disabledBidsSet.add(b));
          }
        }

        if (disabledBidsSet.size > 0) {
          result.disabledBids = Array.from(disabledBidsSet);
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

      // If trick ended, collect it
      if (this.state.phase === 'trick-end') {
        const collectResult = this.dispatch({ type: 'COLLECT_TRICK' });

        // If round ended, process scoring
        const phaseAfterCollect = this.getState().phase;
        let endRoundSideEffects: SideEffect[] = [];
        if (phaseAfterCollect === 'round-end') {
          const endRoundResult = this.dispatch({ type: 'END_ROUND' });
          endRoundSideEffects = endRoundResult.sideEffects ?? [];

          // Execute mod round-end hooks
          const roundSummary = endRoundSideEffects.find(
            (e): e is Extract<SideEffect, { type: 'ROUND_COMPLETE' }> =>
              e.type === 'ROUND_COMPLETE'
          )?.summary;

          if (roundSummary) {
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
            }
          }
        }

        return {
          ...result,
          state: this.state,
          sideEffects: [
            ...(result.sideEffects ?? []),
            ...(collectResult.sideEffects ?? []),
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
