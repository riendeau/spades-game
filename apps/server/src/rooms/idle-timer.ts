export const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export class IdleTimerManager {
  private turns = new Map<string, number>(); // roomId → turnStartedAt timestamp

  startTurn(roomId: string): void {
    this.turns.set(roomId, Date.now());
  }

  clearTurn(roomId: string): void {
    this.turns.delete(roomId);
  }

  getTurnStartedAt(roomId: string): number | null {
    return this.turns.get(roomId) ?? null;
  }

  isKickable(roomId: string): boolean {
    const startedAt = this.turns.get(roomId);
    if (startedAt == null) return false;
    return Date.now() - startedAt >= IDLE_TIMEOUT_MS;
  }

  /** Remove tracking for a room (e.g., when room is deleted). */
  removeRoom(roomId: string): void {
    this.turns.delete(roomId);
  }
}
