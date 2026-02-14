import type { Card } from '@spades/shared';
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
  const store = useGameStore();

  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('room:created', ({ roomId, sessionToken }) => {
      console.log(
        'Room created, saving session:',
        sessionToken.substring(0, 8) + '...'
      );
      store.setSession(roomId, sessionToken, 0);
      saveSession(roomId, sessionToken);
    });

    socket.on('room:joined', ({ roomId, position, sessionToken }) => {
      console.log(
        'Room joined, saving session:',
        sessionToken.substring(0, 8) + '...'
      );
      store.setSession(roomId, sessionToken, position);
      saveSession(roomId, sessionToken);
    });

    socket.on('game:state-update', ({ state }) => {
      store.setGameState(state);
    });

    socket.on('game:cards-dealt', ({ hand }) => {
      store.setHand(hand);
    });

    socket.on('game:card-played', ({ card }) => {
      store.removeCard(card);
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
      console.log('Reconnect SUCCESS');
      store.setGameState(state);
      store.setHand(hand);
      store.revealCards();
    });

    socket.on('reconnect:failed', ({ reason }) => {
      console.log('Reconnect FAILED:', reason);
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
      socket.off('game:card-played');
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

    // If this is an auto-join tab, clear any inherited session first
    const params = new URLSearchParams(window.location.search);
    const isAutoJoin = params.get('autoName') !== null;

    if (isAutoJoin) {
      console.log('Auto-join tab detected, clearing inherited session');
      clearSession();
      return;
    }

    const session = loadSession();
    if (session) {
      console.log(
        'Attempting reconnect with session:',
        session.sessionToken.substring(0, 8) + '...'
      );
      socket.emit('player:reconnect', {
        sessionToken: session.sessionToken,
        roomId: session.roomId,
      });
    } else {
      console.log('No session found to reconnect');
    }
  }, [socket, connected]);

  const createRoom = useCallback(
    (nickname: string) => {
      if (!socket) return;
      store.setNickname(nickname);
      socket.emit('room:create', { nickname });
    },
    [socket]
  );

  const joinRoom = useCallback(
    (roomId: string, nickname: string) => {
      if (!socket) return;
      store.setNickname(nickname);
      socket.emit('room:join', { roomId, nickname });
    },
    [socket]
  );

  const setReady = useCallback(() => {
    if (!socket) return;
    console.log(
      'Setting ready, socket connected:',
      socket.connected,
      'socket id:',
      socket.id
    );
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
    leaveRoom,
  };
}
