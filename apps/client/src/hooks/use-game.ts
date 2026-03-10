import type { Card, PlayerId, Position } from '@spades/shared';
import { useEffect, useCallback } from 'react';
import { useSocket } from '../socket/socket-context';
import {
  useGameStore,
  saveSession,
  loadSession,
  clearSession,
} from '../store/game-store';

export function useGame() {
  const { socket, connected } = useSocket();

  // Subscribe only to state fields that drive rendering — avoids re-renders
  // from unrelated store fields (sessionToken, nickname, lastTrickWinner).
  const roomId = useGameStore((s) => s.roomId);
  const myPosition = useGameStore((s) => s.myPosition);
  const gameState = useGameStore((s) => s.gameState);
  const myHand = useGameStore((s) => s.myHand);
  const cardsRevealed = useGameStore((s) => s.cardsRevealed);
  const roundSummary = useGameStore((s) => s.roundSummary);
  const roundEffects = useGameStore((s) => s.roundEffects);
  const scoreHistory = useGameStore((s) => s.scoreHistory);
  const gameEnded = useGameStore((s) => s.gameEnded);
  const gameSummary = useGameStore((s) => s.gameSummary);
  const teamNameReveal = useGameStore((s) => s.teamNameReveal);
  const error = useGameStore((s) => s.error);
  const availableSeats = useGameStore((s) => s.availableSeats);
  const seatSelectRoomId = useGameStore((s) => s.seatSelectRoomId);

  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;

    // Use getState() inside handlers so they always call the current action
    // without the effect needing to re-run when store state changes.
    // Actions are stable references in zustand — getState() is safe here.
    socket.on('room:created', ({ roomId, sessionToken }) => {
      useGameStore.getState().setSession(roomId, sessionToken, 0);
      saveSession(roomId, sessionToken);
    });

    socket.on('room:joined', ({ roomId, position, sessionToken }) => {
      const store = useGameStore.getState();
      const wasSelectingSeat = !!store.availableSeats;
      store.setSession(roomId, sessionToken, position);
      store.clearAvailableSeats();
      saveSession(roomId, sessionToken);

      // Auto-reveal cards for mid-game seat replacement. setTimeout(0)
      // ensures this runs after the game:cards-dealt handler (which
      // resets cardsRevealed to false via setHand).
      if (wasSelectingSeat) {
        setTimeout(() => useGameStore.getState().revealCards(), 0);
      }
    });

    socket.on('game:started', () => {
      const store = useGameStore.getState();
      const players = store.gameState?.players ?? [];
      store.setTeamNameReveal({
        players: players.map((p) => ({ nickname: p.nickname, team: p.team })),
        teamNames: null,
      });
    });

    socket.on('game:state-update', ({ state }) => {
      const store = useGameStore.getState();
      // Update team name reveal when names arrive from the server
      if (
        state.teamNames &&
        store.teamNameReveal &&
        !store.teamNameReveal.teamNames
      ) {
        store.updateTeamNameReveal(state.teamNames);
      }
      store.setGameState(state);
    });

    socket.on('game:cards-dealt', ({ hand }) => {
      useGameStore.getState().setHand(hand);
    });

    socket.on('game:card-played', ({ playerId, card }) => {
      const { myPosition, gameState } = useGameStore.getState();
      const localPlayer = gameState?.players.find(
        (p) => p.position === myPosition
      );
      if (localPlayer?.id === playerId) {
        useGameStore.getState().removeCard(card);
      }
    });

    socket.on('game:trick-won', ({ winnerId }) => {
      const { setTrickWinner, clearTrickWinner } = useGameStore.getState();
      setTrickWinner(winnerId);
      setTimeout(clearTrickWinner, 2000);
    });

    socket.on('game:round-end', ({ roundSummary, effects, scoreHistory }) => {
      useGameStore.getState().setRoundSummary(roundSummary);
      useGameStore.getState().setScoreHistory(scoreHistory);
      if (effects?.length) {
        useGameStore.getState().setRoundEffects(effects);
      }
    });

    socket.on('game:ended', ({ winningTeam, finalScores, scoreHistory }) => {
      const { gameState } = useGameStore.getState();
      useGameStore.getState().setGameEnded({
        winner: winningTeam,
        scores: finalScores,
        scoreHistory,
        teamNames: gameState?.teamNames,
      });
    });

    socket.on('game:summary', ({ summary }) => {
      useGameStore.getState().setGameSummary(summary);
    });

    socket.on('reconnect:success', ({ state, hand, scoreHistory }) => {
      console.log(
        `[game] reconnect:success phase=${state.phase} hand=${hand.length} cards`
      );
      const { setGameState, setHand, revealCards, setScoreHistory } =
        useGameStore.getState();
      setGameState(state);
      setHand(hand);
      setScoreHistory(scoreHistory);
      revealCards();
    });

    socket.on('room:seat-changed', ({ newPosition }) => {
      useGameStore.getState().setMyPosition(newPosition);
    });

    socket.on('room:seats-available', ({ roomId, seats }) => {
      useGameStore.getState().setAvailableSeats(roomId, seats);
    });

    socket.on('room:seat-opened', () => {
      // Informational — the real data comes via game:state-update
    });

    socket.on('reconnect:failed', ({ reason }) => {
      console.warn(`[game] reconnect:failed reason=${reason}`);
      useGameStore.getState().setError(`Reconnection failed: ${reason}`);
      clearSession();
    });

    socket.on('error', ({ code, message }) => {
      console.error(`[game] error code=${code} message=${message}`);
      const { setError } = useGameStore.getState();
      setError(message);
      setTimeout(() => setError(null), 5000);
    });

    return () => {
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('game:started');
      socket.off('game:state-update');
      socket.off('game:cards-dealt');
      socket.off('game:card-played');
      socket.off('game:trick-won');
      socket.off('game:round-end');
      socket.off('game:ended');
      socket.off('game:summary');
      socket.off('room:seat-changed');
      socket.off('room:seats-available');
      socket.off('room:seat-opened');
      socket.off('reconnect:success');
      socket.off('reconnect:failed');
      socket.off('error');
    };
  }, [socket]);

  // Try to reconnect on mount
  useEffect(() => {
    if (!socket || !connected) return;

    // If this is an auto-join tab, clear any inherited session first
    const params = new URLSearchParams(window.location.search);
    const isAutoJoin = params.get('autoName') !== null;

    if (isAutoJoin) {
      clearSession();
      return;
    }

    const session = loadSession();
    if (session) {
      console.log(
        `[game] emitting player:reconnect room=${session.roomId} token=${session.sessionToken.slice(0, 8)}… socket=${socket.id}`
      );
      socket.emit('player:reconnect', {
        sessionToken: session.sessionToken,
        roomId: session.roomId,
      });
    } else {
      console.log('[game] no saved session, skipping reconnect');
    }
  }, [socket, connected]);

  const createRoom = useCallback(
    (nickname: string) => {
      if (!socket) return;
      useGameStore.getState().setNickname(nickname);
      socket.emit('room:create', { nickname });
    },
    [socket]
  );

  const joinRoom = useCallback(
    (roomId: string, nickname: string) => {
      if (!socket) return;
      useGameStore.getState().setNickname(nickname);
      socket.emit('room:join', { roomId, nickname });
    },
    [socket]
  );

  const setReady = useCallback(() => {
    if (!socket) return;
    socket.emit('room:ready');
  }, [socket]);

  const makeBid = useCallback(
    (bid: number, isNil = false, isBlindNil = false) => {
      if (!socket) return;
      socket.emit('game:bid', { bid, isNil, isBlindNil });
    },
    [socket]
  );

  const playCard = useCallback(
    (card: Card) => {
      if (!socket) return;
      socket.emit('game:play-card', { card });
    },
    [socket]
  );

  const leaveRoom = useCallback(() => {
    if (!socket) return;
    socket.emit('room:leave');
    clearSession();
    useGameStore.getState().reset();
  }, [socket]);

  const changeSeat = useCallback(
    (newPosition: Position) => {
      if (!socket) return;
      socket.emit('player:change-seat', { newPosition });
    },
    [socket]
  );

  const openSeat = useCallback(
    (playerId: PlayerId) => {
      if (!socket) return;
      socket.emit('player:open-seat', { playerId });
    },
    [socket]
  );

  const selectSeat = useCallback(
    (roomId: string, position: Position, nickname: string) => {
      if (!socket) return;
      socket.emit('room:select-seat', { roomId, position, nickname });
    },
    [socket]
  );

  // Actions are stable refs — destructure once for the return value
  const {
    clearRoundSummary,
    clearRoundEffects,
    clearTeamNameReveal,
    revealCards,
    reset,
  } = useGameStore.getState();

  return {
    connected,
    roomId,
    myPosition,
    gameState,
    myHand,
    cardsRevealed,
    roundSummary,
    roundEffects,
    scoreHistory,
    gameEnded,
    gameSummary,
    teamNameReveal,
    clearTeamNameReveal,
    error,
    availableSeats,
    seatSelectRoomId,
    clearRoundSummary,
    clearRoundEffects,
    revealCards,
    reset,
    createRoom,
    joinRoom,
    setReady,
    makeBid,
    playCard,
    leaveRoom,
    changeSeat,
    openSeat,
    selectSeat,
  };
}
