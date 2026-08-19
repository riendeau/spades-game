import type { Card, PlayerId, Position } from '@spades/shared';
import { useEffect, useCallback, useRef } from 'react';
import { emitDebug } from '../socket/debug';
import { useSocket } from '../socket/socket-context';
import {
  useGameStore,
  saveSession,
  loadSession,
  clearSession,
  leaveGameSession,
  loadViewedRound,
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
  const kickedForIdle = useGameStore((s) => s.kickedForIdle);
  const restoringSession = useGameStore((s) => s.restoringSession);

  // Guard against duplicate game:play-card emissions during server round-trip.
  // Between emitting and receiving the server's response, the React component
  // hasn't re-rendered so the card button is still enabled and clickable.
  const playPendingRef = useRef(false);

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
      store.setSession(roomId, sessionToken, position);
      store.clearAvailableSeats();
      saveSession(roomId, sessionToken);
      // Mid-game replacement reveal is driven by `autoReveal` on the
      // following `game:cards-dealt` event — see that handler above.
    });

    socket.on('game:started', () => {
      const store = useGameStore.getState();
      const players = store.gameState?.players ?? [];
      store.setTeamNameReveal({
        players: players.map((p) => ({ nickname: p.nickname, team: p.team })),
        teamNames: null,
      });
    });

    socket.on('game:team-names', (teamNames) => {
      const store = useGameStore.getState();
      if (store.teamNameReveal && !store.teamNameReveal.teamNames) {
        store.updateTeamNameReveal(teamNames);
      }
    });

    socket.on('game:state-update', ({ state }) => {
      useGameStore.getState().setGameState(state);
    });

    socket.on('game:cards-dealt', ({ hand, autoReveal }) => {
      const store = useGameStore.getState();
      console.log(
        `[game] cards-dealt hand=${hand.length} autoReveal=${autoReveal === true}`
      );
      store.setHand(hand);
      // setHand resets cardsRevealed to false; re-set it atomically in the
      // same handler when the server has told us to skip the See Cards step
      // (mid-game seat replacement past the bidding phase).
      if (autoReveal) {
        store.revealCards();
      }
    });

    socket.on('game:card-played', ({ playerId, card }) => {
      const { myPosition, gameState } = useGameStore.getState();
      const localPlayer = gameState?.players.find(
        (p) => p.position === myPosition
      );
      if (localPlayer?.id === playerId) {
        playPendingRef.current = false;
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

    socket.on(
      'reconnect:success',
      ({ roomId, position, state, hand, autoReveal, scoreHistory }) => {
        console.log(
          `[game] reconnect:success room=${roomId} position=${position} phase=${state.phase} hand=${hand.length} cards autoReveal=${autoReveal === true}`
        );
        const store = useGameStore.getState();
        const {
          setSession,
          setGameState,
          setHand,
          revealCards,
          setScoreHistory,
          clearRestoringSession,
        } = store;
        // A full page reload wipes the in-memory store, and `room:joined` never
        // fires again — without this the app would sit on the lobby screen
        // (App.tsx gates the game render on roomId) despite the server having
        // reattached the seat. The token is whatever we just reconnected with:
        // the saved session on a reload, the store's copy on a socket blip.
        const sessionToken =
          loadSession()?.sessionToken ?? store.sessionToken ?? '';
        setSession(roomId, sessionToken, position);
        // Refresh the saved session's timestamp — it has just been proven valid
        // by the server, so restart its 30-minute client-side expiry.
        saveSession(roomId, sessionToken);
        clearRestoringSession();
        setGameState(state);
        setHand(hand);
        setScoreHistory(scoreHistory);
        // setHand resets cardsRevealed; only re-reveal when the server says the
        // seat has no See Cards / Bid Blind Nil decision left this round —
        // an unconditional reveal here would rob Bid Blind Nil after a
        // mid-bidding reconnect. Mirrors the game:cards-dealt handler above.
        if (autoReveal) {
          revealCards();
        }
        // A reconnect resyncs full state from the server; any play that was
        // in flight when we dropped is now moot. Clear the guard so the
        // resynced hand is playable.
        playPendingRef.current = false;
      }
    );

    socket.on('room:seat-changed', ({ newPosition }) => {
      useGameStore.getState().setMyPosition(newPosition);
    });

    socket.on('room:seats-available', ({ roomId, seats }) => {
      useGameStore.getState().setAvailableSeats(roomId, seats);
    });

    socket.on('room:seat-opened', () => {
      // Informational — the real data comes via game:state-update
    });

    socket.on('player:kicked-for-idle', () => {
      useGameStore.getState().setKickedForIdle();
      clearSession();
      // Disconnect from client side to prevent auto-reconnect attempts
      socket.disconnect();
    });

    socket.on('reconnect:failed', ({ reason }) => {
      console.warn(`[game] reconnect:failed reason=${reason}`);
      const store = useGameStore.getState();
      store.setError(`Reconnection failed: ${reason}`);
      store.clearRestoringSession();
      clearSession();
    });

    socket.on('error', ({ code, message }) => {
      console.error(`[game] error code=${code} message=${message}`);
      // Any server error means an in-flight play (if there was one) did not
      // complete. INVALID_PLAY / PLAY_FAILED are the expected play-rejection
      // codes, but clearing the guard unconditionally prevents an unrelated
      // error from leaving it stuck `true` and silently locking the player
      // out of playing for the rest of the game.
      playPendingRef.current = false;
      const { setError } = useGameStore.getState();
      setError(message);
      setTimeout(() => setError(null), 5000);
    });

    return () => {
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('game:started');
      socket.off('game:team-names');
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
      socket.off('player:kicked-for-idle');
      socket.off('reconnect:success');
      socket.off('reconnect:failed');
      socket.off('error');
    };
  }, [socket]);

  // Emit player:reconnect on every successful (re)connection.
  // Bound directly to socket.io's 'connect' event — not gated by the React
  // `connected` flag — so auto-reconnects after a network blip always trigger
  // a reconnect attempt. The previous useEffect([connected]) variant could
  // silently skip the emit if a fast disconnect/connect cycle didn't produce
  // a clean false→true transition in React state.
  useEffect(() => {
    if (!socket) return;

    const params = new URLSearchParams(window.location.search);
    const isAutoJoin = params.get('autoName') !== null;
    if (isAutoJoin) {
      clearSession();
      useGameStore.getState().clearRestoringSession();
      emitDebug(socket, 'reconnect-skip', 'auto-join');
      return;
    }

    // Safety net for the "Rejoining…" screen: every handleReconnect path answers
    // with reconnect:success or reconnect:failed, but a malformed payload would
    // come back as a generic `error` instead. Don't strand the player there.
    const restoreTimeout = setTimeout(() => {
      useGameStore.getState().clearRestoringSession();
    }, 10_000);

    const emitReconnect = () => {
      const session = loadSession();
      if (session) {
        // Re-assert the See Cards decision. The server ignores it unless it
        // names the round actually in progress, and only ever uses it to set
        // hasViewedCards — never to clear it — so a stale or absent value
        // degrades to the server's own record.
        const viewedRound = loadViewedRound(session.roomId);
        console.log(
          `[game] emitting player:reconnect room=${session.roomId} token=${session.sessionToken.slice(0, 8)}… viewedRound=${viewedRound ?? '-'} socket=${socket.id}`
        );
        emitDebug(socket, 'reconnect-emit');
        socket.emit('player:reconnect', {
          sessionToken: session.sessionToken,
          roomId: session.roomId,
          ...(viewedRound !== null && { viewedRound }),
        });
      } else {
        console.log('[game] no saved session, skipping reconnect');
        // Nothing to reattach — release the "Rejoining…" screen immediately.
        useGameStore.getState().clearRestoringSession();
        emitDebug(socket, 'reconnect-skip', 'no-saved-session');
      }
    };

    socket.on('connect', emitReconnect);
    // Handle the case where the socket is already connected by the time this
    // effect runs (the 'connect' event would have already fired).
    if (socket.connected) emitReconnect();

    return () => {
      clearTimeout(restoreTimeout);
      socket.off('connect', emitReconnect);
    };
  }, [socket]);

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
      if (!socket || playPendingRef.current) return;
      playPendingRef.current = true;
      socket.emit('game:play-card', { card });
    },
    [socket]
  );

  const leaveRoom = useCallback(() => {
    if (!socket) return;
    socket.emit('room:leave');
    leaveGameSession();
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

  const kickIdle = useCallback(
    (playerId: PlayerId) => {
      if (!socket) return;
      socket.emit('player:kick-idle', { playerId });
    },
    [socket]
  );

  // Actions are stable refs — destructure once for the return value
  const { clearRoundSummary, clearRoundEffects, clearTeamNameReveal } =
    useGameStore.getState();

  // Reveal locally AND notify the server so it can auto-reveal on a future
  // Replace into this seat if the player disconnects after clicking See
  // Cards but before bidding. The store action persists the round for the
  // reconnect re-assertion; the emit is the only piece that belongs up here.
  const revealCards = useCallback(() => {
    useGameStore.getState().revealCards();
    socket?.emit('game:see-cards');
  }, [socket]);

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
    createRoom,
    joinRoom,
    setReady,
    makeBid,
    playCard,
    leaveRoom,
    changeSeat,
    openSeat,
    selectSeat,
    kickIdle,
    kickedForIdle,
    restoringSession,
  };
}
