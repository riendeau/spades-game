import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@spades/shared';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { emitDebug, flushDebugBuffer } from './debug';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextType {
  socket: TypedSocket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const serverUrl =
      import.meta.env.VITE_SERVER_URL ||
      (import.meta.env.DEV ? 'http://localhost:3001' : undefined);
    const newSocket: TypedSocket = io(serverUrl ?? window.location.origin, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log(`[socket] connected id=${newSocket.id}`);
      setConnected(true);
      emitDebug(newSocket, 'connect');
      // Deliver any breadcrumbs buffered while we were disconnected.
      flushDebugBuffer(newSocket);
    });

    newSocket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected id=${newSocket.id} reason=${reason}`);
      setConnected(false);
      emitDebug(newSocket, 'disconnect', reason);
    });

    // Manager-level reconnection events
    newSocket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[socket] reconnect_attempt #${attempt}`);
      emitDebug(newSocket, 'reconnect-attempt', `#${attempt}`);
    });

    newSocket.io.on('reconnect', (attempt) => {
      console.log(
        `[socket] reconnected after ${attempt} attempt(s) id=${newSocket.id}`
      );
      emitDebug(newSocket, 'reconnect-success', `attempts=${attempt}`);
    });

    newSocket.io.on('reconnect_error', (err) => {
      console.log(`[socket] reconnect_error: ${err.message}`);
      emitDebug(newSocket, 'reconnect-error', err.message);
    });

    newSocket.io.on('reconnect_failed', () => {
      console.log('[socket] reconnect_failed: all attempts exhausted');
      emitDebug(newSocket, 'reconnect-failed', 'attempts-exhausted');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
