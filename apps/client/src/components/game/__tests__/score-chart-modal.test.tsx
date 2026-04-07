import type { ScoreHistoryEntry } from '@spades/shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ScoreChartModal } from '../ScoreChartModal';

const scoreHistory: ScoreHistoryEntry[] = [
  { round: 0, team1Score: 0, team2Score: 0 },
  { round: 1, team1Score: 52, team2Score: 38 },
];

describe('ScoreChartModal', () => {
  it('passes teamNames through to ScoreProgressionChart', () => {
    const html = renderToStaticMarkup(
      <ScoreChartModal
        scoreHistory={scoreHistory}
        winningScore={500}
        onClose={() => {}}
        teamNames={{ team1: 'The Aces', team2: 'Wild Cards' }}
      />
    );

    expect(html).toContain('The Aces');
    expect(html).toContain('Wild Cards');
    expect(html).not.toContain('Team 1');
    expect(html).not.toContain('Team 2');
  });

  it('falls back to default names when teamNames is not provided', () => {
    const html = renderToStaticMarkup(
      <ScoreChartModal
        scoreHistory={scoreHistory}
        winningScore={500}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Team 1');
    expect(html).toContain('Team 2');
  });
});
