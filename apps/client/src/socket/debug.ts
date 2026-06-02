import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@spades/shared';
import type { Socket } from 'socket.io-client';
import {
  bufferDebug,
  drainDebugBuffer,
  loadSession,
} from '../store/game-store';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Emit a reconnect/replace-flow breadcrumb to the server's log-only relay and
// mirror it to the browser console so local dev keeps identical breadcrumbs.
// If the socket isn't connected, the breadcrumb is buffered and flushed on the
// next 'connect' (see flushDebugBuffer) — that's what captures the terminal
// 'reconnect_failed' / 'disconnect' cases the live channel can't deliver.
export function emitDebug(
  socket: TypedSocket,
  event: string,
  reason?: string
): void {
  console.log(`[client-debug] ${event}${reason ? ` reason=${reason}` : ''}`);
  const session = loadSession();
  const payload = {
    event,
    reason,
    sessionToken: session?.sessionToken,
    roomId: session?.roomId,
  };
  if (socket.connected) {
    socket.emit('client:debug', payload);
  } else {
    bufferDebug({ event, reason, t: Date.now() });
  }
}

// Flush any breadcrumbs buffered while disconnected. Call from the 'connect'
// handler, after the live 'connect' breadcrumb is emitted.
export function flushDebugBuffer(socket: TypedSocket): void {
  const session = loadSession();
  for (const entry of drainDebugBuffer()) {
    socket.emit('client:debug', {
      event: entry.event,
      reason: entry.reason,
      sessionToken: session?.sessionToken,
      roomId: session?.roomId,
    });
  }
}
