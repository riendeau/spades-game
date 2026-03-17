import type {
  Card as CardType,
  ClientGameState,
  Position,
} from '@spades/shared';
import React from 'react';
import { useGameStore } from '../../store/game-store';
import { Card } from '../ui/Card';
import { detectSluff, type SluffInfo } from './sluff-detection';

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
@keyframes collect {
  0% { transform: rotate(var(--rot-end)); opacity: 1; }
  100% { transform: translate(var(--collect-x), var(--collect-y)) rotate(calc(var(--rot-end) + var(--collect-rot))); opacity: 0; }
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

// Card slot position relative to trick-area center (mirrors getPositionStyle)
const getSlotOffset = (
  relPos: Position,
  width: number,
  offset: number,
  gap: number
): { x: number; y: number } => {
  const slots: Record<Position, { x: number; y: number }> = {
    0: { x: 0, y: gap }, // south — centered, slightly below middle
    1: { x: -(width / 2 - offset), y: 0 }, // west — near left edge
    2: { x: 0, y: -gap }, // north — centered, slightly above middle
    3: { x: width / 2 - offset, y: 0 }, // east — near right edge
  };
  return slots[relPos];
};

// Slide-in translate offset per position (matches the slide-from-* keyframes)
const getSlideInOffset = (
  relPos: Position,
  slideDist: number,
  slideDistX: number
): { x: number; y: number } => {
  const offsets: Record<Position, { x: number; y: number }> = {
    0: { x: 0, y: slideDist }, // south: enters from below
    1: { x: -slideDistX, y: 0 }, // west: enters from left
    2: { x: 0, y: -slideDist }, // north: enters from above
    3: { x: slideDistX, y: 0 }, // east: enters from right
  };
  return offsets[relPos];
};

// Per-card collect offset: all cards converge on the winner's slide-in origin
// (i.e. winnerSlot + winnerSlideInOffset), so the convergence point is always
// identical to where the winner's card entered from.
const getCollectOffset = (
  cardRelPos: Position,
  winnerRelPos: Position,
  width: number,
  offset: number,
  gap: number,
  slideDist: number,
  slideDistX: number
): { x: number; y: number; rot: number } => {
  const card = getSlotOffset(cardRelPos, width, offset, gap);
  const winnerSlot = getSlotOffset(winnerRelPos, width, offset, gap);
  const winnerEntry = getSlideInOffset(winnerRelPos, slideDist, slideDistX);

  const x = winnerSlot.x + winnerEntry.x - card.x;
  const y = winnerSlot.y + winnerEntry.y - card.y;

  // Slight rotation in the dominant travel direction
  const rot = Math.abs(x) > Math.abs(y) ? (x > 0 ? 12 : -12) : y > 0 ? 8 : -8;

  return { x, y, rot };
};

// How far from the target toward the sluffer to place the sluff card (0=on target, 1=at sluffer)
const SLUFF_FACTOR = 0.45;

// True card-center offsets from container center. getSlotOffset returns edge-based
// positions for west/east (card left/right edge) and top-edge for south/north;
// this corrects to actual card centers so interpolation is direction-independent.
const getTrueCenterOffset = (
  relPos: Position,
  containerWidth: number,
  offset: number,
  gap: number,
  cardWidth: number,
  cardHeight: number
): { x: number; y: number } => {
  const slot = getSlotOffset(relPos, containerWidth, offset, gap);
  const corrections: Record<Position, { dx: number; dy: number }> = {
    0: { dx: 0, dy: cardHeight / 2 },
    1: { dx: cardWidth / 2, dy: 0 },
    2: { dx: 0, dy: -cardHeight / 2 },
    3: { dx: -cardWidth / 2, dy: 0 },
  };
  const c = corrections[relPos];
  return { x: slot.x + c.dx, y: slot.y + c.dy };
};

// Position a sluffed card partway from the target card toward the sluffer,
// so roughly half the card remains visible sticking out from under the target.
const getSluffPositionStyle = (
  slufferRelPos: Position,
  targetRelPos: Position,
  containerWidth: number,
  offset: number,
  gap: number,
  cardWidth: number,
  cardHeight: number
): React.CSSProperties => {
  const target = getTrueCenterOffset(
    targetRelPos,
    containerWidth,
    offset,
    gap,
    cardWidth,
    cardHeight
  );
  const sluffer = getTrueCenterOffset(
    slufferRelPos,
    containerWidth,
    offset,
    gap,
    cardWidth,
    cardHeight
  );
  const x = target.x + (sluffer.x - target.x) * SLUFF_FACTOR;
  const y = target.y + (sluffer.y - target.y) * SLUFF_FACTOR;
  return {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
  };
};

// Collect offset for a sluffed card: starts from the sluff position, not the normal slot
const getSluffCollectOffset = (
  slufferRelPos: Position,
  targetRelPos: Position,
  winnerRelPos: Position,
  containerWidth: number,
  offset: number,
  gap: number,
  cardWidth: number,
  cardHeight: number,
  slideDist: number,
  slideDistX: number
): { x: number; y: number; rot: number } => {
  const target = getTrueCenterOffset(
    targetRelPos,
    containerWidth,
    offset,
    gap,
    cardWidth,
    cardHeight
  );
  const sluffer = getTrueCenterOffset(
    slufferRelPos,
    containerWidth,
    offset,
    gap,
    cardWidth,
    cardHeight
  );
  const cardPos = {
    x: target.x + (sluffer.x - target.x) * SLUFF_FACTOR,
    y: target.y + (sluffer.y - target.y) * SLUFF_FACTOR,
  };
  const winnerCenter = getTrueCenterOffset(
    winnerRelPos,
    containerWidth,
    offset,
    gap,
    cardWidth,
    cardHeight
  );
  const winnerEntry = getSlideInOffset(winnerRelPos, slideDist, slideDistX);

  const x = winnerCenter.x + winnerEntry.x - cardPos.x;
  const y = winnerCenter.y + winnerEntry.y - cardPos.y;
  const rot = Math.abs(x) > Math.abs(y) ? (x > 0 ? 12 : -12) : y > 0 ? 8 : -8;

  return { x, y, rot };
};

interface CollectingState {
  plays: { playerId: string; card: CardType }[];
  rotations: Map<string, { start: number; end: number }>;
  sluffs: Map<string, SluffInfo>;
  winnerRelPos: Position;
}

interface TrickAreaProps {
  gameState: ClientGameState;
  myPosition: Position;
  compact?: boolean;
  onCollectingChange?: (collecting: boolean) => void;
}

export function TrickArea({
  gameState,
  myPosition,
  compact = false,
  onCollectingChange,
}: TrickAreaProps) {
  const trick = gameState.currentRound?.currentTrick;
  const plays = trick?.plays ?? [];
  const lastTrickWinner = useGameStore((s) => s.lastTrickWinner);

  // Generate random rotations for new plays in a layout effect (before paint)
  const rotationsRef = React.useRef(
    new Map<string, { start: number; end: number }>()
  );
  const sluffInfoRef = React.useRef(new Map<string, SluffInfo>());
  const [, rerender] = React.useState(0);

  // Collection animation state
  const [collecting, setCollecting] = React.useState<CollectingState | null>(
    null
  );
  const prevPlaysRef = React.useRef(plays);
  const collectTimerRef = React.useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  // Clean up collection timer on unmount
  React.useEffect(() => {
    return () => {
      clearTimeout(collectTimerRef.current);
      onCollectingChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Collection detection — declared BEFORE rotation-generation effect
  // so it can snapshot rotations before they're cleared.
  // Timer is managed via ref (not effect cleanup) so that a plays.length
  // change during the animation doesn't cancel the setCollecting(null) call.
  React.useLayoutEffect(() => {
    const prevPlays = prevPlaysRef.current;
    prevPlaysRef.current = plays;

    // Detect transition from non-empty → empty plays with a known winner
    if (prevPlays.length > 0 && plays.length === 0 && lastTrickWinner) {
      const winnerPlayer = gameState.players.find(
        (p) => p.id === lastTrickWinner
      );
      if (winnerPlayer) {
        const winnerRelPos = ((winnerPlayer.position - myPosition + 4) %
          4) as Position;
        setCollecting({
          plays: prevPlays.map((p) => ({ playerId: p.playerId, card: p.card })),
          rotations: new Map(rotationsRef.current),
          sluffs: new Map(sluffInfoRef.current),
          winnerRelPos,
        });
        onCollectingChange?.(true);
        clearTimeout(collectTimerRef.current);
        collectTimerRef.current = setTimeout(() => {
          setCollecting(null);
          onCollectingChange?.(false);
        }, 400);
      }
    } else if (plays.length > 0) {
      // New trick cards arrived while collection animation was in progress —
      // clear it immediately so the new cards are visible.
      clearTimeout(collectTimerRef.current);
      setCollecting(null);
      onCollectingChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plays.length, lastTrickWinner]);

  // Rotation generation effect (also detects sluffs for new plays)
  React.useLayoutEffect(() => {
    const currentIds = new Set(plays.map((p) => p.playerId));
    for (const key of rotationsRef.current.keys()) {
      if (!currentIds.has(key)) rotationsRef.current.delete(key);
    }
    for (const key of sluffInfoRef.current.keys()) {
      if (!currentIds.has(key)) sluffInfoRef.current.delete(key);
    }

    let added = false;
    for (let i = 0; i < plays.length; i++) {
      const play = plays[i];
      if (rotationsRef.current.has(play.playerId)) continue;

      const sluff = detectSluff(plays, i, gameState);
      if (sluff) {
        sluffInfoRef.current.set(play.playerId, sluff);
        rotationsRef.current.set(play.playerId, { start: 0, end: 0 });
      } else {
        const player = gameState.players.find((p) => p.id === play.playerId);
        if (!player) continue;
        const relPos = ((player.position - myPosition + 4) % 4) as Position;
        const sign = relPos === 0 || relPos === 3 ? 1 : -1;
        rotationsRef.current.set(play.playerId, {
          start: sign * (12 + Math.random() * 348),
          end: (Math.random() - 0.5) * 8,
        });
      }
      added = true;
    }
    if (added) rerender((c) => c + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on plays length to avoid ref churn
  }, [plays.length]);

  if (!trick && !collecting) return null;

  const width = compact ? 180 : 320;
  const height = compact ? 150 : 280;
  const offset = compact ? 8 : 15;
  const gap = compact ? 4 : 10;
  const slideDist = compact ? 80 : 150;
  const slideDistX = compact ? 120 : 220;
  const cardWidth = compact ? 50 : 110;
  const cardHeight = compact ? 75 : 160;

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

  // Determine which plays to render
  const displayPlays = collecting ? collecting.plays : (trick?.plays ?? []);

  return (
    <div
      data-testid="trick-area"
      style={
        {
          position: 'relative',
          width: `${width}px`,
          height: `${height}px`,
          margin: '0 auto',
          '--slide-dist': `${slideDist}px`,
          '--slide-dist-x': `${slideDistX}px`,
        } as React.CSSProperties
      }
    >
      <style>{slideKeyframes}</style>
      {displayPlays.map((play, playIndex) => {
        const player = gameState.players.find((p) => p.id === play.playerId);
        if (!player) return null;

        const relPos = getRelativePosition(player.position);

        const rot = collecting
          ? (collecting.rotations.get(play.playerId) ?? { start: 0, end: 0 })
          : (rotationsRef.current.get(play.playerId) ?? { start: 0, end: 0 });

        const sluffData = collecting
          ? collecting.sluffs.get(play.playerId)
          : sluffInfoRef.current.get(play.playerId);
        const isSluff = !!sluffData;

        // Resolve target player's relative position for sluff positioning
        let targetRelPos: Position | null = null;
        if (isSluff) {
          const targetPlayer = gameState.players.find(
            (p) => p.id === sluffData.targetPlayerId
          );
          if (targetPlayer) {
            targetRelPos = getRelativePosition(targetPlayer.position);
          }
        }

        const positionStyle =
          isSluff && targetRelPos !== null
            ? getSluffPositionStyle(
                relPos,
                targetRelPos,
                width,
                offset,
                gap,
                cardWidth,
                cardHeight
              )
            : { position: 'absolute' as const, ...getPositionStyle(relPos) };

        const zIndex = isSluff ? 0 : playIndex + 1;
        const animDuration = isSluff && !collecting ? '2000ms' : '350ms';

        return (
          <div key={play.playerId} style={{ ...positionStyle, zIndex }}>
            <div
              style={
                {
                  animation: collecting
                    ? 'collect 400ms ease-in forwards'
                    : `${getAnimationName(relPos)} ${animDuration} ease-out forwards`,
                  '--rot-start': `${rot.start}deg`,
                  '--rot-end': `${rot.end}deg`,
                  ...(collecting
                    ? (() => {
                        const c =
                          isSluff && targetRelPos !== null
                            ? getSluffCollectOffset(
                                relPos,
                                targetRelPos,
                                collecting.winnerRelPos,
                                width,
                                offset,
                                gap,
                                cardWidth,
                                cardHeight,
                                slideDist,
                                slideDistX
                              )
                            : getCollectOffset(
                                relPos,
                                collecting.winnerRelPos,
                                width,
                                offset,
                                gap,
                                slideDist,
                                slideDistX
                              );
                        return {
                          '--collect-x': `${c.x}px`,
                          '--collect-y': `${c.y}px`,
                          '--collect-rot': `${c.rot}deg`,
                        };
                      })()
                    : {}),
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
