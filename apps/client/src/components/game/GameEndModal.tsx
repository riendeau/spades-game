import React from 'react';
import type { ClientGameState } from '@spades/shared';
import { Button } from '../ui/Button';

interface GameEndModalProps {
  winner: 'team1' | 'team2';
  scores: ClientGameState['scores'];
  myTeam: 'team1' | 'team2';
  onNewGame: () => void;
}

export function GameEndModal({ winner, scores, myTeam, onNewGame }: GameEndModalProps) {
  const didWin = winner === myTeam;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '400px',
          width: '90%',
          textAlign: 'center',
          color: '#1f2937'
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>
          {didWin ? '🎉' : '😔'}
        </div>

        <h2 style={{ margin: '0 0 8px', fontSize: '28px' }}>
          {didWin ? 'You Won!' : 'You Lost'}
        </h2>

        <p style={{ color: '#6b7280', marginBottom: '24px' }}>
          Team {winner === 'team1' ? '1' : '2'} wins the game!
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '40px',
            marginBottom: '32px'
          }}
        >
          <div>
            <div style={{ color: '#3b82f6', fontWeight: 600 }}>Team 1</div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>
              {scores.team1.score}
            </div>
          </div>
          <div>
            <div style={{ color: '#10b981', fontWeight: 600 }}>Team 2</div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>
              {scores.team2.score}
            </div>
          </div>
        </div>

        <Button onClick={onNewGame} size="large">
          Play Again
        </Button>
      </div>
    </div>
  );
}
