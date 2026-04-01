import type { ClientGameState, PlayerId, Position } from '@spades/shared';
import React, { useEffect, useState } from 'react';
import { TEAM_COLORS, TEAM_RGB } from '../../styles/colors';

const IDLE_TIMEOUT_S = 120; // must match server IDLE_TIMEOUT_MS / 1000

interface OpponentAreaProps {
  gameState: ClientGameState;
  myPosition: Position;
  relativePosition: 'left' | 'top' | 'right';
  compact?: boolean;
  onOpenSeat?: (playerId: PlayerId) => void;
  onKickIdle?: (playerId: PlayerId) => void;
}

export function OpponentArea({
  gameState,
  myPosition,
  relativePosition,
  compact = false,
  onOpenSeat,
  onKickIdle,
}: OpponentAreaProps) {
  const positionMap: Record<string, Position> = {
    left: ((myPosition + 1) % 4) as Position,
    top: ((myPosition + 2) % 4) as Position,
    right: ((myPosition + 3) % 4) as Position,
  };

  const targetPosition = positionMap[relativePosition];
  const player = gameState.players.find((p) => p.position === targetPosition);

  // Idle countdown: only show when this opponent is the current player during
  // an active turn phase and the server has set turnStartedAt
  const isActiveTurn =
    player?.position != null &&
    gameState.currentPlayerPosition === player.position &&
    (gameState.phase === 'bidding' || gameState.phase === 'playing') &&
    gameState.turnStartedAt != null;

  const [idleSeconds, setIdleSeconds] = useState<number>(0);

  useEffect(() => {
    if (!isActiveTurn || !gameState.turnStartedAt) {
      return () => setIdleSeconds(0);
    }
    const turnStartedAt = gameState.turnStartedAt;
    const tick = () => {
      const elapsed = (Date.now() - turnStartedAt) / 1000;
      setIdleSeconds(Math.floor(elapsed));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      clearInterval(interval);
      setIdleSeconds(0);
    };
  }, [isActiveTurn, gameState.turnStartedAt]);

  if (!player) return null;

  const isCurrentPlayer = gameState.currentPlayerPosition === player.position;
  const bid = gameState.currentRound?.bids.find(
    (b) => b.playerId === player.id
  );
  const tricksWon = gameState.currentRound?.tricksWon[player.id] || 0;

  const isSideOpponent =
    relativePosition === 'left' || relativePosition === 'right';

  const isKickable = isActiveTurn && idleSeconds >= IDLE_TIMEOUT_S;
  const showIdleCountdown = isActiveTurn && idleSeconds >= 30;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: relativePosition === 'top' ? 'column' : 'row',
    alignItems: 'center',
    gap: compact ? (isSideOpponent ? '4px' : '6px') : '16px',
    padding: compact ? (isSideOpponent ? '4px 2px' : '6px') : '16px',
    backgroundColor: `rgba(${TEAM_RGB[player.team]}, ${isCurrentPlayer ? 0.2 : 0.07})`,
    borderRadius: '12px',
    border: isCurrentPlayer
      ? `2px solid ${TEAM_COLORS[player.team]}`
      : `2px solid rgba(${TEAM_RGB[player.team]}, 0.35)`,
    boxShadow: isCurrentPlayer
      ? `0 0 12px rgba(${TEAM_RGB[player.team]}, 0.6)`
      : 'none',
    transition: 'background-color 0.2s, border-color 0.2s, box-shadow 0.2s',
  };

  const formatCountdown = (seconds: number): string => {
    const remaining = Math.max(0, IDLE_TIMEOUT_S - seconds);
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={containerStyle}>
      <div
        style={{
          textAlign: 'center',
          minWidth: compact && isSideOpponent ? '48px' : '110px',
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: compact ? (isSideOpponent ? '11px' : '12px') : '18px',
            color: player.connected ? '#f9fafb' : '#9ca3af',
          }}
        >
          {player.nickname}
        </div>
        <div
          style={{
            fontSize: compact ? '10px' : '14px',
            marginTop: '2px',
            color: '#d1d5db',
          }}
        >
          Bid:{' '}
          {bid ? (bid.isBlindNil ? 'BNL' : bid.isNil ? 'Nil' : bid.bid) : '—'} |
          Won: {tricksWon}
        </div>
        {!player.connected && (
          <div>
            <div
              style={{
                fontSize: '11px',
                color: player.openForReplacement ? '#f59e0b' : '#f59e0b',
              }}
            >
              {player.openForReplacement ? 'Open Seat' : 'Disconnected'}
            </div>
            {!player.openForReplacement && onOpenSeat && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Replace ${player.nickname}? They won't be able to reconnect.`
                    )
                  ) {
                    onOpenSeat(player.id);
                  }
                }}
                style={{
                  marginTop: '4px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Replace
              </button>
            )}
          </div>
        )}
        {player.connected && showIdleCountdown && (
          <div>
            <div
              style={{
                fontSize: '11px',
                color: isKickable ? '#ef4444' : '#f59e0b',
                fontWeight: 600,
                marginTop: '2px',
              }}
            >
              {isKickable
                ? 'Idle — can be kicked'
                : `Idle ${formatCountdown(idleSeconds)}`}
            </div>
            {isKickable && onKickIdle && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Kick ${player.nickname} for inactivity? Their seat will be opened for a new player.`
                    )
                  ) {
                    onKickIdle(player.id);
                  }
                }}
                style={{
                  marginTop: '4px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Kick
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
