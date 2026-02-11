import { useEffect, useCallback } from 'react';
import { useSocket } from '../socket/socket-context';
import { useGameStore, saveSession, loadSession, clearSession } from '../store/game-store';
import type { Card } from '@spades/shared';

export function useGame() {
  const { socket, connected } = useSocket();
  const store = useGameStore();

  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('room:created', ({ roomId, sessionToken }) => {
      store.setSession(roomId, sessionToken, 0);
      saveSession(roomId, sessionToken);
    });

    socket.on('room:joined', ({ roomId, position, sessionToken }) => {
      store.setSession(roomId, sessionToken, position);
      saveSession(roomId, sessionToken);
    });

    socket.on('game:state-update', ({ state }) => {
      store.setGameState(state);
    });

    socket.on('game:cards-dealt', ({ hand }) => {
      store.setHand(hand);
    });

    socket.on('game:trick-won', ({ winnerId }) => {
      store.setTrickWinner(winnerId);
      setTimeout(() => store.clearTrickWinner(), 2000);
    });

    socket.on('game:round-end', ({ scores, roundSummary }) => {
      store.setRoundSummary(roundSummary);
    });

    socket.on('game:ended', ({ winningTeam, finalScores }) => {
      store.setGameEnded({ winner: winningTeam, scores: finalScores });
    });

    socket.on('reconnect:success', ({ state, hand }) => {
      store.setGameState(state);
      store.setHand(hand);
      store.revealCards();
    });

    socket.on('reconnect:failed', ({ reason }) => {
      store.setError(`Reconnection failed: ${reason}`);
      clearSession();
    });

    socket.on('error', ({ message }) => {
      store.setError(message);
      setTimeout(() => store.setError(null), 5000);
    });

    return () => {
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('game:state-update');
      socket.off('game:cards-dealt');
      socket.off('game:trick-won');
      socket.off('game:round-end');
      socket.off('game:ended');
      socket.off('reconnect:success');
      socket.off('reconnect:failed');
      socket.off('error');
    };
  }, [socket]);

  // Try to reconnect on mount
  useEffect(() => {
    if (!socket || !connected) return;

    const session = loadSession();
    if (session) {
      socket.emit('player:reconnect', {
        sessionToken: session.sessionToken,
        roomId: session.roomId
      });
    }
  }, [socket, connected]);

  const createRoom = useCallback((nickname: string) => {
    if (!socket) return;
    store.setNickname(nickname);
    socket.emit('room:create', { nickname });
  }, [socket]);

  const joinRoom = useCallback((roomId: string, nickname: string) => {
    if (!socket) return;
    store.setNickname(nickname);
    socket.emit('room:join', { roomId, nickname });
  }, [socket]);

  const setReady = useCallback(() => {
    if (!socket) return;
    socket.emit('room:ready');
  }, [socket]);

  const makeBid = useCallback((bid: number, isNil = false, isBlindNil = false) => {
    if (!socket) return;
    socket.emit('game:bid', { bid, isNil, isBlindNil });
  }, [socket]);

  const playCard = useCallback((card: Card) => {
    if (!socket) return;
    socket.emit('game:play-card', { card });
    store.removeCard(card);
  }, [socket]);

  const leaveRoom = useCallback(() => {
    if (!socket) return;
    socket.emit('room:leave');
    clearSession();
    store.reset();
  }, [socket]);

  return {
    connected,
    ...store,
    createRoom,
    joinRoom,
    setReady,
    makeBid,
    playCard,
    leaveRoom
  };
}
