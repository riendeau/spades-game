import type { ClientGameState, Position } from '@spades/shared';
import React from 'react';
import { Card } from '../ui/Card';

interface TrickAreaProps {
  gameState: ClientGameState;
  myPosition: Position;
  compact?: boolean;
}

export function TrickArea({
  gameState,
  myPosition,
  compact = false,
}: TrickAreaProps) {
  const trick = gameState.currentRound?.currentTrick;
  if (!trick) return null;

  const width = compact ? 180 : 250;
  const height = compact ? 150 : 200;
  const offset = compact ? 8 : 10;

  // Calculate relative positions (rotate so my position is at bottom)
  const getRelativePosition = (pos: Position): Position => {
    return ((pos - myPosition + 4) % 4) as Position;
  };

  const getPositionStyle = (relPos: Position): React.CSSProperties => {
    const positions: Record<Position, React.CSSProperties> = {
      0: { bottom: `${offset}px`, left: '50%', transform: 'translateX(-50%)' },
      1: { top: '50%', left: `${offset}px`, transform: 'translateY(-50%)' },
      2: { top: `${offset}px`, left: '50%', transform: 'translateX(-50%)' },
      3: { top: '50%', right: `${offset}px`, transform: 'translateY(-50%)' },
    };
    return positions[relPos];
  };

  return (
    <div
      data-testid="trick-area"
      style={{
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
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
