import type { RoundEffect, ClientGameState } from '@spades/shared';
import React, { useState, useCallback, useEffect } from 'react';
import { BowlingStrike } from './BowlingStrike';
import { FakeVictory } from './FakeVictory';

const TEAM_COLORS: Record<string, string> = {
  team1: '#3b82f6',
  team2: '#22c55e',
};

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

  function getTeamName(teamId?: string): string {
    if (!teamId) return 'Team';
    const players = gameState.players.filter((p) => p.team === teamId);
    if (players.length === 2) {
      return `${players[0].nickname} & ${players[1].nickname}`;
    }
    return players[0]?.nickname ?? 'Team';
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
