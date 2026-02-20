import type { ClientGameState } from '@spades/shared';
import React from 'react';

interface ScoreBoardProps {
  gameState: ClientGameState;
  compact?: boolean;
}

export function ScoreBoard({ gameState, compact = false }: ScoreBoardProps) {
  const { scores } = gameState;

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: compact ? '8px' : '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <div
          style={{
            backgroundColor: '#3b82f6',
            borderRadius: '8px',
            padding: compact ? '5px 8px' : '8px 12px',
            color: '#fff',
            textAlign: 'center',
            minWidth: compact ? '52px' : '70px',
          }}
        >
          <div style={{ fontSize: compact ? '16px' : '22px', fontWeight: 700 }}>
            {scores.team1.score}
          </div>
          <div style={{ fontSize: compact ? '10px' : '11px', opacity: 0.9 }}>
            {scores.team1.bags} bags
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#10b981',
            borderRadius: '8px',
            padding: compact ? '5px 8px' : '8px 12px',
            color: '#fff',
            textAlign: 'center',
            minWidth: compact ? '52px' : '70px',
          }}
        >
          <div style={{ fontSize: compact ? '16px' : '22px', fontWeight: 700 }}>
            {scores.team2.score}
          </div>
          <div style={{ fontSize: compact ? '10px' : '11px', opacity: 0.9 }}>
            {scores.team2.bags} bags
          </div>
        </div>
      </div>

      {gameState.currentRound && (
        <div style={{ fontSize: compact ? '10px' : '12px', color: '#6b7280' }}>
          R{gameState.currentRound.roundNumber} · T
          {gameState.currentRound.tricksWon
            ? Object.values(gameState.currentRound.tricksWon).reduce(
                (a, b) => a + b,
                0
              ) + 1
            : 1}
          /13
          {gameState.currentRound.spadesBroken && ' · Broken'}
        </div>
      )}
    </div>
  );
}
