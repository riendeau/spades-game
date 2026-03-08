import type { ClientGameState } from '@spades/shared';
import React from 'react';
import { TEAM1_COLOR, TEAM2_COLOR } from '../../styles/colors';
import { TrickTracker } from './TrickTracker';

interface ScoreBoardProps {
  gameState: ClientGameState;
  compact?: boolean;
}

export function ScoreBoard({ gameState, compact = false }: ScoreBoardProps) {
  const { scores } = gameState;

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
        <TrickTracker gameState={gameState} compact />
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
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: gameState.currentRound ? '8px' : '0',
        }}
      >
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

      {gameState.currentRound && <TrickTracker gameState={gameState} />}
    </div>
  );
}
