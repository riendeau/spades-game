import type {
  ClientGameState,
  Position,
  Card as CardType,
} from '@spades/shared';
import React from 'react';
import { Card } from '../ui/Card';

interface TrickAreaProps {
  gameState: ClientGameState;
  myPosition: Position;
}

const POSITION_OFFSETS: Record<
  Position,
  { top?: string; bottom?: string; left?: string; right?: string }
> = {
  0: { bottom: '20px', left: '50%' },
  1: { top: '50%', left: '20px' },
  2: { top: '20px', left: '50%' },
  3: { top: '50%', right: '20px' },
};

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
            <Card card={play.card} small />
          </div>
        );
      })}
    </div>
  );
}
