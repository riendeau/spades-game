import type { ClientGameState, Position } from '@spades/shared';
import React from 'react';
import { Card } from '../ui/Card';

interface TrickAreaProps {
  gameState: ClientGameState;
  myPosition: Position;
}

export function TrickArea({ gameState, myPosition }: TrickAreaProps) {
  const trick = gameState.currentRound?.currentTrick;
  if (!trick) return null;

  // Calculate relative positions (rotate so my position is at bottom)
  const getRelativePosition = (pos: Position): Position => {
    return ((pos - myPosition + 4) % 4) as Position;
  };

  const getPositionStyle = (relPos: Position): React.CSSProperties => {
    const positions: Record<Position, React.CSSProperties> = {
      0: { bottom: '10px', left: '50%', transform: 'translateX(-50%)' },
      1: { top: '50%', left: '10px', transform: 'translateY(-50%)' },
      2: { top: '10px', left: '50%', transform: 'translateX(-50%)' },
      3: { top: '50%', right: '10px', transform: 'translateY(-50%)' },
    };
    return positions[relPos];
  };

  return (
    <div
      data-testid="trick-area"
      style={{
        position: 'relative',
        width: '250px',
        height: '200px',
        margin: '0 auto',
      }}
    >
      {trick.plays.map((play) => {
        const player = gameState.players.find((p) => p.id === play.playerId);
        if (!player) return null;

        const relPos = getRelativePosition(player.position);

        return (
          <div
            key={play.playerId}
            style={{
              position: 'absolute',
              ...getPositionStyle(relPos),
            }}
          >
            <Card card={play.card} small testId="trick-card" />
          </div>
        );
      })}
    </div>
  );
}
