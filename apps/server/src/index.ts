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
import { authRouter } from './auth/auth-routes.js';
import { DEV_USER, configurePassport } from './auth/passport-config.js';
import { pool } from './db/client.js';
import { createTables } from './db/schema.js';
import { hookExecutor } from './mods/hook-executor.js';
import { loadBuiltInMods } from './mods/mod-loader.js';
import { modRegistry } from './mods/mod-registry.js';
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

// Rate limiting for all HTTP routes (Socket.io traffic is unaffected)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // generous limit for SPA + API calls per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

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
if (isProd) {
  configurePassport();
}
app.use(passport.initialize());
app.use(passport.session());

// Dev bypass: auto-inject a hardcoded user so auth is transparent locally
if (!isProd) {
  app.use((req, _res, next) => {
    if (!req.user) req.user = DEV_USER;
    next();
  });
}

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

// --- DB schema (only when DATABASE_URL is set) ---
if (process.env.DATABASE_URL) {
  await createTables();
}

// --- Socket.io auth middleware ---
io.use((socket, next) => {
  // Share the HTTP session with Socket.io.
  // Cast next: Socket.io's next is narrower than Express's NextFunction.
  sessionMiddleware(
    socket.request as Request,
    {} as Response,
    next as unknown as express.NextFunction
  );
});
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
  app.get(`${BASE_PATH}*path`, (_req, res) => {
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
  console.log(`Spades server running on port ${PORT}`);
});

// Graceful shutdown handling
const shutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  // Forcefully disconnect all Socket.io clients immediately
  io.disconnectSockets();
  io.close();

  // Close HTTP server (don't wait for callback)
  httpServer.close();

  // Exit immediately after initiating shutdown
  // This prevents tsx watch from force-killing before cleanup completes
  setTimeout(() => {
    console.log('Server shutdown complete');
    process.exit(0);
  }, 100);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
