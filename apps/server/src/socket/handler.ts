import type {
  ClientToServerEvents,
  ServerToClientEvents,
  ClientGameState,
  Card,
  Position,
} from '@spades/shared';
import { validatePlay, validateBid } from '@spades/shared';
import type { Request } from 'express';
import { type Server, type Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  generateTeamNames,
  generateGameSummary,
} from '../ai/claude-service.js';
import { insertGameResult } from '../db/game-results.js';
import { roomManager, type Room } from '../rooms/room-manager.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

function getUserId(socket: TypedSocket): string | null {
  return (socket.request as Request).user?.id ?? null;
}

function getClientState(room: Room): ClientGameState {
  const state = room.game.toClientState();
  const abandonedIds = roomManager.getAbandonedPlayerIds(room.id);

  if (abandonedIds.length > 0) {
    return {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        openForReplacement: abandonedIds.includes(p.id) ? true : undefined,
      })),
    };
  }

  return state;
}

export function setupSocketHandlers(io: TypedServer): void {
  // When a session expires for a player in an active game, broadcast the
  // updated state so remaining clients see the seat as "open".
  roomManager.onSessionAbandoned = (roomId: string) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      io.to(roomId).emit('game:state-update', { state: getClientState(room) });
    }
  };

  io.on('connection', (socket: TypedSocket) => {
    console.log(
      `[socket] connected id=${socket.id} transport=${socket.conn.transport.name}`
    );

    socket.on('room:create', ({ nickname }) => {
      handleCreateRoom(socket, nickname);
    });

    socket.on('room:join', ({ roomId, nickname }) => {
      handleJoinRoom(socket, roomId, nickname);
    });

    socket.on('room:ready', () => {
      handlePlayerReady(socket, io);
    });

    socket.on('room:leave', () => {
      handlePlayerLeave(socket, io);
    });

    socket.on('game:bid', ({ bid, isNil, isBlindNil }) => {
      handleBid(socket, io, bid, isNil || false, isBlindNil || false);
    });

    socket.on('game:play-card', ({ card }) => {
      handlePlayCard(socket, io, card);
    });

    socket.on('player:reconnect', ({ sessionToken, roomId }) => {
      handleReconnect(socket, io, sessionToken, roomId);
    });

    socket.on('player:change-seat', ({ newPosition }) => {
      handleChangeSeat(socket, io, newPosition);
    });

    socket.on('player:open-seat', ({ playerId }) => {
      handleOpenSeat(socket, io, playerId);
    });

    socket.on('room:select-seat', ({ roomId, position, nickname }) => {
      handleSelectSeat(socket, io, roomId, position, nickname);
    });

    socket.on('disconnect', () => {
      handleDisconnect(socket, io);
    });
  });
}

function handleCreateRoom(socket: TypedSocket, nickname: string): void {
  const room = roomManager.createRoom();
  const playerId = uuidv4();

  const result = room.game.addPlayer(playerId, nickname);
  if (!result.valid) {
    socket.emit('error', {
      code: 'CREATE_FAILED',
      message: result.error || 'Failed to create room',
    });
    return;
  }

  const session = roomManager.createSession(
    room.id,
    playerId,
    socket.id,
    getUserId(socket)
  );
  void socket.join(room.id);

  socket.emit('room:created', {
    roomId: room.id,
    sessionToken: session.sessionToken,
  });

  socket.emit('room:joined', {
    roomId: room.id,
    position: 0,
    sessionToken: session.sessionToken,
  });

  socket.emit('game:state-update', { state: getClientState(room) });
}

