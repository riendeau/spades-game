import type { Card, Position } from '@spades/shared';
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
  const gameEnded = useGameStore((s) => s.gameEnded);
  const error = useGameStore((s) => s.error);

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
      useGameStore.getState().setSession(roomId, sessionToken, position);
      saveSession(roomId, sessionToken);
    });

    socket.on('game:state-update', ({ state }) => {
      useGameStore.getState().setGameState(state);
    });

    socket.on('game:cards-dealt', ({ hand }) => {
      useGameStore.getState().setHand(hand);
    });

    socket.on('game:card-played', ({ card }) => {
      useGameStore.getState().removeCard(card);
    });

    socket.on('game:trick-won', ({ winnerId }) => {
      const { setTrickWinner, clearTrickWinner } = useGameStore.getState();
      setTrickWinner(winnerId);
      setTimeout(clearTrickWinner, 2000);
    });

    socket.on('game:round-end', ({ roundSummary }) => {
      useGameStore.getState().setRoundSummary(roundSummary);
    });

    socket.on('game:ended', ({ winningTeam, finalScores }) => {
      useGameStore
        .getState()
        .setGameEnded({ winner: winningTeam, scores: finalScores });
    });

    socket.on('reconnect:success', ({ state, hand }) => {
      console.log(
        `[game] reconnect:success phase=${state.phase} hand=${hand.length} cards`
      );
      const { setGameState, setHand, revealCards } = useGameStore.getState();
      setGameState(state);
      setHand(hand);
      revealCards();
    });

    socket.on('room:seat-changed', ({ newPosition }) => {
      useGameStore.getState().setMyPosition(newPosition);
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
      socket.off('game:state-update');
      socket.off('game:cards-dealt');
      socket.off('game:card-played');
      socket.off('game:trick-won');
      socket.off('game:round-end');
      socket.off('game:ended');
      socket.off('room:seat-changed');
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

  // Actions are stable refs — destructure once for the return value
  const { clearRoundSummary, revealCards, reset } = useGameStore.getState();

  return {
    connected,
    roomId,
    myPosition,
    gameState,
    myHand,
    cardsRevealed,
    roundSummary,
    gameEnded,
    error,
    clearRoundSummary,
    revealCards,
    reset,
    createRoom,
    joinRoom,
    setReady,
    makeBid,
    playCard,
    leaveRoom,
    changeSeat,
  };
}
