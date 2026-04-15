import fs from 'fs';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@spades/shared';
import connectPgSimple from 'connect-pg-simple';
import express from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import { Server } from 'socket.io';
import { generateBidAdvice } from './ai/claude-service.js';
import { authRouter } from './auth/auth-routes.js';
import { DEV_USER, configurePassport } from './auth/passport-config.js';
import { pool } from './db/client.js';
import { getBidStats, getNilStats, getPlayerStats } from './db/game-results.js';
import { createTables } from './db/schema.js';
import { hookExecutor } from './mods/hook-executor.js';
import { loadBuiltInMods } from './mods/mod-loader.js';
import { modRegistry } from './mods/mod-registry.js';
import { roomManager } from './rooms/room-manager.js';
import { setupSocketHandlers } from './socket/handler.js';

const PORT = process.env.PORT || 3001;
const BASE_PATH = process.env.BASE_PATH || '/';
const isProd = process.env.NODE_ENV === 'production';

// Load mods
loadBuiltInMods();

// Wire loaded mods into hook executor
hookExecutor.setMods(modRegistry.getAllRuleMods());

const app = express();
const httpServer = createServer(app);

// Trust Render's reverse proxy so passport constructs https:// callback URLs
// from X-Forwarded-Proto rather than defaulting to http://
app.set('trust proxy', 1);

// Strict rate limiting for API and auth routes (DB queries, OAuth, AI calls)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // per IP across /api + /auth combined
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);
app.use('/auth', apiLimiter);

// Generous rate limiting for the SPA fallback (res.sendFile — filesystem I/O).
// express.static is excluded: it runs before this and short-circuits matched files.
// This satisfies CodeQL js/missing-rate-limiting without penalizing normal browsing.
const pageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // page navigations only — static assets don't count
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check — always public, before auth middleware
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Serve built client files when SERVE_CLIENT=true (for single-port production deployment).
// When not serving the client, enable CORS for the Vite dev server origin.
const clientDistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/client/dist'
);
const servingClient =
  process.env.SERVE_CLIENT === 'true' && fs.existsSync(clientDistPath);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: servingClient
    ? undefined
    : {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
      },
});

// --- Session middleware (shared with Socket.io) ---
// In dev without DATABASE_URL, use the default in-memory store so pnpm dev
// works without a local PostgreSQL instance.
const PgSession = connectPgSimple(session);
const sessionStore =
  isProd && process.env.DATABASE_URL
    ? new PgSession({ pool, createTableIfMissing: true })
    : undefined;

const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET ?? 'dev-secret-do-not-use-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
});
app.use(sessionMiddleware);

// --- Passport ---
const oauthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.DATABASE_URL
);
if (isProd && oauthConfigured) {
  configurePassport();
} else if (isProd) {
  console.warn(
    'OAuth disabled — GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and DATABASE_URL ' +
      'must all be set in the Render dashboard to enable sign-in.'
  );
}
const passportInit = passport.initialize();
const passportSession = passport.session();
app.use(passportInit);
app.use(passportSession);

// Dev bypass: auto-inject a hardcoded user so auth is transparent locally
if (!isProd) {
  app.use((req, _res, next) => {
    req.user ??= DEV_USER;
    next();
  });
}

// --- JSON body parser (for POST endpoints) ---
app.use(express.json());

// --- Auth routes (public) ---
app.use('/auth', authRouter);

// --- Protect /api/* routes ---
app.use('/api', (req, res, next) => {
  if (req.user) return next();
  res.status(401).json({ error: 'Unauthorized' });
});

// Get available mods
app.get(`${BASE_PATH}api/mods`, (_req, res) => {
  res.json(modRegistry.getModList());
});

