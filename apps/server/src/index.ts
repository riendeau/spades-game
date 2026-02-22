import fs from 'fs';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@spades/shared';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { hookExecutor } from './mods/hook-executor.js';
import { loadBuiltInMods } from './mods/mod-loader.js';
import { modRegistry } from './mods/mod-registry.js';
import { setupSocketHandlers } from './socket/handler.js';

const PORT = process.env.PORT || 3001;
const BASE_PATH = process.env.BASE_PATH || '/';

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

// Health check (always at root for monitoring)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Get available mods
app.get(`${BASE_PATH}api/mods`, (_req, res) => {
  res.json(modRegistry.getModList());
});

// Setup socket handlers
setupSocketHandlers(io);

// Serve the built client if it exists
if (servingClient) {
  app.use(BASE_PATH, express.static(clientDistPath));

  // SPA fallback: serve index.html for any non-API, non-file request under BASE_PATH
  app.get(`${BASE_PATH}*`, (_req, res) => {
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
