import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../mods/hook-executor.js', () => ({
  hookExecutor: {
    modifyConfig: vi.fn((config: unknown) => config),
  },
}));

import { RoomManager } from '../room-manager.js';
import type { PlayerSession } from '../room-manager.js';

describe('RoomManager', () => {
  let rm: RoomManager;

  beforeEach(() => {
    vi.useFakeTimers();
    rm = new RoomManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Room management ────────────────────────────────────────

  describe('generateRoomId', () => {
    it('should generate a 6-character uppercase ID', () => {
      const id = rm.generateRoomId();
      expect(id).toHaveLength(6);
      expect(id).toMatch(/^[A-Z2-9]+$/);
    });

    it('should exclude ambiguous characters (0, 1, I, O)', () => {
      // Generate many IDs and check none contain ambiguous chars
      const ids = Array.from({ length: 200 }, () => rm.generateRoomId());
      for (const id of ids) {
        expect(id).not.toMatch(/[01IO]/);
      }
    });

    it('should not collide with existing room IDs', () => {
      // Create a room first, then generate more IDs — all should be unique
      const room = rm.createRoom();
      const ids = new Set<string>([room.id]);
      for (let i = 0; i < 100; i++) {
        const id = rm.generateRoomId();
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    });
  });

  describe('createRoom', () => {
    it('should create a room with a game instance', () => {
      const room = rm.createRoom();
      expect(room.id).toHaveLength(6);
      expect(room.game).toBeDefined();
      expect(room.game.getState().phase).toBe('waiting');
    });

    it('should store the room for later retrieval', () => {
      const room = rm.createRoom();
      expect(rm.getRoom(room.id)).toBe(room);
    });

    it('should increment room count', () => {
      expect(rm.getRoomCount()).toBe(0);
      rm.createRoom();
      rm.createRoom();
      expect(rm.getRoomCount()).toBe(2);
    });
  });

  describe('getRoom', () => {
    it('should be case-insensitive', () => {
      const room = rm.createRoom();
      expect(rm.getRoom(room.id.toLowerCase())).toBe(room);
    });

    it('should return undefined for unknown room', () => {
      expect(rm.getRoom('ZZZZZZ')).toBeUndefined();
    });
  });

  describe('deleteRoom', () => {
    it('should remove the room', () => {
      const room = rm.createRoom();
      rm.deleteRoom(room.id);
      expect(rm.getRoom(room.id)).toBeUndefined();
      expect(rm.getRoomCount()).toBe(0);
    });

    it('should clean up sessions belonging to the room', () => {
      const room = rm.createRoom();
      rm.createSession(room.id, 'player-1', 'sock-1');
      rm.createSession(room.id, 'player-2', 'sock-2');
      expect(rm.getSessionCount()).toBe(2);

      rm.deleteRoom(room.id);
      expect(rm.getSessionCount()).toBe(0);
    });

    it('should not affect sessions in other rooms', () => {
      const room1 = rm.createRoom();
      const room2 = rm.createRoom();
      rm.createSession(room1.id, 'p1', 'sock-1');
      rm.createSession(room2.id, 'p2', 'sock-2');

      rm.deleteRoom(room1.id);
      expect(rm.getSessionCount()).toBe(1);
      expect(rm.getRoom(room2.id)).toBe(room2);
    });
  });

  describe('touchRoom', () => {
    it('should update lastActivity timestamp', () => {
      const room = rm.createRoom();
      const original = room.lastActivity;

      vi.advanceTimersByTime(5000);
      rm.touchRoom(room.id);

      expect(room.lastActivity).toBeGreaterThan(original);
    });
  });

  // ── Session management ─────────────────────────────────────

  describe('createSession', () => {
    it('should create a session with a unique token', () => {
      const room = rm.createRoom();
      const session = rm.createSession(room.id, 'player-1', 'sock-1');

      expect(session.sessionToken).toBeTruthy();
      expect(session.playerId).toBe('player-1');
      expect(session.roomId).toBe(room.id);
      expect(session.socketId).toBe('sock-1');
      expect(session.disconnectedAt).toBeNull();
    });

    it('should store userId when provided', () => {
      const room = rm.createRoom();
      const session = rm.createSession(room.id, 'p1', 'sock-1', 'user-abc');
      expect(session.userId).toBe('user-abc');
    });

    it('should default userId to null', () => {
      const room = rm.createRoom();
      const session = rm.createSession(room.id, 'p1', 'sock-1');
      expect(session.userId).toBeNull();
    });

    it('should be retrievable by token', () => {
      const room = rm.createRoom();
      const session = rm.createSession(room.id, 'p1', 'sock-1');
      expect(rm.getSession(session.sessionToken)).toBe(session);
    });

    it('should be retrievable by socket ID', () => {
      const room = rm.createRoom();
      const session = rm.createSession(room.id, 'p1', 'sock-1');
      expect(rm.getSessionBySocketId('sock-1')).toBe(session);
    });
  });

  describe('getSessionBySocketId', () => {
    it('should return undefined for unknown socket', () => {
      expect(rm.getSessionBySocketId('unknown')).toBeUndefined();
    });
  });

  describe('updateSessionSocket', () => {
    it('should update the socket ID on the session', () => {
      const room = rm.createRoom();
      const session = rm.createSession(room.id, 'p1', 'sock-old');

      rm.updateSessionSocket(session.sessionToken, 'sock-new');

      expect(session.socketId).toBe('sock-new');
      expect(rm.getSessionBySocketId('sock-new')).toBe(session);
    });

    it('should remove the old socket mapping', () => {
      const room = rm.createRoom();
      const session = rm.createSession(room.id, 'p1', 'sock-old');

      rm.updateSessionSocket(session.sessionToken, 'sock-new');

      expect(rm.getSessionBySocketId('sock-old')).toBeUndefined();
    });

    it('should clear disconnectedAt on reconnect', () => {
      const room = rm.createRoom();
      const session = rm.createSession(room.id, 'p1', 'sock-1');
      rm.markSessionDisconnected('sock-1');
      expect(session.disconnectedAt).not.toBeNull();

      rm.updateSessionSocket(session.sessionToken, 'sock-2');
      expect(session.disconnectedAt).toBeNull();
    });

    it('should no-op for unknown token', () => {
      // Should not throw
      rm.updateSessionSocket('nonexistent-token', 'sock-1');
    });
  });

  describe('markSessionDisconnected', () => {
    it('should set disconnectedAt and clear socketId', () => {
      const room = rm.createRoom();
      const session = rm.createSession(room.id, 'p1', 'sock-1');

      const result = rm.markSessionDisconnected('sock-1');

      expect(result).toBe(session);
      expect(session.disconnectedAt).toBeTruthy();
      expect(session.socketId).toBeNull();
    });

    it('should remove socket from lookup map', () => {
      const room = rm.createRoom();
      rm.createSession(room.id, 'p1', 'sock-1');

      rm.markSessionDisconnected('sock-1');
      expect(rm.getSessionBySocketId('sock-1')).toBeUndefined();
    });

    it('should return undefined for unknown socket', () => {
      expect(rm.markSessionDisconnected('unknown')).toBeUndefined();
    });
  });

  describe('isSessionValid', () => {
    it('should return true for a connected session', () => {
      const room = rm.createRoom();
      const session = rm.createSession(room.id, 'p1', 'sock-1');
      expect(rm.isSessionValid(session.sessionToken)).toBe(true);
    });

    it('should return true within the 5-minute grace period', () => {
      const room = rm.createRoom();
      const session = rm.createSession(room.id, 'p1', 'sock-1');
      rm.markSessionDisconnected('sock-1');

      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
      expect(rm.isSessionValid(session.sessionToken)).toBe(true);
    });

    it('should return false after the 5-minute grace period', () => {
      const room = rm.createRoom();
      const session = rm.createSession(room.id, 'p1', 'sock-1');
      rm.markSessionDisconnected('sock-1');

      vi.advanceTimersByTime(5 * 60 * 1000 + 1); // just past 5 minutes
      expect(rm.isSessionValid(session.sessionToken)).toBe(false);
    });

    it('should return false for unknown token', () => {
      expect(rm.isSessionValid('nonexistent')).toBe(false);
    });
  });

  // ── Player/session helpers ─────────────────────────────────

  describe('deleteSessionsForPlayer', () => {
    it('should remove all sessions for a given player ID', () => {
      const room = rm.createRoom();
      rm.createSession(room.id, 'player-1', 'sock-1');
      rm.createSession(room.id, 'player-1', 'sock-2'); // duplicate session
      rm.createSession(room.id, 'player-2', 'sock-3');

      rm.deleteSessionsForPlayer('player-1');

      expect(rm.getSessionCount()).toBe(1);
      expect(rm.getSessionBySocketId('sock-1')).toBeUndefined();
      expect(rm.getSessionBySocketId('sock-2')).toBeUndefined();
      expect(rm.getSessionBySocketId('sock-3')).toBeDefined();
    });
  });

  describe('getUserIdsByPlayerId', () => {
    it('should map player IDs to user IDs for a room', () => {
      const room = rm.createRoom();
      rm.createSession(room.id, 'p0', 'sock-0', 'user-a');
      rm.createSession(room.id, 'p1', 'sock-1', 'user-b');
      rm.createSession(room.id, 'p2', 'sock-2', null);

      const map = rm.getUserIdsByPlayerId(room.id);
      expect(map.get('p0')).toBe('user-a');
      expect(map.get('p1')).toBe('user-b');
      expect(map.get('p2')).toBeNull();
    });

    it('should not include sessions from other rooms', () => {
      const room1 = rm.createRoom();
      const room2 = rm.createRoom();
      rm.createSession(room1.id, 'p0', 'sock-0', 'user-a');
      rm.createSession(room2.id, 'p1', 'sock-1', 'user-b');

      const map = rm.getUserIdsByPlayerId(room1.id);
      expect(map.size).toBe(1);
      expect(map.has('p1')).toBe(false);
    });
  });

  describe('getAbandonedPlayerIds', () => {
    function setupActiveGame(): { roomId: string; sessions: PlayerSession[] } {
      const room = rm.createRoom();
      const sessions: PlayerSession[] = [];
      for (let i = 0; i < 4; i++) {
        room.game.addPlayer(`p${i}`, `Player ${i}`);
        sessions.push(rm.createSession(room.id, `p${i}`, `sock-${i}`));
      }
      for (let i = 0; i < 4; i++) {
        room.game.setPlayerReady(`p${i}`);
      }
      room.game.startGame();
      return { roomId: room.id, sessions };
    }

    it('should return empty when all players are connected', () => {
      const { roomId } = setupActiveGame();
      expect(rm.getAbandonedPlayerIds(roomId)).toEqual([]);
    });

    it('should return empty for waiting phase', () => {
      const room = rm.createRoom();
      room.game.addPlayer('p0', 'Player 0');
      rm.createSession(room.id, 'p0', 'sock-0');
      // Disconnect player
      rm.markSessionDisconnected('sock-0');
      vi.advanceTimersByTime(6 * 60 * 1000);

      expect(rm.getAbandonedPlayerIds(room.id)).toEqual([]);
    });

    it('should return player IDs whose sessions have expired', () => {
      const { roomId } = setupActiveGame();

      // Disconnect player 1 and let their grace period expire
      rm.markSessionDisconnected('sock-1');
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      // Mark player 1 as disconnected in the game state too
      const room = rm.getRoom(roomId)!;
      const player1 = room.game.getState().players.find((p) => p.id === 'p1')!;
      player1.connected = false;

      const abandoned = rm.getAbandonedPlayerIds(roomId);
      expect(abandoned).toEqual(['p1']);
    });

    it('should not include players still within grace period', () => {
      const { roomId } = setupActiveGame();

      rm.markSessionDisconnected('sock-2');
      vi.advanceTimersByTime(2 * 60 * 1000); // 2 minutes — within grace

      const room = rm.getRoom(roomId)!;
      const player2 = room.game.getState().players.find((p) => p.id === 'p2')!;
      player2.connected = false;

      expect(rm.getAbandonedPlayerIds(roomId)).toEqual([]);
    });

    it('should return empty for unknown room', () => {
      expect(rm.getAbandonedPlayerIds('ZZZZZZ')).toEqual([]);
    });
  });

  // ── Cleanup ────────────────────────────────────────────────

  describe('cleanup (via timer)', () => {
    it('should delete idle waiting rooms after 30 minutes', () => {
      const room = rm.createRoom();
      expect(rm.getRoomCount()).toBe(1);

      // Advance past room expiry (30 min) + cleanup interval (1 min)
      vi.advanceTimersByTime(31 * 60 * 1000);

      expect(rm.getRoom(room.id)).toBeUndefined();
      expect(rm.getRoomCount()).toBe(0);
    });

    it('should not delete rooms with active games that have sessions', () => {
      const room = rm.createRoom();
      for (let i = 0; i < 4; i++) {
        room.game.addPlayer(`p${i}`, `Player ${i}`);
        rm.createSession(room.id, `p${i}`, `sock-${i}`);
      }
      for (let i = 0; i < 4; i++) {
        room.game.setPlayerReady(`p${i}`);
      }
      room.game.startGame();

      vi.advanceTimersByTime(31 * 60 * 1000);
      expect(rm.getRoom(room.id)).toBe(room);
    });

    it('should delete orphaned active game rooms when all sessions expire', () => {
      const room = rm.createRoom();
      for (let i = 0; i < 4; i++) {
        room.game.addPlayer(`p${i}`, `Player ${i}`);
        rm.createSession(room.id, `p${i}`, `sock-${i}`);
      }
      for (let i = 0; i < 4; i++) {
        room.game.setPlayerReady(`p${i}`);
      }
      room.game.startGame();

      // All players disconnect
      for (let i = 0; i < 4; i++) {
        rm.markSessionDisconnected(`sock-${i}`);
      }

      // Advance past disconnect grace period + cleanup interval
      vi.advanceTimersByTime(6 * 60 * 1000);

      expect(rm.getRoom(room.id)).toBeUndefined();
      expect(rm.getRoomCount()).toBe(0);
    });

    it('should delete expired disconnected sessions', () => {
      const room = rm.createRoom();
      rm.createSession(room.id, 'p1', 'sock-1');
      rm.markSessionDisconnected('sock-1');

      expect(rm.getSessionCount()).toBe(1);

      // Advance past disconnect grace (5 min) + cleanup interval (1 min)
      vi.advanceTimersByTime(6 * 60 * 1000);

      expect(rm.getSessionCount()).toBe(0);
    });

    it('should invoke onSessionAbandoned for active game sessions', () => {
      const room = rm.createRoom();
      for (let i = 0; i < 4; i++) {
        room.game.addPlayer(`p${i}`, `Player ${i}`);
        rm.createSession(room.id, `p${i}`, `sock-${i}`);
      }
      for (let i = 0; i < 4; i++) {
        room.game.setPlayerReady(`p${i}`);
      }
      room.game.startGame();

      const callback = vi.fn();
      rm.onSessionAbandoned = callback;

      rm.markSessionDisconnected('sock-2');
      vi.advanceTimersByTime(6 * 60 * 1000);

      expect(callback).toHaveBeenCalledWith(room.id, 'p2');
    });

    it('should not invoke onSessionAbandoned for waiting rooms', () => {
      const room = rm.createRoom();
      rm.createSession(room.id, 'p1', 'sock-1');
      rm.markSessionDisconnected('sock-1');

      const callback = vi.fn();
      rm.onSessionAbandoned = callback;

      vi.advanceTimersByTime(6 * 60 * 1000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ── Diagnostic helpers ─────────────────────────────────────

  describe('logHeartbeat / counts', () => {
    it('should report correct session counts', () => {
      const room = rm.createRoom();
      rm.createSession(room.id, 'p1', 'sock-1');
      rm.createSession(room.id, 'p2', 'sock-2');

      expect(rm.getSessionCount()).toBe(2);
      expect(rm.getRoomCount()).toBe(1);
    });

    it('should iterate all sessions', () => {
      const room = rm.createRoom();
      rm.createSession(room.id, 'p1', 'sock-1');
      rm.createSession(room.id, 'p2', 'sock-2');

      const sessions = [...rm.getAllSessions()];
      expect(sessions).toHaveLength(2);
    });
  });
});
