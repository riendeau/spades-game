import type { ScoreHistoryEntry } from '@spades/shared';
import React from 'react';
import { Button } from '../ui/Button';
import { ScoreProgressionChart } from './ScoreProgressionChart';

interface ScoreChartModalProps {
  scoreHistory: ScoreHistoryEntry[];
  winningScore: number;
  onClose: () => void;
}

export function ScoreChartModal({
  scoreHistory,
  winningScore,
  onClose,
}: ScoreChartModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '560px',
          width: '90%',
          color: '#1f2937',
        }}
      >
        <h2 style={{ margin: '0 0 16px', textAlign: 'center' }}>
          Score Progression
        </h2>

        <ScoreProgressionChart
          scoreHistory={scoreHistory}
          winningScore={winningScore}
        />

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
