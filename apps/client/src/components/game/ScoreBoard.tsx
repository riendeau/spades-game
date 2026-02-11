import React from 'react';
import type { ClientGameState } from '@spades/shared';

interface ScoreBoardProps {
  gameState: ClientGameState;
}

export function ScoreBoard({ gameState }: ScoreBoardProps) {
  const { scores } = gameState;

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <div
          style={{
            backgroundColor: '#3b82f6',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#fff',
            textAlign: 'center',
            minWidth: '70px'
          }}
        >
          <div style={{ fontSize: '22px', fontWeight: 700 }}>
            {scores.team1.score}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.9 }}>
            {scores.team1.bags} bags
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#10b981',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#fff',
            textAlign: 'center',
            minWidth: '70px'
          }}
        >
          <div style={{ fontSize: '22px', fontWeight: 700 }}>
            {scores.team2.score}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.9 }}>
            {scores.team2.bags} bags
          </div>
        </div>
      </div>

      {gameState.currentRound && (
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          R{gameState.currentRound.roundNumber} · T{gameState.currentRound.tricksWon ? Object.values(gameState.currentRound.tricksWon).reduce((a, b) => a + b, 0) + 1 : 1}/13
          {gameState.currentRound.spadesBroken && ' · Broken'}
        </div>
      )}
    </div>
  );
}
