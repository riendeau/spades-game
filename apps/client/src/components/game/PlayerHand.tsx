import type { Card as CardType } from '@spades/shared';
import React from 'react';
import { Card, CardBack } from '../ui/Card';

interface PlayerHandProps {
  cards: CardType[];
  onPlayCard: (card: CardType) => void;
  isMyTurn: boolean;
  selectedCard: CardType | null;
  onSelectCard: (card: CardType | null) => void;
  faceDown?: boolean;
  playableCards?: CardType[];
  compact?: boolean;
}

export function PlayerHand({
  cards,
  onPlayCard,
  isMyTurn,
  selectedCard,
  onSelectCard,
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

  const handleCardClick = (card: CardType) => {
    if (!isCardPlayable(card)) return;

    const isSelected =
      selectedCard?.suit === card.suit && selectedCard.rank === card.rank;
    if (isSelected) {
      // Clicking a selected card deselects it
      onSelectCard(null);
    } else {
      // Clicking an unselected card selects it
      onSelectCard(card);
    }
  };

  const handleCardDoubleClick = (card: CardType) => {
    if (!isCardPlayable(card)) return;

    // Double-clicking immediately plays the card
    onPlayCard(card);
    onSelectCard(null);
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: compact ? '8px' : '20px',
        paddingBottom: compact ? '12px' : '25px',
        minHeight: compact ? '91px' : '170px',
      }}
    >
      {cards.map((card, idx) => {
        const isSelected =
          selectedCard?.suit === card.suit && selectedCard?.rank === card.rank;

        // Fan: map card index to a rotation centered around 0
        const count = cards.length;
        const mid = (count - 1) / 2;
        const fanAngle = compact ? 0.75 : 1;
        const rotation = (idx - mid) * fanAngle;
        // Quadratic vertical arc — applied via `top` so it's in screen
        // coordinates, independent of the card's rotation.
        const t = (idx - mid) / Math.max(mid, 1); // -1 to 1
        const peakDrop = compact ? 10 : 20;
        const offsetY = t * t * peakDrop;

        return (
          <div
            key={`${card.suit}-${card.rank}`}
            style={{
              position: 'relative',
              top: `${offsetY}px`,
              marginLeft: idx > 0 ? (compact ? '-35px' : '-25px') : 0,
              zIndex: isSelected ? 100 : idx,
              transform: `rotate(${rotation}deg)${isSelected ? ' translateY(-12px)' : ''}`,
              transformOrigin: 'bottom center',
              transition: 'transform 0.15s ease',
            }}
          >
            {faceDown ? (
              <CardBack small={compact} />
            ) : (
              <Card
                card={card}
                onClick={() => handleCardClick(card)}
                onDoubleClick={() => handleCardDoubleClick(card)}
                disabled={!isCardPlayable(card)}
                selected={isSelected}
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
