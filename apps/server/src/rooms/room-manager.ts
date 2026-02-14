import type { GameState, Card, Position } from '@spades/shared';
import { createInitialGameState } from '@spades/shared';
import { v4 as uuidv4 } from 'uuid';
import { GameInstance } from '../game/game-instance.js';

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
    const game = new GameInstance(gameState);

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
      '[Session] Created session for socket:',
      socketId,
      'token:',
      sessionToken.substring(0, 8)
    );
    console.log(
      '[Session] socketToSession map size:',
      this.socketToSession.size
    );
    return session;
  }

  getSession(sessionToken: string): PlayerSession | undefined {
    return this.sessions.get(sessionToken);
  }

  getSessionBySocketId(socketId: string): PlayerSession | undefined {
    const token = this.socketToSession.get(socketId);
    console.log('[Session] Looking up session for socket:', socketId);
    console.log(
      '[Session] Found token:',
      token ? token.substring(0, 8) : 'NOT FOUND'
    );
    console.log(
      '[Session] socketToSession map size:',
      this.socketToSession.size
    );
    console.log(
      '[Session] socketToSession keys:',
      Array.from(this.socketToSession.keys())
    );
    return token ? this.sessions.get(token) : undefined;
  }

  updateSessionSocket(sessionToken: string, socketId: string): void {
    const session = this.sessions.get(sessionToken);
    if (session) {
      console.log(
        '[Session] updateSessionSocket called for token:',
        sessionToken.substring(0, 8)
      );
      console.log(
        '[Session] Old socket:',
        session.socketId,
        '-> New socket:',
        socketId
      );
      // Remove old socket mapping
      if (session.socketId) {
        this.socketToSession.delete(session.socketId);
        console.log('[Session] Deleted old socket mapping:', session.socketId);
      }
      session.socketId = socketId;
      session.disconnectedAt = null;
      this.socketToSession.set(socketId, sessionToken);
    }
  }

  markSessionDisconnected(socketId: string): PlayerSession | undefined {
    const session = this.getSessionBySocketId(socketId);
    if (session) {
      console.log(
        '[Session] Marking session as disconnected for socket:',
        socketId
      );
      session.disconnectedAt = Date.now();
      session.socketId = null;
      this.socketToSession.delete(socketId);
      console.log(
        '[Session] socketToSession map size after delete:',
        this.socketToSession.size
      );
    }
    return session;
  }

  isSessionValid(sessionToken: string): boolean {
    const session = this.sessions.get(sessionToken);
    if (!session) return false;

    if (session.disconnectedAt) {
      const elapsed = Date.now() - session.disconnectedAt;
      if (elapsed > DISCONNECT_GRACE_PERIOD_MS) {
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

    // Clean up expired rooms
    for (const [roomId, room] of this.rooms) {
      if (now - room.lastActivity > ROOM_EXPIRY_MS) {
        // Only delete if game hasn't started or is finished
        const phase = room.game.getState().phase;
        if (phase === 'waiting' || phase === 'game-end') {
          this.deleteRoom(roomId);
        }
      }
    }

    // Clean up expired disconnected sessions
    for (const [token, session] of this.sessions) {
      if (
        session.disconnectedAt &&
        now - session.disconnectedAt > DISCONNECT_GRACE_PERIOD_MS
      ) {
        if (session.socketId) {
          this.socketToSession.delete(session.socketId);
        }
        this.sessions.delete(token);
      }
    }
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
