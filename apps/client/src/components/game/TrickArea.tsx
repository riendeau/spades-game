import type {
  ClientGameState,
  PlayerTrickPlay,
  Position,
} from '@spades/shared';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/game-store';
import { Card } from '../ui/Card';

interface TrickAreaProps {
  gameState: ClientGameState;
  myPosition: Position;
}

// Visual center of each card in the TrickArea container (250px × 200px, card 50×75)
// relPos 0 (bottom): left=50%=125, top=200-10-75=115 → center-y=152
// relPos 1 (left):   left=10, center-x=35; translateY(-50%) → center-y=100
// relPos 2 (top):    left=50%=125, top=10 → center-y=47
// relPos 3 (right):  right=10 → left=190, center-x=215; center-y=100
const CARD_CENTERS: Record<Position, { x: number; y: number }> = {
  0: { x: 125, y: 152 },
  1: { x: 35, y: 100 },
  2: { x: 125, y: 47 },
  3: { x: 215, y: 100 },
};

interface AnimatingTrick {
  plays: PlayerTrickPlay[];
  winnerRelPos: Position;
}

export function TrickArea({ gameState, myPosition }: TrickAreaProps) {
  const { lastTrickWinner, lastTrickPlays } = useGameStore();
  const [animatingTrick, setAnimatingTrick] = useState<AnimatingTrick | null>(
    null
  );
  const [isSliding, setIsSliding] = useState(false);
  // Tracks whether the CSS transition has visually completed. Using a ref
  // avoids triggering extra re-renders; the cleanup effect reads it on demand.
  const animationDoneRef = useRef(false);

  const trick = gameState.currentRound?.currentTrick;

  // Start the slide animation when a trick winner is announced.
  useEffect(() => {
    if (!lastTrickWinner || !lastTrickPlays || lastTrickPlays.length === 0)
      return;

    const winner = gameState.players.find((p) => p.id === lastTrickWinner);
    if (!winner) return;

    const winnerRelPos = ((((winner.position - myPosition) % 4) + 4) %
      4) as Position;

    let cancelled = false;
    animationDoneRef.current = false;

    let raf1: number;

    // Pause 500ms so the 4th card is visible before the slide begins.
    const pauseId = setTimeout(() => {
      if (cancelled) return;

      setAnimatingTrick({ plays: lastTrickPlays, winnerRelPos });
      setIsSliding(false);

      // Double rAF: first frame paints cards at their normal positions,
      // second frame triggers the CSS transition toward the winner.
      raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setIsSliding(true);
        });
      });
    }, 500);

    // Mark animation visually complete after the pause + CSS transition.
    // We do NOT clear animatingTrick here — we wait for the server's
    // game:state-update (at ~1500ms) to empty currentTrick.plays first,
    // which prevents the cards from flashing back at their original positions.
    const timeoutId = setTimeout(() => {
      if (!cancelled) animationDoneRef.current = true;
    }, 500 + 600);

    return () => {
      cancelled = true;
      clearTimeout(pauseId);
      cancelAnimationFrame(raf1);
      clearTimeout(timeoutId);
    };
  }, [lastTrickWinner]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the frozen animation once the CSS transition is done AND the server
  // has emptied currentTrick.plays. This prevents the flash that occurs when
  // animatingTrick is cleared while the server still has the old plays.
  const trickPlaysLength = trick?.plays.length ?? 0;
  useEffect(() => {
    if (!animatingTrick || !animationDoneRef.current) return;
    if (trickPlaysLength === 0) {
      setAnimatingTrick(null);
      setIsSliding(false);
      animationDoneRef.current = false;
    }
  }, [animatingTrick, trickPlaysLength]);

  const getRelativePosition = (pos: Position): Position => {
    return ((((pos - myPosition) % 4) + 4) % 4) as Position;
  };

  // Position styles without transform (transform handled separately below)
  const getPositionStyle = (relPos: Position): React.CSSProperties => {
    const positions: Record<Position, React.CSSProperties> = {
      0: { bottom: '10px', left: '50%' },
      1: { top: '50%', left: '10px' },
      2: { top: '10px', left: '50%' },
      3: { top: '50%', right: '10px' },
    };
    return positions[relPos];
  };

  // Base centering transform for each relative position
  const getCenteringTransform = (relPos: Position): string => {
    return relPos === 1 || relPos === 3
      ? 'translateY(-50%)'
      : 'translateX(-50%)';
  };

  const getTransform = (
    relPos: Position,
    winnerRelPos: Position,
    sliding: boolean
  ): string => {
    const centering = getCenteringTransform(relPos);
    if (!sliding) return centering;
    const from = CARD_CENTERS[relPos];
    const to = CARD_CENTERS[winnerRelPos];
    return `${centering} translateX(${to.x - from.x}px) translateY(${to.y - from.y}px) scale(0.3)`;
  };

  // During animation show the captured plays; otherwise show the live trick plays
  const displayPlays = animatingTrick
    ? animatingTrick.plays
    : (trick?.plays ?? []);

  if (!trick && !animatingTrick) return null;

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
      {displayPlays.map((play) => {
        const player = gameState.players.find((p) => p.id === play.playerId);
        if (!player) return null;

        const relPos = getRelativePosition(player.position);

        return (
          <div
            key={play.playerId}
            style={{
              position: 'absolute',
              ...getPositionStyle(relPos),
              transform: animatingTrick
                ? getTransform(relPos, animatingTrick.winnerRelPos, isSliding)
                : getCenteringTransform(relPos),
              opacity: animatingTrick && isSliding ? 0 : 1,
              transition: animatingTrick
                ? 'transform 0.5s ease-in, opacity 0.5s ease-in'
                : undefined,
              pointerEvents: animatingTrick ? 'none' : undefined,
            }}
          >
            <Card card={play.card} small testId="trick-card" />
          </div>
        );
      })}
    </div>
  );
}
