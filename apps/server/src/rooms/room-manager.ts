import { createInitialGameState, DEFAULT_GAME_CONFIG } from '@spades/shared';
import { v4 as uuidv4 } from 'uuid';
import { GameInstance } from '../game/game-instance.js';
import { hookExecutor } from '../mods/hook-executor.js';

const ROOM_ID_LENGTH = 6;
const ROOM_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const DISCONNECT_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

export interface PlayerSession {
  sessionToken: string;
  playerId: string;
  roomId: string;
  socketId: string | null;
  disconnectedAt: number | null;
}

export interface Room {
  id: string;
  game: GameInstance;
  createdAt: number;
  lastActivity: number;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private sessions = new Map<string, PlayerSession>();
  private socketToSession = new Map<string, string>();

  constructor() {
    // Cleanup expired rooms periodically
    setInterval(() => this.cleanup(), 60000);
  }

  generateRoomId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id: string;
    do {
      id = Array.from(
        { length: ROOM_ID_LENGTH },
        () => chars[Math.floor(Math.random() * chars.length)]
      ).join('');
    } while (this.rooms.has(id));
    return id;
  }

  createRoom(): Room {
    const roomId = this.generateRoomId();
    const gameState = createInitialGameState(roomId);

    // Apply mod-based config modifications
    const modifiedConfig = hookExecutor.modifyConfig(DEFAULT_GAME_CONFIG);

    const game = new GameInstance(gameState, modifiedConfig);

    const room: Room = {
      id: roomId,
      game,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  createSession(
    roomId: string,
    playerId: string,
    socketId: string
  ): PlayerSession {
    const sessionToken = uuidv4();
    const session: PlayerSession = {
      sessionToken,
      playerId,
      roomId,
      socketId,
      disconnectedAt: null,
    };

    this.sessions.set(sessionToken, session);
    this.socketToSession.set(socketId, sessionToken);

    console.log(
      `[session] created token=${sessionToken.slice(0, 8)}… player=${playerId.slice(0, 8)}… room=${roomId} socket=${socketId} (sessions=${this.sessions.size} socketMap=${this.socketToSession.size})`
    );

    return session;
  }

  getSession(sessionToken: string): PlayerSession | undefined {
    return this.sessions.get(sessionToken);
  }

  getSessionBySocketId(socketId: string): PlayerSession | undefined {
    const token = this.socketToSession.get(socketId);
    if (!token) {
      console.warn(
        `[session] lookup FAILED socket=${socketId} — not in socketToSession map (socketMap=${this.socketToSession.size} sessions=${this.sessions.size})`
      );
      return undefined;
    }
    const session = this.sessions.get(token);
    if (!session) {
      console.error(
        `[session] MAP INCONSISTENCY socket=${socketId} → token=${token.slice(0, 8)}… but token not in sessions map! (sessions=${this.sessions.size})`
      );
      return undefined;
    }
    return session;
  }

  updateSessionSocket(sessionToken: string, socketId: string): void {
    const session = this.sessions.get(sessionToken);
    if (session) {
      const oldSocketId = session.socketId;
      // Remove old socket mapping
      if (session.socketId) {
        this.socketToSession.delete(session.socketId);
      }
      session.socketId = socketId;
      session.disconnectedAt = null;
      this.socketToSession.set(socketId, sessionToken);

      console.log(
        `[session] socket updated token=${sessionToken.slice(0, 8)}… oldSocket=${oldSocketId ?? 'none'} newSocket=${socketId}`
      );
    } else {
      console.warn(
        `[session] updateSessionSocket: token=${sessionToken.slice(0, 8)}… NOT FOUND in sessions map`
      );
    }
  }

  markSessionDisconnected(socketId: string): PlayerSession | undefined {
    const session = this.getSessionBySocketId(socketId);
    if (session) {
      session.disconnectedAt = Date.now();
      session.socketId = null;
      this.socketToSession.delete(socketId);

      console.log(
        `[session] marking disconnected token=${session.sessionToken.slice(0, 8)}… player=${session.playerId.slice(0, 8)}… room=${session.roomId} socket=${socketId}`
      );
    } else {
      console.warn(
        `[session] markDisconnected: no session for socket=${socketId}`
      );
    }
    return session;
  }

  isSessionValid(sessionToken: string): boolean {
    const session = this.sessions.get(sessionToken);
    if (!session) {
      console.warn(
        `[session] isSessionValid: token=${sessionToken.slice(0, 8)}… NOT FOUND (sessions=${this.sessions.size})`
      );
      return false;
    }

    if (session.disconnectedAt) {
      const elapsed = Date.now() - session.disconnectedAt;
      if (elapsed > DISCONNECT_GRACE_PERIOD_MS) {
        console.warn(
          `[session] isSessionValid: token=${sessionToken.slice(0, 8)}… EXPIRED (elapsed=${Math.round(elapsed / 1000)}s, grace=${DISCONNECT_GRACE_PERIOD_MS / 1000}s)`
        );
        return false;
      }
    }

    return true;
  }

  touchRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.lastActivity = Date.now();
    }
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      // Clean up sessions for this room
      for (const [token, session] of this.sessions) {
        if (session.roomId === roomId) {
          if (session.socketId) {
            this.socketToSession.delete(session.socketId);
          }
          this.sessions.delete(token);
        }
      }
      this.rooms.delete(roomId);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let deletedRooms = 0;
    let deletedSessions = 0;

    // Clean up expired rooms
    for (const [roomId, room] of this.rooms) {
      if (now - room.lastActivity > ROOM_EXPIRY_MS) {
        // Only delete if game hasn't started or is finished
        const phase = room.game.getState().phase;
        if (phase === 'waiting' || phase === 'game-end') {
          console.log(
            `[cleanup] deleting room=${roomId} phase=${phase} idle=${Math.round((now - room.lastActivity) / 1000)}s`
          );
          this.deleteRoom(roomId);
          deletedRooms++;
        }
      }
    }

    // Clean up expired disconnected sessions
    for (const [token, session] of this.sessions) {
      if (
        session.disconnectedAt &&
        now - session.disconnectedAt > DISCONNECT_GRACE_PERIOD_MS
      ) {
        console.log(
          `[cleanup] deleting session token=${token.slice(0, 8)}… player=${session.playerId.slice(0, 8)}… room=${session.roomId} disconnected=${Math.round((now - session.disconnectedAt) / 1000)}s ago`
        );
        if (session.socketId) {
          this.socketToSession.delete(session.socketId);
        }
        this.sessions.delete(token);
        deletedSessions++;
      }
    }

    if (deletedRooms > 0 || deletedSessions > 0) {
      console.log(
        `[cleanup] summary: deleted ${deletedRooms} rooms, ${deletedSessions} sessions (remaining: ${this.rooms.size} rooms, ${this.sessions.size} sessions)`
      );
    }
  }

  logHeartbeat(): void {
    let connected = 0;
    let disconnected = 0;
    for (const session of this.sessions.values()) {
      if (session.disconnectedAt) {
        disconnected++;
      } else {
        connected++;
      }
    }
    console.log(
      `[heartbeat] rooms=${this.rooms.size} sessions=${this.sessions.size} (connected=${connected} disconnected=${disconnected})`
    );
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getAllSessions(): IterableIterator<PlayerSession> {
    return this.sessions.values();
  }
}

export const roomManager = new RoomManager();