function handleJoinRoom(
  socket: TypedSocket,
  roomId: string,
  nickname: string
): void {
  const room = roomManager.getRoom(roomId);
  if (!room) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
    return;
  }

  const playerId = uuidv4();
  const result = room.game.addPlayer(playerId, nickname);

  if (!result.valid) {
    // If game already started, check for open seats
    if (result.error === 'Game already started') {
      const abandonedIds = roomManager.getAbandonedPlayerIds(room.id);
      if (abandonedIds.length > 0) {
        const seats = abandonedIds.map((id) => {
          const player = room.game.getState().players.find((p) => p.id === id)!;
          return {
            position: player.position,
            team: player.team,
            previousNickname: player.nickname,
          };
        });
        void socket.join(room.id);
        socket.emit('room:seats-available', { roomId: room.id, seats });
        return;
      }
    }

    socket.emit('error', {
      code: 'JOIN_FAILED',
      message: result.error || 'Failed to join room',
    });
    return;
  }

  const session = roomManager.createSession(
    room.id,
    playerId,
    socket.id,
    getUserId(socket)
  );
  void socket.join(room.id);
  roomManager.touchRoom(room.id);

  const player = room.game.getState().players.find((p) => p.id === playerId);

  socket.emit('room:joined', {
    roomId: room.id,
    position: player!.position,
    sessionToken: session.sessionToken,
  });

  // Notify others
  socket.to(room.id).emit('room:player-joined', {
    playerId,
    nickname,
    position: player!.position,
  });

  // Send state to all
  const state = getClientState(room);
  socket.emit('game:state-update', { state });
  socket.to(room.id).emit('game:state-update', { state });
}

function handlePlayerReady(socket: TypedSocket, io: TypedServer): void {
  const session = roomManager.getSessionBySocketId(socket.id);
  if (!session) {
    console.error(
      `[socket] SESSION_NOT_FOUND in handlePlayerReady socket=${socket.id}`
    );
    socket.emit('error', {
      code: 'SESSION_NOT_FOUND',
      message: 'Session not found',
    });
    return;
  }

  const room = roomManager.getRoom(session.roomId);
  if (!room) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
    return;
  }

  const result = room.game.setPlayerReady(session.playerId);
  if (!result.valid) {
    socket.emit('error', {
      code: 'READY_FAILED',
      message: result.error || 'Failed to ready',
    });
    return;
  }

  roomManager.touchRoom(room.id);

  // Notify all players
  io.to(room.id).emit('room:player-ready', { playerId: session.playerId });

  const state = room.game.getState();

  // If all ready, start the game
  if (state.phase === 'ready') {
    const startResult = room.game.startGame();
    if (startResult.valid) {
      io.to(room.id).emit('game:started');

      // Send hands to each player
      for (const player of state.players) {
        const playerSession = Array.from(roomManager.getAllSessions()).find(
          (s) => s.playerId === player.id && s.roomId === room.id
        );

        if (playerSession?.socketId) {
          const hand = room.game.getPlayerHand(player.id);
          io.to(playerSession.socketId).emit('game:cards-dealt', { hand });
        }
      }

      // Update state
      io.to(room.id).emit('game:state-update', {
        state: getClientState(room),
      });

      // Generate AI team names (fire-and-forget)
      void generateTeamNamesForRoom(room, io);
    }
  } else {
    io.to(room.id).emit('game:state-update', {
      state: getClientState(room),
    });
  }
}

function handlePlayerLeave(socket: TypedSocket, io: TypedServer): void {
  const session = roomManager.getSessionBySocketId(socket.id);
  if (!session) {
    console.warn(
      `[socket] handlePlayerLeave: no session for socket=${socket.id}`
    );
    return;
  }

  console.log(
    `[socket] player leaving token=${session.sessionToken.slice(0, 8)}… player=${session.playerId.slice(0, 8)}… room=${session.roomId}`
  );

  const room = roomManager.getRoom(session.roomId);
  if (!room) return;

  room.game.removePlayer(session.playerId);
  void socket.leave(session.roomId);

  io.to(session.roomId).emit('room:player-left', {
    playerId: session.playerId,
  });
  io.to(session.roomId).emit('game:state-update', {
    state: getClientState(room),
  });
}

