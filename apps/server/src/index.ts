import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import type { ClientToServerEvents, ServerToClientEvents } from '@spades/shared';
import { setupSocketHandlers } from './socket/handler.js';
import { loadBuiltInMods } from './mods/mod-loader.js';
import { modRegistry } from './mods/mod-registry.js';

const PORT = process.env.PORT || 3001;

// Load mods
loadBuiltInMods();

const app = express();
const httpServer = createServer(app);

// Serve built client files when SERVE_CLIENT=true (for single-port production deployment).
// When not serving the client, enable CORS for the Vite dev server origin.
const clientDistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/client/dist'
);
const servingClient = process.env.SERVE_CLIENT === 'true' && fs.existsSync(clientDistPath);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: servingClient
    ? undefined
    : {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
      }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Get available mods
app.get('/api/mods', (_req, res) => {
  res.json(modRegistry.getModList());
});

// Setup socket handlers
setupSocketHandlers(io);

// Serve the built client if it exists
if (servingClient) {
  app.use(express.static(clientDistPath));

  // SPA fallback: serve index.html for any non-API, non-file request
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });

  console.log(`Serving client from ${clientDistPath}`);
}

httpServer.listen(PORT, () => {
  console.log(`Spades server running on port ${PORT}`);
});
