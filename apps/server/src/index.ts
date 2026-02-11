import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@spades/shared';
import { setupSocketHandlers } from './socket/handler.js';
import { loadBuiltInMods } from './mods/mod-loader.js';
import { modRegistry } from './mods/mod-registry.js';

const PORT = process.env.PORT || 3001;

// Load mods
loadBuiltInMods();

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
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

httpServer.listen(PORT, () => {
  console.log(`Spades server running on port ${PORT}`);
});
