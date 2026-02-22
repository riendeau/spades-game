import type { ClientGameState, Position } from '@spades/shared';
import React from 'react';

interface OpponentAreaProps {
  gameState: ClientGameState;
  myPosition: Position;
  relativePosition: 'left' | 'top' | 'right';
  compact?: boolean;
}

export function OpponentArea({
  gameState,
  myPosition,
  relativePosition,
  compact = false,
}: OpponentAreaProps) {
  const positionMap: Record<string, Position> = {
    left: ((myPosition + 1) % 4) as Position,
    top: ((myPosition + 2) % 4) as Position,
    right: ((myPosition + 3) % 4) as Position,
  };

  const targetPosition = positionMap[relativePosition];
  const player = gameState.players.find((p) => p.position === targetPosition);

  if (!player) return null;

  const isCurrentPlayer = gameState.currentPlayerPosition === player.position;
  const bid = gameState.currentRound?.bids.find(
    (b) => b.playerId === player.id
  );
  const tricksWon = gameState.currentRound?.tricksWon[player.id] || 0;

  const isSideOpponent =
    relativePosition === 'left' || relativePosition === 'right';

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: relativePosition === 'top' ? 'column' : 'row',
    alignItems: 'center',
    gap: compact ? (isSideOpponent ? '4px' : '6px') : '12px',
    padding: compact ? (isSideOpponent ? '4px 2px' : '6px') : '12px',
    backgroundColor: isCurrentPlayer
      ? player.team === 'team1'
        ? 'rgba(59, 130, 246, 0.2)'
        : 'rgba(34, 197, 94, 0.2)'
      : player.team === 'team1'
        ? 'rgba(59, 130, 246, 0.07)'
        : 'rgba(34, 197, 94, 0.07)',
    borderRadius: '12px',
    border: isCurrentPlayer
      ? player.team === 'team1'
        ? '2px solid #3b82f6'
        : '2px solid #22c55e'
      : player.team === 'team1'
        ? '2px solid rgba(59, 130, 246, 0.35)'
        : '2px solid rgba(34, 197, 94, 0.35)',
    boxShadow: isCurrentPlayer
      ? player.team === 'team1'
        ? '0 0 12px rgba(59, 130, 246, 0.6)'
        : '0 0 12px rgba(34, 197, 94, 0.6)'
      : 'none',
    transition: 'background-color 0.2s, border-color 0.2s, box-shadow 0.2s',
  };

  return (
    <div style={containerStyle}>
      <div
        style={{
          textAlign: 'center',
          minWidth: compact && isSideOpponent ? '48px' : '80px',
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: compact ? (isSideOpponent ? '11px' : '12px') : '14px',
            color: player.connected ? '#f9fafb' : '#9ca3af',
          }}
        >
          {player.nickname}
        </div>
        <div
          style={{
            fontSize: compact ? '10px' : '12px',
            marginTop: '2px',
            color: '#d1d5db',
          }}
        >
          Bid:{' '}
          {bid ? (bid.isBlindNil ? 'BNL' : bid.isNil ? 'Nil' : bid.bid) : '—'} |
          Won: {tricksWon}
        </div>
        {!player.connected && (
          <div style={{ fontSize: '11px', color: '#f59e0b' }}>Disconnected</div>
        )}
      </div>
    </div>
  );
}
