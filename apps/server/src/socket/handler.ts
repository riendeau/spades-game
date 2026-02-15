import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Card,
} from '@spades/shared';
import { validatePlay, validateBid } from '@spades/shared';
import { type Server, type Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { hookExecutor } from '../mods/hook-executor.js';
import { roomManager } from '../rooms/room-manager.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function setupSocketHandlers(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

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

  const session = roomManager.createSession(room.id, playerId, socket.id);
  socket.join(room.id);

  socket.emit('room:created', {
    roomId: room.id,
    sessionToken: session.sessionToken,
  });

  socket.emit('room:joined', {
    roomId: room.id,
    position: 0,
    sessionToken: session.sessionToken,
  });

  socket.emit('game:state-update', { state: room.game.toClientState() });
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
    socket.emit('error', {
      code: 'JOIN_FAILED',
      message: result.error || 'Failed to join room',
    });
    return;
  }

  const session = roomManager.createSession(room.id, playerId, socket.id);
  socket.join(room.id);
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
  const state = room.game.toClientState();
  socket.emit('game:state-update', { state });
  socket.to(room.id).emit('game:state-update', { state });
}

function handlePlayerReady(socket: TypedSocket, io: TypedServer): void {
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
        state: room.game.toClientState(),
      });
    }
  } else {
    io.to(room.id).emit('game:state-update', {
      state: room.game.toClientState(),
    });
  }
}

function handlePlayerLeave(socket: TypedSocket, io: TypedServer): void {
  const session = roomManager.getSessionBySocketId(socket.id);
  if (!session) return;

  const room = roomManager.getRoom(session.roomId);
  if (!room) return;

  room.game.removePlayer(session.playerId);
  socket.leave(session.roomId);

  io.to(session.roomId).emit('room:player-left', {
    playerId: session.playerId,
  });
  io.to(session.roomId).emit('game:state-update', {
    state: room.game.toClientState(),
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
    state: room.game.toClientState(),
  });
}

function handlePlayCard(
  socket: TypedSocket,
  io: TypedServer,
  card: Card
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

  // Check for side effects
  if (result.sideEffects) {
    for (const effect of result.sideEffects) {
      if (effect.type === 'TRICK_COMPLETE') {
        io.to(room.id).emit('game:trick-won', {
          winnerId: effect.winnerId,
          trickNumber: effect.trickNumber,
        });
      }

      if (effect.type === 'ROUND_COMPLETE') {
        io.to(room.id).emit('game:round-end', {
          scores: room.game.getState().scores,
          roundSummary: effect.summary,
        });

        // If game not over, start next round after delay
        if (room.game.getState().phase !== 'game-end') {
          setTimeout(() => {
            const nextResult = room.game.startNextRound();
            if (nextResult.valid) {
              // Send hands to each player
              for (const player of room.game.getState().players) {
                const playerSession = Array.from(
                  roomManager.getAllSessions()
                ).find((s) => s.playerId === player.id && s.roomId === room.id);

                if (playerSession?.socketId) {
                  const hand = room.game.getPlayerHand(player.id);
                  io.to(playerSession.socketId).emit('game:cards-dealt', {
                    hand,
                  });
                }
              }

              io.to(room.id).emit('game:state-update', {
                state: room.game.toClientState(),
              });
            }
          }, 3000);
        }
      }

      if (effect.type === 'GAME_COMPLETE') {
        io.to(room.id).emit('game:ended', {
          winningTeam: effect.winner,
          finalScores: room.game.getState().scores,
        });
      }
    }
  }

  io.to(room.id).emit('game:state-update', {
    state: room.game.toClientState(),
  });
}

function handleReconnect(
  socket: TypedSocket,
  io: TypedServer,
  sessionToken: string,
  roomId: string
): void {
  if (!roomManager.isSessionValid(sessionToken)) {
    socket.emit('reconnect:failed', { reason: 'Session expired' });
    return;
  }

  const session = roomManager.getSession(sessionToken);
  if (session?.roomId !== roomId) {
    socket.emit('reconnect:failed', { reason: 'Invalid session' });
    return;
  }

  const room = roomManager.getRoom(roomId);
  if (!room) {
    socket.emit('reconnect:failed', { reason: 'Room no longer exists' });
    return;
  }

  // Update session with new socket
  roomManager.updateSessionSocket(sessionToken, socket.id);
  socket.join(roomId);

  // Reconnect player in game
  room.game.reconnectPlayer(session.playerId);
  roomManager.touchRoom(roomId);

  // Get player's hand
  const hand = room.game.getPlayerHand(session.playerId);

  socket.emit('reconnect:success', {
    state: room.game.toClientState(),
    hand,
  });

  // Notify others
  socket
    .to(roomId)
    .emit('room:player-reconnected', { playerId: session.playerId });
  io.to(roomId).emit('game:state-update', { state: room.game.toClientState() });
}

function handleDisconnect(socket: TypedSocket, io: TypedServer): void {
  const session = roomManager.markSessionDisconnected(socket.id);
  if (!session) return;

  const room = roomManager.getRoom(session.roomId);
  if (!room) return;

  room.game.disconnectPlayer(session.playerId);

  io.to(session.roomId).emit('room:player-disconnected', {
    playerId: session.playerId,
  });
  io.to(session.roomId).emit('game:state-update', {
    state: room.game.toClientState(),
  });

  console.log(`Client disconnected: ${socket.id}, player: ${session.playerId}`);
}
