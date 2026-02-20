import type { ClientGameState, Position } from '@spades/shared';
import React from 'react';
import { CardBack } from '../ui/Card';

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
  const hideCards = compact && isSideOpponent;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: relativePosition === 'top' ? 'column' : 'row',
    alignItems: 'center',
    gap: compact && isSideOpponent ? '4px' : '12px',
    padding: compact && isSideOpponent ? '4px 2px' : '12px',
    backgroundColor: isCurrentPlayer
      ? 'rgba(59, 130, 246, 0.1)'
      : 'transparent',
    borderRadius: '12px',
    transition: 'background-color 0.2s',
  };

  const cardContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '-15px',
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
            fontSize: compact && isSideOpponent ? '11px' : '14px',
            color: player.connected ? '#1f2937' : '#9ca3af',
          }}
        >
          {player.nickname}
        </div>
        <div
          style={{
            fontSize: compact && isSideOpponent ? '10px' : '12px',
            color: '#6b7280',
          }}
        >
          {player.team === 'team1' ? 'Team 1' : 'Team 2'}
        </div>
        {bid && (
          <div
            style={{
              fontSize: compact && isSideOpponent ? '10px' : '12px',
              marginTop: '4px',
            }}
          >
            Bid: {bid.isBlindNil ? 'BNL' : bid.isNil ? 'Nil' : bid.bid} | Won:{' '}
            {tricksWon}
          </div>
        )}
        {!player.connected && (
          <div style={{ fontSize: '11px', color: '#f59e0b' }}>Disconnected</div>
        )}
      </div>

      {!hideCards && (
        <div style={cardContainerStyle}>
          {Array.from({ length: Math.min(player.cardCount, 5) }).map((_, i) => (
            <div key={i} style={{ marginLeft: i > 0 ? '-30px' : 0 }}>
              <CardBack small />
            </div>
          ))}
          {player.cardCount > 5 && (
            <div
              style={{
                marginLeft: '-30px',
                width: '50px',
                height: '75px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#6b7280',
              }}
            >
              +{player.cardCount - 5}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
