import type { RoundEffect, ClientGameState } from '@spades/shared';
import React, { useState, useCallback, useEffect } from 'react';
import { TEAM_COLORS } from '../../styles/colors';
import { BowlingStrike } from './BowlingStrike';
import { FakeVictory } from './FakeVictory';

interface EffectsOverlayProps {
  effects: RoundEffect[];
  gameState: ClientGameState;
  onAllComplete: () => void;
}

export function EffectsOverlay({
  effects,
  gameState,
  onAllComplete,
}: EffectsOverlayProps) {
  const [remaining, setRemaining] = useState(effects.length);

  const handleComplete = useCallback(() => {
    setRemaining((prev) => prev - 1);
  }, []);

  useEffect(() => {
    if (remaining <= 0) {
      onAllComplete();
    }
  }, [remaining, onAllComplete]);

  // Team names are generated at game start and fall back to 'Team 1'/'Team 2'
  // server-side, so this matches how RoundSummaryModal/GameEndModal render them.
  function getTeamName(teamId?: string): string {
    if (teamId !== 'team1' && teamId !== 'team2') return 'Team';
    return (
      gameState.teamNames?.[teamId] ?? `Team ${teamId === 'team1' ? '1' : '2'}`
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {effects.map((effect, i) => {
        switch (effect.id) {
          case 'bowling-strike':
            return <BowlingStrike key={i} onComplete={handleComplete} />;
          case 'fake-victory':
            return (
              <FakeVictory
                key={i}
                teamName={getTeamName(effect.teamId)}
                teamColor={TEAM_COLORS[effect.teamId ?? 'team1']}
                onComplete={handleComplete}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
