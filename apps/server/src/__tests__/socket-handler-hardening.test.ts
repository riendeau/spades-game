import { createServer, type Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@spades/shared';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupSocketHandlers } from '../socket/handler.js';

// Regression tests for the crash class where a malformed client payload threw
// inside a socket.io event handler and killed the whole Node process (e.g.
// `socket.emit('game:bid')` with no payload → "Cannot destructure property
// 'bid' of 'undefined'"). Every client event now goes through the safeOn
// wrapper in handler.ts.

const CLIENT_EVENTS = [
  'room:create',
  'room:join',
  'room:ready',
  'room:leave',
  'game:bid',
  'game:play-card',
  'game:see-cards',
  'player:reconnect',
  'client:debug',
  'player:change-seat',
  'player:open-seat',
  'player:kick-idle',
  'room:select-seat',
] as const;

const MALFORMED_PAYLOADS = [
  undefined,
  null,
  42,
  'garbage',
  { wrong: 'shape' },
  { sessionToken: 123, roomId: {}, bid: 'NaN', newPosition: [], card: 7 },
];

describe('socket handler payload hardening', () => {
  let httpServer: HttpServer;
  let io: Server<ClientToServerEvents, ServerToClientEvents>;
  let serverUrl: string;
  const clients: ClientSocket[] = [];

  beforeAll(async () => {
    httpServer = createServer();
    io = new Server(httpServer);
    setupSocketHandlers(io);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    serverUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await io.close();
  });

  afterEach(() => {
    for (const client of clients.splice(0)) {
      client.disconnect();
    }
  });

  // Deliberately untyped client so malformed emits compile.
  function connect(): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const client = ioClient(serverUrl, { transports: ['websocket'] });
      clients.push(client);
      client.on('connect', () => resolve(client));
      client.on('connect_error', reject);
    });
  }

  function waitFor<T>(client: ClientSocket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for ${event}`)),
        5000
      );
      client.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  it('survives malformed payloads on every client event', async () => {
    const client = await connect();

    for (const event of CLIENT_EVENTS) {
      for (const payload of MALFORMED_PAYLOADS) {
        client.emit(event, payload);
      }
    }

    // The server is still alive and this same socket still works: a valid
    // room:create round-trips successfully.
    const created = waitFor<{ roomId: string; sessionToken: string }>(
      client,
      'room:created'
    );
    client.emit('room:create', { nickname: 'Survivor' });
    const { roomId, sessionToken } = await created;
    expect(roomId).toMatch(/^[A-Z0-9]{6}$/);
    expect(sessionToken).toBeTruthy();
  });

  it('rejects malformed player:reconnect payloads without crashing', async () => {
    const client = await connect();

    const failed = waitFor<{ reason: string }>(client, 'reconnect:failed');
    client.emit('player:reconnect', { sessionToken: 123, roomId: {} });
    const { reason } = await failed;
    expect(reason).toBe('Invalid session');
  });

  it('rejects out-of-range seat positions', async () => {
    const client = await connect();

    const created = waitFor(client, 'room:created');
    client.emit('room:create', { nickname: 'Seater' });
    await created;

    for (const badPosition of [99, -1, 1.5, '2', null]) {
      const error = waitFor<{ code: string; message: string }>(client, 'error');
      client.emit('player:change-seat', { newPosition: badPosition });
      const { code, message } = await error;
      expect(code).toBe('SEAT_CHANGE_FAILED');
      expect(message).toBe('Invalid seat position');
    }

    // A legitimate seat change still works afterwards.
    const changed = waitFor<{ newPosition: number }>(
      client,
      'room:seat-changed'
    );
    client.emit('player:change-seat', { newPosition: 2 });
    const { newPosition } = await changed;
    expect(newPosition).toBe(2);
  });
});
