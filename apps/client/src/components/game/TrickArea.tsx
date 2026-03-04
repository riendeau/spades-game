import type { ClientGameState, Position } from '@spades/shared';
import React from 'react';
import { Card } from '../ui/Card';

const slideKeyframes = `
@keyframes slide-from-south {
  0% { transform: translateY(var(--slide-dist)) rotate(var(--rot-start)); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: rotate(var(--rot-end)); opacity: 1; }
}
@keyframes slide-from-north {
  0% { transform: translateY(calc(-1 * var(--slide-dist))) rotate(var(--rot-start)); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: rotate(var(--rot-end)); opacity: 1; }
}
@keyframes slide-from-west {
  0% { transform: translateX(calc(-1 * var(--slide-dist-x))) rotate(var(--rot-start)); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: rotate(var(--rot-end)); opacity: 1; }
}
@keyframes slide-from-east {
  0% { transform: translateX(var(--slide-dist-x)) rotate(var(--rot-start)); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: rotate(var(--rot-end)); opacity: 1; }
}
`;

const getAnimationName = (relPos: Position): string => {
  const names: Record<Position, string> = {
    0: 'slide-from-south',
    1: 'slide-from-west',
    2: 'slide-from-north',
    3: 'slide-from-east',
  };
  return names[relPos];
};

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
  const plays = trick?.plays ?? [];

  // Generate random rotations for new plays in a layout effect (before paint)
  const rotationsRef = React.useRef(
    new Map<string, { start: number; end: number }>()
  );
  const [, rerender] = React.useState(0);

  React.useLayoutEffect(() => {
    const currentIds = new Set(plays.map((p) => p.playerId));
    for (const key of rotationsRef.current.keys()) {
      if (!currentIds.has(key)) rotationsRef.current.delete(key);
    }

    let added = false;
    for (const play of plays) {
      if (rotationsRef.current.has(play.playerId)) continue;
      const player = gameState.players.find((p) => p.id === play.playerId);
      if (!player) continue;
      const relPos = ((player.position - myPosition + 4) % 4) as Position;
      const sign = relPos === 0 || relPos === 3 ? 1 : -1;
      rotationsRef.current.set(play.playerId, {
        start: sign * (12 + Math.random() * 348),
        end: (Math.random() - 0.5) * 8,
      });
      added = true;
    }
    if (added) rerender((c) => c + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on plays length to avoid ref churn
  }, [plays.length]);

  if (!trick) return null;

  const width = compact ? 180 : 320;
  const height = compact ? 150 : 280;
  const offset = compact ? 8 : 15;
  const gap = compact ? 4 : 10;

  // Calculate relative positions (rotate so my position is at bottom)
  const getRelativePosition = (pos: Position): Position => {
    return ((pos - myPosition + 4) % 4) as Position;
  };

  const getPositionStyle = (relPos: Position): React.CSSProperties => {
    const positions: Record<Position, React.CSSProperties> = {
      0: {
        top: `calc(50% + ${gap}px)`,
        left: '50%',
        transform: 'translateX(-50%)',
      },
      1: { top: '50%', left: `${offset}px`, transform: 'translateY(-50%)' },
      2: {
        bottom: `calc(50% + ${gap}px)`,
        left: '50%',
        transform: 'translateX(-50%)',
      },
      3: { top: '50%', right: `${offset}px`, transform: 'translateY(-50%)' },
    };
    return positions[relPos];
  };

  return (
    <div
      data-testid="trick-area"
      style={
        {
          position: 'relative',
          width: `${width}px`,
          height: `${height}px`,
          margin: '0 auto',
          '--slide-dist': compact ? '80px' : '150px',
          '--slide-dist-x': compact ? '120px' : '220px',
        } as React.CSSProperties
      }
    >
      <style>{slideKeyframes}</style>
      {trick.plays.map((play) => {
        const player = gameState.players.find((p) => p.id === play.playerId);
        if (!player) return null;

        const relPos = getRelativePosition(player.position);

        const rot = rotationsRef.current.get(play.playerId) ?? {
          start: 0,
          end: 0,
        };

        return (
          <div
            key={play.playerId}
            style={{
              position: 'absolute',
              ...getPositionStyle(relPos),
            }}
          >
            <div
              style={
                {
                  animation: `${getAnimationName(relPos)} 350ms ease-out forwards`,
                  '--rot-start': `${rot.start}deg`,
                  '--rot-end': `${rot.end}deg`,
                } as React.CSSProperties
              }
            >
              <Card card={play.card} small={compact} testId="trick-card" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
