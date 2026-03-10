import type { ClientGameState, ScoreHistoryEntry } from '@spades/shared';
import React from 'react';
import { TEAM1_COLOR, TEAM2_COLOR } from '../../styles/colors';
import { Button } from '../ui/Button';
import { ScoreProgressionChart } from './ScoreProgressionChart';

interface GameEndModalProps {
  winner: 'team1' | 'team2';
  scores: ClientGameState['scores'];
  scoreHistory: ScoreHistoryEntry[];
  winningScore: number;
  myTeam: 'team1' | 'team2';
  teamNames?: { team1: string; team2: string };
  gameSummary?: string | null;
  onNewGame: () => void;
}

export function GameEndModal({
  winner,
  scores,
  scoreHistory,
  winningScore,
  myTeam,
  teamNames,
  gameSummary,
  onNewGame,
}: GameEndModalProps) {
  const didWin = winner === myTeam;
  const team1Name = teamNames?.team1 ?? 'Team 1';
  const team2Name = teamNames?.team2 ?? 'Team 2';
  const winnerName = winner === 'team1' ? team1Name : team2Name;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
          color: '#1f2937',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>
          {didWin ? '🎉' : '😔'}
        </div>

        <h2 style={{ margin: '0 0 8px', fontSize: '28px' }}>
          {didWin ? 'You Won!' : 'You Lost'}
        </h2>

        <p style={{ color: '#6b7280', marginBottom: '24px' }}>
          {winnerName} wins the game!
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '40px',
            marginBottom: '32px',
          }}
        >
          <div>
            <div style={{ color: TEAM1_COLOR, fontWeight: 600 }}>
              {team1Name}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>
              {scores.team1.score}
            </div>
          </div>
          <div>
            <div style={{ color: TEAM2_COLOR, fontWeight: 600 }}>
              {team2Name}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>
              {scores.team2.score}
            </div>
          </div>
        </div>

        {scoreHistory.length > 1 && (
          <div style={{ marginBottom: '24px' }}>
            <ScoreProgressionChart
              scoreHistory={scoreHistory}
              winningScore={winningScore}
              teamNames={teamNames}
              compact
            />
          </div>
        )}

        {gameSummary && (
          <div
            style={{
              marginBottom: '24px',
              padding: '16px 20px',
              backgroundColor: '#f9fafb',
              borderLeft: '3px solid #d1d5db',
              borderRadius: '0 8px 8px 0',
              fontStyle: 'italic',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#4b5563',
              textAlign: 'left',
            }}
          >
            {gameSummary}
          </div>
        )}

        <Button onClick={onNewGame} size="large">
          Play Again
        </Button>
      </div>
    </div>
  );
}
