import type { Card as CardType } from '@spades/shared';
import React from 'react';
import { Card, CardBack } from '../ui/Card';

interface PlayerHandProps {
  cards: CardType[];
  onPlayCard: (card: CardType) => void;
  isMyTurn: boolean;
  faceDown?: boolean;
  playableCards?: CardType[];
  compact?: boolean;
}

export function PlayerHand({
  cards,
  onPlayCard,
  isMyTurn,
  faceDown = false,
  playableCards,
  compact = false,
}: PlayerHandProps) {
  const isCardPlayable = (card: CardType): boolean => {
    if (!isMyTurn) return false;
    if (!playableCards) return true;
    return playableCards.some(
      (c) => c.suit === card.suit && c.rank === card.rank
    );
  };

  const handleCardDoubleClick = (card: CardType) => {
    if (!isCardPlayable(card)) return;
    onPlayCard(card);
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: compact ? '8px' : '20px',
        paddingBottom: compact ? '12px' : '25px',
        minHeight: compact ? '91px' : '200px',
      }}
    >
      {cards.map((card, idx) => {
        // Fan: map card index to a rotation centered around 0
        const count = cards.length;
        const mid = (count - 1) / 2;
        // Maintain ~12° total fan spread; cap per-card angle so small
        // hands don't over-rotate.
        const maxFan = compact ? 9 : 12;
        const maxPerCard = compact ? 2 : 2.5;
        const fanAngle =
          count <= 1 ? 0 : Math.min(maxPerCard, maxFan / (count - 1));
        const rotation = (idx - mid) * fanAngle;
        // Quadratic vertical arc — applied via `top` so it's in screen
        // coordinates, independent of the card's rotation.
        // Arc depth scales with card count so small hands stay shallow.
        const basePeak = compact ? 10 : 24;
        const peakDrop = count <= 1 ? 0 : basePeak * ((count - 1) / 12);
        const t = (idx - mid) / Math.max(mid, 1); // -1 to 1
        const offsetY = t * t * peakDrop;

        return (
          <div
            key={`${card.suit}-${card.rank}`}
            style={{
              position: 'relative',
              top: `${offsetY}px`,
              marginLeft: idx > 0 ? (compact ? '-35px' : '-32px') : 0,
              zIndex: idx,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'bottom center',
              transition: 'transform 0.15s ease',
            }}
          >
            {faceDown ? (
              <CardBack small={compact} />
            ) : (
              <Card
                card={card}
                onDoubleClick={() => handleCardDoubleClick(card)}
                disabled={!isCardPlayable(card)}
                testId="hand-card"
                visuallyDisabled={isMyTurn && !isCardPlayable(card)}
                small={compact}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
