import { createServer, type Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import type {
  ClientGameState,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@spades/shared';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupSocketHandlers } from '../socket/handler.js';

// Regression coverage for issue #230: a mid-bidding reconnect used to
// unconditionally reveal the reconnecting player's hand (robbing Bid Blind
// Nil), because the reconnect:success payload didn't carry the same
// `autoReveal` decision the seat-replacement path already computed. See
// computeAutoReveal in handler.ts and the "Card Reveal Semantics" note in
// CLAUDE.md.

type TypedClientSocket = ClientSocket<
  ServerToClientEvents,
  ClientToServerEvents
>;

describe('reconnect autoReveal', () => {
  let httpServer: HttpServer;
  let io: Server<ClientToServerEvents, ServerToClientEvents>;
  let serverUrl: string;
  const clients: TypedClientSocket[] = [];

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

  function connect(): Promise<TypedClientSocket> {
    return new Promise((resolve, reject) => {
      const client: TypedClientSocket = ioClient(serverUrl, {
        transports: ['websocket'],
      });
      clients.push(client);
      client.on('connect', () => resolve(client));
      client.on('connect_error', reject);
    });
  }

  // Deliberately untyped socket param — the generic response shape T varies
  // per event, which a single helper can't express against the strict
  // per-event ServerToClientEvents union.
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

  async function waitForPhase(
    client: TypedClientSocket,
    phase: ClientGameState['phase']
  ): Promise<ClientGameState> {
    // The target phase may already have arrived in an earlier
    // game:state-update, or arrive in a later one — poll each update.
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for phase=${phase}`)),
        5000
      );
      const handler = ({ state }: { state: ClientGameState }) => {
        if (state.phase === phase) {
          clearTimeout(timer);
          client.off('game:state-update', handler);
          resolve(state);
        }
      };
      client.on('game:state-update', handler);
    });
  }

  it('reconnecting before any bid decision keeps cards hidden (autoReveal=false)', async () => {
    // Seat up a full 4-player room and ready everyone so the game deals into
    // bidding.
    const creator = await connect();
    const created = waitFor<{ roomId: string; sessionToken: string }>(
      creator,
      'room:created'
    );
    creator.emit('room:create', { nickname: 'P0' });
    const { roomId, sessionToken: creatorToken } = await created;

    // Position -> { client, sessionToken } for every seat, so we can look up
    // whichever seat lands on the clock once bidding starts.
    const seats: { client: TypedClientSocket; sessionToken: string }[] = [
      { client: creator, sessionToken: creatorToken },
    ];
    for (const nickname of ['P1', 'P2', 'P3']) {
      const client = await connect();
      const joined = waitFor<{
        roomId: string;
        position: number;
        sessionToken: string;
      }>(client, 'room:joined');
      client.emit('room:join', { roomId, nickname });
      const { position, sessionToken } = await joined;
      seats[position] = { client, sessionToken };
    }

    const allClients = seats.map((s) => s.client);
    const dealtWaits = allClients.map((c) =>
      waitFor<{ hand: unknown[]; autoReveal?: boolean }>(c, 'game:cards-dealt')
    );
    // Register before emitting room:ready — the bidding-phase state-update
    // arrives in the same synchronous batch as game:cards-dealt, so
    // attaching this listener after awaiting dealtWaits would race it.
    const biddingWait = waitForPhase(creator, 'bidding');
    for (const client of allClients) {
      client.emit('room:ready');
    }
    await Promise.all(dealtWaits);

    const biddingState = await biddingWait;
    const currentPosition = biddingState.currentPlayerPosition;

    // The seat on the clock has made no bidding decision yet, so it's the
    // one whose reconnect must NOT auto-reveal.
    const { client: currentClient, sessionToken: currentToken } =
      seats[currentPosition];

    currentClient.disconnect();
    const reconnected = await connect();
    const success = waitFor<{
      state: ClientGameState;
      hand: unknown[];
      autoReveal?: boolean;
    }>(reconnected, 'reconnect:success');
    reconnected.emit('player:reconnect', {
      sessionToken: currentToken,
      roomId,
    });
    const payload = await success;

    expect(payload.state.phase).toBe('bidding');
    expect(payload.autoReveal).toBe(false);
  });
});