function handleBid(
  socket: TypedSocket,
  io: TypedServer,
  bid: number,
  isNil: boolean,
  isBlindNil: boolean
): void {
  const session = roomManager.getSessionBySocketId(socket.id);
  if (!session) {
    console.error(
      `[socket] SESSION_NOT_FOUND in handleBid socket=${socket.id}`
    );
    socket.emit('error', {
      code: 'SESSION_NOT_FOUND',
      message: 'Session not found',
    });
    return;
  }

  const room = roomManager.getRoom(session.roomId);
  if (!room) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
    return;
  }

  // Validate bid
  const validation = validateBid(
    room.game.getState(),
    session.playerId,
    bid,
    isNil,
    isBlindNil,
    room.game.getConfig()
  );

  if (!validation.valid) {
    socket.emit('error', {
      code: 'INVALID_BID',
      message: validation.errorMessage || 'Invalid bid',
    });
    return;
  }

  const result = room.game.makeBid(session.playerId, bid, isNil, isBlindNil);
  if (!result.valid) {
    socket.emit('error', {
      code: 'BID_FAILED',
      message: result.error || 'Bid failed',
    });
    return;
  }

  roomManager.touchRoom(room.id);

  io.to(room.id).emit('game:bid-made', {
    playerId: session.playerId,
    bid,
    isNil,
    isBlindNil,
  });

  io.to(room.id).emit('game:state-update', {
    state: getClientState(room),
  });
}

function handlePlayCard(
  socket: TypedSocket,
  io: TypedServer,
  card: Card
): void {
  const session = roomManager.getSessionBySocketId(socket.id);
  if (!session) {
    console.error(
      `[socket] SESSION_NOT_FOUND in handlePlayCard socket=${socket.id}`
    );
    socket.emit('error', {
      code: 'SESSION_NOT_FOUND',
      message: 'Session not found',
    });
    return;
  }

  const room = roomManager.getRoom(session.roomId);
  if (!room) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
    return;
  }

  // Validate play
  const hand = room.game.getPlayerHand(session.playerId);
  const validation = validatePlay(
    room.game.getState(),
    session.playerId,
    card,
    hand
  );

  if (!validation.valid) {
    socket.emit('error', {
      code: 'INVALID_PLAY',
      message: validation.errorMessage || 'Invalid play',
    });
    return;
  }

  const result = room.game.playCard(session.playerId, card);
  if (!result.valid) {
    socket.emit('error', {
      code: 'PLAY_FAILED',
      message: result.error || 'Play failed',
    });
    return;
  }

  roomManager.touchRoom(room.id);

  io.to(room.id).emit('game:card-played', {
    playerId: session.playerId,
    card,
  });

  const trickComplete = result.sideEffects?.find(
    (e) => e.type === 'TRICK_COMPLETE'
  );

  if (trickComplete) {
    io.to(room.id).emit('game:trick-won', {
      winnerId: trickComplete.winnerId,
      trickNumber: trickComplete.trickNumber,
    });
  }

  // Broadcast state with the trick-end phase — all 4 cards are visible in
  // currentTrick.plays. If the trick is not complete this is the normal update.
  io.to(room.id).emit('game:state-update', {
    state: getClientState(room),
  });

  if (trickComplete) {
    // After a short delay so players can see all 4 cards, collect the trick
    // and process any round/game-end side effects.
    setTimeout(() => {
      const collectResult = room.game.collectTrick();

      for (const effect of collectResult.sideEffects ?? []) {
        if (effect.type === 'ROUND_COMPLETE') {
          const modEffects = room.game.getRoundEffects();
          io.to(room.id).emit('game:round-end', {
            scores: room.game.getState().scores,
            roundSummary: effect.summary,
            effects: modEffects.length > 0 ? modEffects : undefined,
            scoreHistory: room.game.getScoreHistory(),
          });

          // If game not over, start next round after an additional delay
          if (room.game.getState().phase !== 'game-end') {
            setTimeout(() => {
              const nextResult = room.game.startNextRound();
              if (nextResult.valid) {
                for (const player of room.game.getState().players) {
                  const playerSession = Array.from(
                    roomManager.getAllSessions()
                  ).find(
                    (s) => s.playerId === player.id && s.roomId === room.id
                  );

                  if (playerSession?.socketId) {
                    const hand = room.game.getPlayerHand(player.id);
                    io.to(playerSession.socketId).emit('game:cards-dealt', {
                      hand,
                    });
                  }
                }

                io.to(room.id).emit('game:state-update', {
                  state: getClientState(room),
                });
              }
            }, 3000);
          }
        }

        if (effect.type === 'GAME_COMPLETE') {
          io.to(room.id).emit('game:ended', {
            winningTeam: effect.winner,
            finalScores: room.game.getState().scores,
            scoreHistory: room.game.getScoreHistory(),
          });

          // Record game result (fire-and-forget)
          void recordGameResult(room);

          // Generate AI game summary (fire-and-forget)
          void generateGameSummaryForRoom(room, effect.winner, io);
        }
      }

      // Broadcast the cleared trick (or new round state)
      io.to(room.id).emit('game:state-update', {
        state: getClientState(room),
      });
    }, 1500);
  }
}

