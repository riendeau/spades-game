import type { ClientGameState } from '@spades/shared';
import React from 'react';
import { TEAM1_COLOR, TEAM2_COLOR } from '../../styles/colors';

interface ScoreBoardProps {
  gameState: ClientGameState;
  compact?: boolean;
}

export function ScoreBoard({ gameState, compact = false }: ScoreBoardProps) {
  const { scores } = gameState;

  const roundInfo = gameState.currentRound ? (
    <>
      R{gameState.currentRound.roundNumber} · T
      {gameState.currentRound.tricksWon
        ? Object.values(gameState.currentRound.tricksWon).reduce(
            (a, b) => a + b,
            0
          ) + 1
        : 1}
      /13
      {gameState.currentRound.spadesBroken && ' · ♠'}
    </>
  ) : null;

  if (compact) {
    return (
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '4px 8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <div
          style={{
            backgroundColor: TEAM1_COLOR,
            borderRadius: '6px',
            padding: '3px 8px',
            color: '#fff',
            display: 'flex',
            alignItems: 'baseline',
            gap: '3px',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 700 }}>
            {scores.team1.score}
          </span>
          <span style={{ fontSize: '9px', opacity: 0.85 }}>
            {scores.team1.bags}b
          </span>
        </div>
        <div
          style={{
            backgroundColor: TEAM2_COLOR,
            borderRadius: '6px',
            padding: '3px 8px',
            color: '#fff',
            display: 'flex',
            alignItems: 'baseline',
            gap: '3px',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 700 }}>
            {scores.team2.score}
          </span>
          <span style={{ fontSize: '9px', opacity: 0.85 }}>
            {scores.team2.bags}b
          </span>
        </div>
        {gameState.currentRound && (
          <div style={{ fontSize: '10px', color: '#6b7280' }}>{roundInfo}</div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <div
          style={{
            backgroundColor: TEAM1_COLOR,
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#fff',
            textAlign: 'center',
            minWidth: '70px',
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
            backgroundColor: TEAM2_COLOR,
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#fff',
            textAlign: 'center',
            minWidth: '70px',
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
        <div style={{ fontSize: '12px', color: '#6b7280' }}>{roundInfo}</div>
      )}
    </div>
  );
}
