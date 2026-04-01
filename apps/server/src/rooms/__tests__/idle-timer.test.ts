import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IdleTimerManager, IDLE_TIMEOUT_MS } from '../idle-timer.js';

describe('IdleTimerManager', () => {
  let timer: IdleTimerManager;

  beforeEach(() => {
    vi.useFakeTimers();
    timer = new IdleTimerManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when no turn has been started', () => {
    expect(timer.getTurnStartedAt('room1')).toBeNull();
  });

  it('records the current time on startTurn', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    timer.startTurn('room1');
    expect(timer.getTurnStartedAt('room1')).toBe(Date.now());
  });

  it('clears the turn', () => {
    timer.startTurn('room1');
    timer.clearTurn('room1');
    expect(timer.getTurnStartedAt('room1')).toBeNull();
  });

  it('is not kickable immediately after starting a turn', () => {
    timer.startTurn('room1');
    expect(timer.isKickable('room1')).toBe(false);
  });

  it('is not kickable when no turn is active', () => {
    expect(timer.isKickable('room1')).toBe(false);
  });

  it('is not kickable just before the timeout', () => {
    timer.startTurn('room1');
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1);
    expect(timer.isKickable('room1')).toBe(false);
  });

  it('is kickable exactly at the timeout', () => {
    timer.startTurn('room1');
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    expect(timer.isKickable('room1')).toBe(true);
  });

  it('is kickable after the timeout', () => {
    timer.startTurn('room1');
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 10000);
    expect(timer.isKickable('room1')).toBe(true);
  });

  it('resets the timer when startTurn is called again', () => {
    timer.startTurn('room1');
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000);
    // Almost kickable, now restart the turn
    timer.startTurn('room1');
    vi.advanceTimersByTime(1000);
    // Only 1 second has passed since restart — not kickable
    expect(timer.isKickable('room1')).toBe(false);
  });

  it('tracks rooms independently', () => {
    timer.startTurn('room1');
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    timer.startTurn('room2');
    expect(timer.isKickable('room1')).toBe(true);
    expect(timer.isKickable('room2')).toBe(false);
  });

  it('removeRoom clears the turn for that room', () => {
    timer.startTurn('room1');
    timer.removeRoom('room1');
    expect(timer.getTurnStartedAt('room1')).toBeNull();
    expect(timer.isKickable('room1')).toBe(false);
  });
});