function handleReconnect(
  socket: TypedSocket,
  io: TypedServer,
  sessionToken: string,
  roomId: string
): void {
  console.log(
    `[reconnect] attempt token=${sessionToken.slice(0, 8)}… room=${roomId} socket=${socket.id}`
  );

  if (!roomManager.isSessionValid(sessionToken)) {
    console.warn(
      `[reconnect] FAILED: session invalid/expired token=${sessionToken.slice(0, 8)}…`
    );
    socket.emit('reconnect:failed', { reason: 'Session expired' });
    return;
  }

  const session = roomManager.getSession(sessionToken);
  if (session?.roomId !== roomId) {
    console.warn(
      `[reconnect] FAILED: room mismatch token=${sessionToken.slice(0, 8)}… expected=${roomId} actual=${session?.roomId ?? 'no-session'}`
    );
    socket.emit('reconnect:failed', { reason: 'Invalid session' });
    return;
  }

  const room = roomManager.getRoom(roomId);
  if (!room) {
    console.warn(`[reconnect] FAILED: room not found room=${roomId}`);
    socket.emit('reconnect:failed', { reason: 'Room no longer exists' });
    return;
  }

  // Update session with new socket
  roomManager.updateSessionSocket(sessionToken, socket.id);
  void socket.join(roomId);

  // Reconnect player in game
  room.game.reconnectPlayer(session.playerId);
  roomManager.touchRoom(roomId);

  // Get player's hand
  const hand = room.game.getPlayerHand(session.playerId);

  console.log(
    `[reconnect] SUCCESS token=${sessionToken.slice(0, 8)}… player=${session.playerId.slice(0, 8)}… room=${roomId} hand=${hand.length} cards`
  );

  socket.emit('reconnect:success', {
    state: getClientState(room),
    hand,
    scoreHistory: room.game.getScoreHistory(),
  });

  // Notify others
  socket
    .to(roomId)
    .emit('room:player-reconnected', { playerId: session.playerId });
  io.to(roomId).emit('game:state-update', { state: getClientState(room) });
}

function handleChangeSeat(
  socket: TypedSocket,
  io: TypedServer,
  newPosition: Position
): void {
  const session = roomManager.getSessionBySocketId(socket.id);
  if (!session) {
    console.error(
      `[socket] SESSION_NOT_FOUND in handleChangeSeat socket=${socket.id}`
    );
    socket.emit('error', {
      code: 'SESSION_NOT_FOUND',
      message: 'Session not found',
    });
    return;
  }

  const room = roomManager.getRoom(session.roomId);
  if (!room) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
    return;
  }

  const result = room.game.movePlayerToSeat(session.playerId, newPosition);
  if (!result.valid) {
    socket.emit('error', {
      code: 'SEAT_CHANGE_FAILED',
      message: result.error || 'Failed to change seat',
    });
    return;
  }

  roomManager.touchRoom(room.id);

  socket.emit('room:seat-changed', { newPosition });
  io.to(room.id).emit('game:state-update', {
    state: getClientState(room),
  });
}

