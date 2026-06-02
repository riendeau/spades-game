import type { Socket } from 'socket.io';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleClientDebug } from '../handler.js';

// Minimal stand-in for the typed Socket — handleClientDebug only reads `.id`
// and uses the socket object as a WeakMap key.
function mockSocket(id = 'sock-1'): Socket {
  return { id } as unknown as Socket;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleClientDebug', () => {
  it('logs a correlatable line for a well-formed breadcrumb', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    handleClientDebug(mockSocket('abc'), {
      event: 'reconnect-emit',
      sessionToken: 'deadbeefcafe1234',
      roomId: 'ABC123',
      reason: 'no-clean-transition',
    });
    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0][0] as string;
    // 8-char token slice + tag convention so it greps with [reconnect]/[session]
    expect(line).toContain('[client deadbeef…]');
    expect(line).toContain('reconnect-emit');
    expect(line).toContain('room=ABC123');
    expect(line).toContain('reason=no-clean-transition');
    expect(line).toContain('socket=abc');
  });

  it('never throws on malformed payloads', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const bad: unknown[] = [
      null,
      undefined,
      42,
      'a string',
      [],
      {},
      { event: 123 },
      { event: 'x', sessionToken: 99, roomId: {}, reason: [] },
    ];
    for (const payload of bad) {
      expect(() => handleClientDebug(mockSocket(), payload)).not.toThrow();
    }
  });

  it('falls back to placeholders for missing/typed-wrong fields', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    handleClientDebug(mockSocket('s2'), { event: 'connect' });
    const line = log.mock.calls[0][0] as string;
    expect(line).toContain('[client ????????…]');
    expect(line).toContain('room=-');
    expect(line).toContain('reason=-');
  });

  it('rate-caps a flooding socket within a 1s window', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const socket = mockSocket('flooder');
    for (let i = 0; i < 100; i++) {
      handleClientDebug(socket, { event: 'spam' });
    }
    // 20/sec cap — anything past that is dropped silently.
    expect(log.mock.calls.length).toBeLessThanOrEqual(20);
    expect(log.mock.calls.length).toBeGreaterThan(0);
  });

  it('does not share a rate budget across sockets', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    // First socket exhausts its budget.
    const a = mockSocket('a');
    for (let i = 0; i < 100; i++) handleClientDebug(a, { event: 'spam' });
    const afterA = log.mock.calls.length;
    // A fresh socket still logs.
    handleClientDebug(mockSocket('b'), { event: 'connect' });
    expect(log.mock.calls.length).toBe(afterA + 1);
  });
});
