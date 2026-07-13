import { createServer, type Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import type {
  Card,
  ClientGameState,
  ClientToServerEvents,
  ScoreHistoryEntry,
  ServerToClientEvents,
} from '@spades/shared';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupSocketHandlers } from '../socket/handler.js';

// Regression tests for issue #230: the reconnect path (`player:reconnect` →
// `reconnect:success`) must make the same auto-reveal decision as the seat
// replacement path (`room:select-seat` → `game:cards-dealt`). A reconnect
// during bidding, before the seat has committed to a See Cards / Bid Blind
// Nil decision, must NOT reveal the hand (`autoReveal=false`); any state past
// that decision point must (`autoReveal=true`).

interface ReconnectSuccess {
  state: ClientGameState;
  hand: Card[];
  autoReveal?: boolean;
  scoreHistory: ScoreHistoryEntry[];
}

interface TestPlayer {
  client: ClientSocket;
  sessionToken: string;
  position: number;
}

// Matching per-test timeout so the generous socket waits (below) can actually
// elapse before vitest's 5s default kills the test.
describe('reconnect autoReveal decision', { timeout: 30000 }, () => {
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

  function connect(): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const client = ioClient(serverUrl, { transports: ['websocket'] });
      clients.push(client);
      client.on('connect', () => resolve(client));
      client.on('connect_error', reject);
    });
  }

  function waitFor<T>(
    client: ClientSocket,
    event: string,
    predicate?: (data: T) => boolean
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Generous timeout: under a full-suite run this file shares the machine
      // with other packages' tests, and 5s round-trips have flaked.
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for ${event}`)),
        15000
      );
      const listener = (data: T) => {
        if (predicate && !predicate(data)) return;
        clearTimeout(timer);
        client.off(event, listener);
        resolve(data);
      };
      client.on(event, listener);
    });
  }

  /** Create a 4-player room and ready everyone into the bidding phase. */
  async function setupBiddingRoom(): Promise<{
    roomId: string;
    players: TestPlayer[];
    biddingState: ClientGameState;
  }> {
    const creator = await connect();
    const created = waitFor<{ roomId: string; sessionToken: string }>(
      creator,
      'room:created'
    );
    creator.emit('room:create', { nickname: 'P0' });
    const { roomId, sessionToken } = await created;

    const players: TestPlayer[] = [
      { client: creator, sessionToken, position: 0 },
    ];

    for (let i = 1; i < 4; i++) {
      const client = await connect();
      const joined = waitFor<{
        roomId: string;
        position: number;
        sessionToken: string;
      }>(client, 'room:joined');
      client.emit('room:join', { roomId, nickname: `P${i}` });
      const data = await joined;
      players.push({
        client,
        sessionToken: data.sessionToken,
        position: data.position,
      });
    }

    const bidding = waitFor<{ state: ClientGameState }>(
      creator,
      'game:state-update',
      ({ state }) => state.phase === 'bidding'
    );
    for (const player of players) {
      player.client.emit('room:ready');
    }
    const { state: biddingState } = await bidding;

    return { roomId, players, biddingState };
  }

  /** Open a fresh socket and reconnect with the given session. */
  async function reconnectFresh(
    roomId: string,
    sessionToken: string
  ): Promise<ReconnectSuccess> {
    const client = await connect();
    const success = waitFor<ReconnectSuccess>(client, 'reconnect:success');
    client.emit('player:reconnect', { sessionToken, roomId });
    return success;
  }

  function playerAt(players: TestPlayer[], position: number): TestPlayer {
    const player = players.find((p) => p.position === position);
    if (!player) throw new Error(`no player at position ${position}`);
    return player;
  }

  /** Pick a bid the current player is allowed to make (mods may disable one). */
  function allowedBid(state: ClientGameState): number {
    const disabled = new Set(state.disabledBids ?? []);
    for (let bid = 2; bid <= 13; bid++) {
      if (!disabled.has(bid)) return bid;
    }
    throw new Error('no allowed bid found');
  }

  it('does not auto-reveal on reconnect during bidding before the See Cards decision', async () => {
    const { roomId, players, biddingState } = await setupBiddingRoom();
    // Any seat that hasn't bid or clicked See Cards still has the Blind Nil
    // decision open — use one that isn't the current bidder.
    const idle = players.find(
      (p) => p.position !== biddingState.currentPlayerPosition
    )!;
    idle.client.disconnect();

    const result = await reconnectFresh(roomId, idle.sessionToken);
    expect(result.state.phase).toBe('bidding');
    expect(result.hand).toHaveLength(13);
    expect(result.autoReveal).toBe(false);
  });

  it('auto-reveals on reconnect during bidding after the seat clicked See Cards', async () => {
    const { roomId, players, biddingState } = await setupBiddingRoom();
    const idle = players.find(
      (p) => p.position !== biddingState.currentPlayerPosition
    )!;
    idle.client.emit('game:see-cards');
    // game:see-cards has no ack; a reconnect round-trip on the same socket
    // acts as an in-order barrier proving the server processed it.
    const barrier = waitFor<ReconnectSuccess>(idle.client, 'reconnect:success');
    idle.client.emit('player:reconnect', {
      sessionToken: idle.sessionToken,
      roomId,
    });
    await barrier;
    idle.client.disconnect();

    const result = await reconnectFresh(roomId, idle.sessionToken);
    expect(result.state.phase).toBe('bidding');
    expect(result.autoReveal).toBe(true);
  });

  it('auto-reveals on reconnect during bidding after the seat has bid', async () => {
    const { roomId, players, biddingState } = await setupBiddingRoom();
    const bidder = playerAt(players, biddingState.currentPlayerPosition);

    const bidMade = waitFor(bidder.client, 'game:bid-made');
    bidder.client.emit('game:bid', { bid: allowedBid(biddingState) });
    await bidMade;
    bidder.client.disconnect();

    const result = await reconnectFresh(roomId, bidder.sessionToken);
    expect(result.state.phase).toBe('bidding');
    expect(result.autoReveal).toBe(true);
  });

  it('auto-reveals on reconnect during the playing phase', async () => {
    const { roomId, players, biddingState } = await setupBiddingRoom();

    // Track state from the creator's socket only: setupBiddingRoom already
    // consumed its stream up to the 'bidding' update, so every further
    // state-update it sees reflects a bid. Listening on each bidder's own
    // socket instead would race with stale pre-bidding updates still queued
    // on those sockets.
    const observer = players[0].client;
    let state = biddingState;
    while (state.phase === 'bidding') {
      const bidder = playerAt(players, state.currentPlayerPosition);
      const updated = waitFor<{ state: ClientGameState }>(
        observer,
        'game:state-update',
        // Wait for the update where this bid has landed: either the turn
        // moved on or bidding completed.
        ({ state: s }) =>
          s.phase !== 'bidding' ||
          s.currentPlayerPosition !== state.currentPlayerPosition
      );
      bidder.client.emit('game:bid', { bid: allowedBid(state) });
      state = (await updated).state;
    }
    expect(state.phase).toBe('playing');

    const idle = players[0];
    idle.client.disconnect();
    const result = await reconnectFresh(roomId, idle.sessionToken);
    expect(result.state.phase).toBe('playing');
    expect(result.autoReveal).toBe(true);
  });
});