// Get player stats
app.get(`${BASE_PATH}api/stats`, (req, res) => {
  void getPlayerStats(req.user!.id).then(
    (stats) => res.json(stats),
    (err) => {
      console.error('[api] /api/stats error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  );
});

// Get bid accuracy stats
app.get(`${BASE_PATH}api/stats/bids`, (req, res) => {
  void getBidStats(req.user!.id).then(
    (stats) => res.json(stats),
    (err) => {
      console.error('[api] /api/stats/bids error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  );
});

// Get nil attempt stats
app.get(`${BASE_PATH}api/stats/nil`, (req, res) => {
  void getNilStats(req.user!.id).then(
    (stats) => res.json(stats),
    (err) => {
      console.error('[api] /api/stats/nil error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  );
});

// Get AI bid advice
app.post(`${BASE_PATH}api/bid-advice`, (req, res) => {
  void (async () => {
    try {
      const { roomId, sessionToken } = req.body as {
        roomId?: string;
        sessionToken?: string;
      };
      if (!roomId || !sessionToken) {
        res.status(400).json({ error: 'roomId and sessionToken are required' });
        return;
      }

      const room = roomManager.getRoom(roomId);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      const state = room.game.getState();
      if (state.phase !== 'bidding') {
        res.status(400).json({ error: 'Game is not in bidding phase' });
        return;
      }

      // Look up the player session directly by token
      const playerSession = roomManager.getSession(sessionToken);
      if (playerSession?.roomId !== roomId.toUpperCase()) {
        res.status(404).json({ error: 'Player not found in this room' });
        return;
      }

      // Find player position
      const player = state.players.find((p) => p.id === playerSession.playerId);
      if (!player) {
        res.status(404).json({ error: 'Player not found in game state' });
        return;
      }

      // Verify it's this player's turn to bid
      if (state.currentPlayerPosition !== player.position) {
        res.status(400).json({ error: "It's not your turn to bid" });
        return;
      }

      const hand = room.game.getPlayerHand(playerSession.playerId);
      if (hand.length === 0) {
        res.status(400).json({ error: 'No cards in hand' });
        return;
      }

      // Gather current bids with position/team info
      const currentBids = (state.currentRound?.bids ?? []).map((bid) => {
        const bidPlayer = state.players.find((p) => p.id === bid.playerId);
        return {
          position: bidPlayer!.position,
          team: bidPlayer!.team,
          bid: bid.bid,
          isNil: bid.isNil,
          isBlindNil: bid.isBlindNil,
        };
      });

      const result = await generateBidAdvice({
        hand,
        scores: {
          team1: {
            score: state.scores.team1.score,
            bags: state.scores.team1.bags,
          },
          team2: {
            score: state.scores.team2.score,
            bags: state.scores.team2.bags,
          },
        },
        currentBids,
        myPosition: player.position,
        myTeam: player.team,
        dealerPosition: state.dealerPosition,
        winningScore: state.winningScore,
      });

      if (!result) {
        res.status(503).json({ error: 'AI advice is not available' });
        return;
      }

      res.json(result);
    } catch (err) {
      console.error('[api] /api/bid-advice error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  })();
});

// --- DB schema (only when DATABASE_URL is set) ---
if (process.env.DATABASE_URL) {
  await createTables();
}

// --- Socket.io auth middleware ---
// Run session + passport middleware so socket.request.user is populated
// from the session before the auth check below.
const ioMiddleware =
  (mw: express.RequestHandler) =>
  (socket: { request: object }, next: (err?: Error) => void) =>
    mw(
      socket.request as Request,
      {} as Response,
      next as unknown as express.NextFunction
    );

io.use(ioMiddleware(sessionMiddleware));
io.use(ioMiddleware(passportInit));
io.use(ioMiddleware(passportSession));
io.use((socket, next) => {
  if (!isProd) return next();
  if ((socket.request as Request).user) return next();
  next(new Error('Unauthorized'));
});

// Setup socket handlers
setupSocketHandlers(io);

// Serve the built client if it exists
if (servingClient) {
  app.use(BASE_PATH, express.static(clientDistPath));

  // SPA fallback: serve index.html for any non-API, non-file request under BASE_PATH
  app.get(`${BASE_PATH}*path`, pageLimiter, (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });

  console.log(`Serving client from ${clientDistPath} at ${BASE_PATH}`);
}

// Handle port conflicts from orphaned tsx watch processes
httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. This is likely an orphaned tsx watch process.`
    );
    console.error(
      `Run this command to kill it: lsof -ti :${PORT} | xargs kill`
    );
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, () => {
  console.log(
    `[server] started at=${new Date().toISOString()} port=${PORT} env=${process.env.NODE_ENV ?? 'development'}`
  );
});

// Heartbeat: log room/session counts every 5 minutes
const heartbeatInterval = setInterval(
  () => {
    roomManager.logHeartbeat();
  },
  5 * 60 * 1000
);

// Graceful shutdown handling
const shutdown = (signal: string) => {
  console.log(
    `\n[server] ${signal} received, shutting down (rooms=${roomManager.getRoomCount()} sessions=${roomManager.getSessionCount()})`
  );

  clearInterval(heartbeatInterval);

  // Forcefully disconnect all Socket.io clients immediately
  io.disconnectSockets();
  void io.close();

  // Close HTTP server (don't wait for callback)
  httpServer.close();

  // Exit immediately after initiating shutdown
  // This prevents tsx watch from force-killing before cleanup completes
  setTimeout(() => {
    console.log('[server] shutdown complete');
    process.exit(0);
  }, 100);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