function handleOpenSeat(
  socket: TypedSocket,
  io: TypedServer,
  targetPlayerId: string
): void {
  const session = roomManager.getSessionBySocketId(socket.id);
  if (!session) {
    socket.emit('error', {
      code: 'SESSION_NOT_FOUND',
      message: 'Session not found',
    });
    return;
  }

  const room = roomManager.getRoom(session.roomId);
  if (!room) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
    return;
  }

  const targetPlayer = room.game
    .getState()
    .players.find((p) => p.id === targetPlayerId);
  if (!targetPlayer) {
    socket.emit('error', {
      code: 'OPEN_SEAT_FAILED',
      message: 'Player not found',
    });
    return;
  }

  if (targetPlayer.connected) {
    socket.emit('error', {
      code: 'OPEN_SEAT_FAILED',
      message: 'Player is still connected',
    });
    return;
  }

  // Delete their sessions so they can't reconnect
  roomManager.deleteSessionsForPlayer(targetPlayerId);

  console.log(
    `[seat] opened seat for player=${targetPlayerId.slice(0, 8)}… position=${targetPlayer.position} room=${room.id}`
  );

  io.to(room.id).emit('room:seat-opened', {
    playerId: targetPlayerId,
    position: targetPlayer.position,
  });
  io.to(room.id).emit('game:state-update', { state: getClientState(room) });
}

function handleSelectSeat(
  socket: TypedSocket,
  io: TypedServer,
  roomId: string,
  position: Position,
  nickname: string
): void {
  const room = roomManager.getRoom(roomId);
  if (!room) {
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
    return;
  }

  // Find the player at this position
  const targetPlayer = room.game
    .getState()
    .players.find((p) => p.position === position);
  if (!targetPlayer) {
    socket.emit('error', {
      code: 'SEAT_TAKEN',
      message: 'No player at that position',
    });
    return;
  }

  // Verify the seat is actually open (player disconnected + no valid session)
  const abandonedIds = roomManager.getAbandonedPlayerIds(roomId);
  if (!abandonedIds.includes(targetPlayer.id)) {
    socket.emit('error', {
      code: 'SEAT_TAKEN',
      message: 'Seat is no longer available',
    });
    return;
  }

  // Replace the player in the game state
  const result = room.game.replacePlayer(targetPlayer.id, nickname);
  if (!result.valid) {
    socket.emit('error', {
      code: 'REPLACE_FAILED',
      message: result.error || 'Failed to take seat',
    });
    return;
  }

  // Create a new session for the new player, reusing the old playerId
  const newSession = roomManager.createSession(
    room.id,
    targetPlayer.id,
    socket.id,
    getUserId(socket)
  );
  void socket.join(room.id);
  roomManager.touchRoom(room.id);

  console.log(
    `[seat] player replaced id=${targetPlayer.id.slice(0, 8)}… position=${position} newNickname=${nickname} room=${room.id}`
  );

  // Send the new player their data
  socket.emit('room:joined', {
    roomId: room.id,
    position,
    sessionToken: newSession.sessionToken,
  });

  const hand = room.game.getPlayerHand(targetPlayer.id);
  socket.emit('game:cards-dealt', { hand });

  const clientState = getClientState(room);
  socket.emit('game:state-update', { state: clientState });

  // Auto-reveal cards since they're joining mid-game
  // (the client will handle this on the room:joined event when cards exist)

  // Broadcast to rest of room
  socket.to(room.id).emit('game:state-update', { state: clientState });
}

async function recordGameResult(room: Room): Promise<void> {
  try {
    const state = room.game.getState();
    const userIds = roomManager.getUserIdsByPlayerId(room.id);

    // Map positions to user IDs:
    // position 0 → team1_player1, position 2 → team1_player2
    // position 1 → team2_player1, position 3 → team2_player2
    const playerByPos = new Map(state.players.map((p) => [p.position, p.id]));

    const roundBids = room.game.getRoundBids().map((rb) => ({
      roundNumber: rb.roundNumber,
      playerId: userIds.get(rb.playerId) ?? null,
      playerPosition: rb.position,
      bid: rb.bid,
      isNil: rb.isNil,
      isBlindNil: rb.isBlindNil,
      tricksWon: rb.tricksWon,
    }));

    await insertGameResult({
      roomId: room.id,
      team1Score: state.scores.team1.score,
      team2Score: state.scores.team2.score,
      roundsPlayed: state.currentRound?.roundNumber ?? 1,
      team1Player1Id: userIds.get(playerByPos.get(0)!) ?? null,
      team1Player2Id: userIds.get(playerByPos.get(2)!) ?? null,
      team2Player1Id: userIds.get(playerByPos.get(1)!) ?? null,
      team2Player2Id: userIds.get(playerByPos.get(3)!) ?? null,
      roundBids,
    });

    console.log(
      `[game-result] recorded room=${room.id} score=${state.scores.team1.score}-${state.scores.team2.score} bids=${roundBids.length}`
    );
  } catch (err) {
    console.error('[game-result] failed to record:', err);
  }
}

async function generateTeamNamesForRoom(
  room: Room,
  io: TypedServer
): Promise<void> {
  try {
    const players = room.game.getState().players;
    const team1Players = players
      .filter((p) => p.team === 'team1')
      .map((p) => p.nickname);
    const team2Players = players
      .filter((p) => p.team === 'team2')
      .map((p) => p.nickname);

    const names = await generateTeamNames({
      team1: team1Players,
      team2: team2Players,
    });

    if (names) {
      room.game.setTeamNames(names);
      io.to(room.id).emit('game:state-update', {
        state: getClientState(room),
      });
    }
  } catch (err) {
    console.warn('[ai] generateTeamNamesForRoom failed:', err);
  }
}

async function generateGameSummaryForRoom(
  room: Room,
  winningTeam: 'team1' | 'team2',
  io: TypedServer
): Promise<void> {
  try {
    const state = room.game.getState();
    const teamNames = room.game.getTeamNames() ?? {
      team1: 'Team 1',
      team2: 'Team 2',
    };

    const summary = await generateGameSummary({
      winningTeam,
      finalScores: {
        team1: {
          score: state.scores.team1.score,
          bags: state.scores.team1.bags,
        },
        team2: {
          score: state.scores.team2.score,
          bags: state.scores.team2.bags,
        },
      },
      scoreHistory: room.game.getScoreHistory(),
      roundBids: room.game.getRoundBids().map((rb) => ({
        roundNumber: rb.roundNumber,
        position: rb.position,
        bid: rb.bid,
        isNil: rb.isNil,
        isBlindNil: rb.isBlindNil,
        tricksWon: rb.tricksWon,
      })),
      players: state.players.map((p) => ({
        nickname: p.nickname,
        position: p.position,
        team: p.team,
      })),
      teamNames,
    });

    if (summary) {
      io.to(room.id).emit('game:summary', { summary });
    }
  } catch (err) {
    console.warn('[ai] generateGameSummaryForRoom failed:', err);
  }
}

function handleDisconnect(socket: TypedSocket, io: TypedServer): void {
  const session = roomManager.markSessionDisconnected(socket.id);
  if (!session) {
    // Normal — socket connected but user never joined a room
    return;
  }

  console.log(
    `[socket] disconnected id=${socket.id} token=${session.sessionToken.slice(0, 8)}… player=${session.playerId.slice(0, 8)}… room=${session.roomId}`
  );

  const room = roomManager.getRoom(session.roomId);
  if (!room) return;

  room.game.disconnectPlayer(session.playerId);

  io.to(session.roomId).emit('room:player-disconnected', {
    playerId: session.playerId,
  });
  io.to(session.roomId).emit('game:state-update', {
    state: getClientState(room),
  });
}
